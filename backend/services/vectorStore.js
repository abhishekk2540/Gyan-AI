import fs from 'fs';
import path from 'path';

// Save to a hidden file so 'node --watch' doesn't constantly restart the server!
const STORE_PATH = path.join(process.cwd(), '.store.json');

// Minimum cosine similarity score to be considered a relevant match.
// Set very low (0.05) — hallucination is prevented by the strict system prompt
// in rag.js, not by this threshold. Short queries like "github" or "AI" produce
// low cosine scores against long chunks even when the content IS relevant.
// This only blocks queries where the store is truly empty or vectors are zeros.
const MIN_SIMILARITY = 0.05;

// Memory cache of our vectors
let store = [];

export const initStore = () => {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(STORE_PATH)) {
    store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    console.log(`📚 RAG Store loaded: ${store.length} chunks available.`);
  } else {
    fs.writeFileSync(STORE_PATH, JSON.stringify([]));
    console.log(`📚 RAG Store initialized (Empty).`);
  }
};

export const addDocumentChunks = (chunks) => {
  store.push(...chunks);
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
};

// Math formula for calculating similarity between two text vectors
const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const searchSimilar = (queryEmbedding, topK = 5) => {
  if (store.length === 0) return [];

  const results = store
    .map(doc => ({
      text: doc.text,
      source: doc.source,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }))
    // ── Filter out chunks below the relevance threshold ──────────────
    .filter(doc => doc.score >= MIN_SIMILARITY);

  if (results.length === 0) return []; // No relevant chunks found at all

  // Sort descending by highest match score, return top K
  results.sort((a, b) => b.score - a.score);

  console.log(`[VectorStore] Top match score: ${results[0].score.toFixed(3)} | Relevant chunks found: ${results.length}`);
  return results.slice(0, topK);
};
