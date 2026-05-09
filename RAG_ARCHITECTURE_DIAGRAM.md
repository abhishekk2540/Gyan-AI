# RAG Architecture: Data Flow Diagram

Here is a visual representation of how the Retrieval-Augmented Generation (RAG) system processes document uploads and queries.

```mermaid
sequenceDiagram
    participant User
    participant Frontend as RagTab.jsx (Frontend)
    participant Server as server.js (Backend)
    participant Route as rag.js (Route)
    participant Embed as embeddings.js (Service)
    participant Vector as vectorStore.js (Service)
    participant LLM as llmService.js (Service)
    participant Cloud as OpenRouter API

    %% Phase 1: Upload
    Note over User, Cloud: --- PHASE 1: DOCUMENT UPLOAD ---
    User->>Frontend: Selects PDF & clicks "Upload"
    Frontend->>Server: POST /api/rag/upload (FormData)
    Server->>Route: ragUploadRouter
    Note over Route: Extracts text using pdf-parse<br/>Chunks text into 1000-char pieces
    Route->>Embed: generateEmbeddings(chunks)
    Embed->>Cloud: POST /embeddings (text-embedding-3-small)
    Cloud-->>Embed: Returns vector arrays
    Embed-->>Route: vectors
    Route->>Vector: addDocument(filename, chunks, vectors)
    Vector->>Vector: Saves to .store.json
    Route-->>Frontend: { success: true }
    Frontend-->>User: "Indexing Complete! ✨"

    %% Phase 2: Query
    Note over User, Cloud: --- PHASE 2: ASK QUESTION ---
    User->>Frontend: Types "What is in the PDF?"
    Frontend->>Server: POST /api/rag/query<br/>{ query: "..." }
    Server->>Route: ragQueryRouter
    Route->>Embed: generateEmbedding(query)
    Embed->>Cloud: POST /embeddings
    Cloud-->>Embed: queryVector
    Embed-->>Route: queryVector
    Route->>Vector: search(queryVector, topK=5)
    Note over Vector: Calculates Cosine Similarity<br/>Sorts by best match
    Vector-->>Route: Top 5 Relevant Chunks
    Route->>LLM: streamChat(Augmented Prompt)
    Note over Route: Context: [Chunks] + Query: [...]
    LLM-->>Frontend: Streaming Answer (SSE)
    Frontend-->>User: Displays answer in UI
```

### Key Components Explained:
1. **`RagTab.jsx`**: Manages file selection, upload status, and the document-based chat UI.
2. **`embeddings.js`**: Converts human text into mathematical vectors (numbers) using OpenRouter's embedding model.
3. **`vectorStore.js`**: The "Brain". It stores chunks and vectors in a local JSON file and performs **Cosine Similarity** to find the most relevant document parts for your question.
4. **`pdf-parse`**: A backend library used to scrape raw text from PDF files before they are chunked.
