import { createRequire } from 'module';
import { generateEmbedding } from '../services/embeddings.js';
import { addDocumentChunks, searchSimilar } from '../services/vectorStore.js';
import { streamChat } from '../services/llmService.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// Helper to chunk text logically
const chunkText = (text, size = 600, overlap = 150) => {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
};

// 1. Upload Route
export const ragUploadRouter = async (req, res) => {
  try {
    if (!req.files || !req.files.file) return res.status(400).json({ error: 'No file uploaded' });

    const uploadedFile = req.files.file;
    console.log(`[RAG] Processing upload: ${uploadedFile.name}...`);

    // Extract text from the PDF buffer
    const pdfData = await pdfParse(uploadedFile.data);
    const text = pdfData.text.replace(/\n/g, ' ').trim();

    if (!text) return res.status(400).json({ error: 'PDF is empty or unreadable' });

    // Split into overlapping chunks
    const chunks = chunkText(text).filter(c => c.trim());
    console.log(`[RAG] Split into ${chunks.length} chunks. Generating embeddings in parallel...`);

    // --- PARALLEL BATCH EMBEDDING (fixes ECONNRESET timeout) ---
    // Sequential calls for 100 chunks = ~30-50s (proxy timeout)
    // Parallel batches of 10 = ~3-5s
    const BATCH_SIZE = 10;
    const docsToStore = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      console.log(`[RAG] Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);

      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          try {
            const embedding = await generateEmbedding(chunk);
            return { text: chunk, source: uploadedFile.name, embedding };
          } catch (err) {
            console.warn(`[RAG] Skipping chunk due to embedding error: ${err.message}`);
            return null; // Skip failed chunks rather than aborting everything
          }
        })
      );

      docsToStore.push(...batchResults.filter(Boolean));
    }
    // --- END PARALLEL BATCH EMBEDDING ---

    addDocumentChunks(docsToStore);
    console.log(`[RAG] Successfully indexed ${docsToStore.length}/${chunks.length} chunks!`);

    res.status(200).json({ message: 'Document indexed successfully', chunks: docsToStore.length });
  } catch (err) {
    console.error('[RAG Upload Error]:', err);
    res.status(500).json({ error: 'Failed to process document' });
  }
};

// 2. Query Route
export const ragQueryRouter = async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    console.log(`[RAG] Searching for: "${query}"`);
    
    // Convert user question to a vector
    const queryEmbedding = await generateEmbedding(query);

    // Search our local JSON memory store for the top 5 closest chunks (reduced from 10 to speed up LLM generation)
    const matches = searchSimilar(queryEmbedding, 5);
    
    if (matches.length === 0) {
      // No relevant chunks found (either store is empty or similarity too low)
      return res.status(200).json({
        answer: "I couldn't find any relevant information in the uploaded documents to answer that question.",
        sources: []
      });
    }

    // Combine the chunks into a context block, including their source filename
    const context = matches.map(m => `[Source: ${m.source}]\n${m.text}`).join('\n\n---\n\n');

    // ── Strict RAG system + user prompt ─────────────────────────────
    // System message is the strongest instruction layer — the model must obey it.
    const messages = [
      {
        role: 'system',
        content: `You are a document question-answering assistant.
STRICT RULES — you MUST follow these at ALL times:
1. Answer ONLY using the document excerpts provided below. Do NOT use any outside knowledge.
2. If the answer is not explicitly stated in the excerpts, respond with EXACTLY: "The documents do not contain information about this."
3. Do NOT guess, infer, or fill in details that are not in the excerpts.
4. Do NOT mention people, facts, or events that are not in the excerpts.
5. Start your answer directly — do not say "Based on the context" or "According to the documents".

DOCUMENT EXCERPTS:
${context}`
      },
      {
        role: 'user',
        content: query
      }
    ];

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Establish connection immediately

    // Listen for the client prematurely aborting the request (e.g., hitting "Stop")
    const abortController = new AbortController();
    req.on('aborted', () => {
      abortController.abort();
    });

    // Send the sources first
    res.write(`data: ${JSON.stringify({ sources: matches.map(m => m.text) })}\n\n`)

    try {
      await streamChat(messages, abortController.signal, (chunk) => {
        // Forward each chunk to the client as an SSE event
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      });

      // Send the done signal when the stream is fully complete
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
    }
  } catch (err) {
    console.error('[RAG Query Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'RAG query failed' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
      res.end();
    }
  }
};
