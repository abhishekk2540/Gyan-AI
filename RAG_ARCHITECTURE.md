# RAG System Architecture Documentation

This document explains the technical implementation of the Retrieval-Augmented Generation (RAG) system built into this AI Assistant. This is designed to help you explain the project structure and data flow to an interviewer.

---

## 🏗️ System Overview

The system follows a modern **Decoupled Architecture** with a React frontend and a Node.js/Express backend. It enables users to upload PDF documents, index them into a local vector store, and ask questions that the AI answers based *only* on the provided documents.

---

## 📂 File Structure & Responsibilities

### 1. Frontend: `src/components/RagTab.jsx`
*   **Role**: User Interface and Interaction.
*   **Key Functions**:
    *   **File Handling**: Uses `FormData` to stream PDF files to the backend.
    *   **SSE Streaming**: Consumes a **Server-Sent Events (SSE)** stream from the backend. Instead of waiting minutes for a full response, it updates the UI word-by-word as the AI "thinks," providing a premium user experience.
    *   **State Management**: Tracks indexed documents, loading states, and the generated answer.

### 2. Backend: `server.js`
*   **Role**: Entry point of the application.
*   **Responsibilities**: Configures middleware (CORS, JSON parsing, File Uploads) and registers the RAG routes.

### 3. RAG Controller: `routes/rag.js`
*   **Role**: Orchestrates the RAG workflow.
*   **Two Main Endpoints**:
    *   `POST /api/rag/upload`: Receives the PDF, extracts text using `pdf-parse`, breaks it into overlapping chunks, generates embeddings for each chunk, and saves them to the Vector Store.
    *   `POST /api/rag/query`: Converts the user's question into a vector, finds the top 5 most relevant document chunks, injects them into a specialized "system prompt," and streams the response from the LLM.

### 4. Vector Store: `services/vectorStore.js`
*   **Role**: A lightweight "Database" for vectors.
*   **Implementation**: 
    *   Uses a simple in-memory array for speed.
    *   **Persistence**: Automatically saves/loads from `.store.json` so you don't lose data when the server restarts.
    *   **Search**: Implements **Cosine Similarity** math to find document chunks that are semantically similar to the user's question.

### 5. Embedding Engine: `services/embeddings.js`
*   **Role**: Converts human language into math (vectors).
*   **Technology**: Uses **OpenRouter's `text-embedding-3-small`** model. This model converts a paragraph of text into a 1,536-dimension numerical vector.

### 6. LLM Engine: `services/llmService.js` (OpenRouter)
*   **Role**: The "Brain" that generates the answer.
*   **Technology**: Uses **Groq's LPU™ (Language Processing Unit)** running **Llama 3.1 8B**. This provides near-instant response speeds (<1 second time-to-first-token).

---

## 🔄 The Data Flow (Interview Talk Track)

### Phase 1: Document Indexing (The "Knowledge" Phase)
1. User uploads a PDF.
2. Backend parses the PDF into raw text.
3. **Chunking**: The text is split into small chunks (e.g., 600 characters) with a 100-character overlap. This ensures the AI has enough context without being overwhelmed.
4. **Embedding**: Each chunk is sent to the OpenRouter API to get its "Vector" (mathematical signature).
5. **Storage**: The text and its Vector are stored in our JSON Vector Store.

### Phase 2: Retrieval & Generation (The "Answer" Phase)
1. User asks: *"Who is Abhishek?"*
2. **Retrieval**: We convert the question into a Vector and compare it against all document Vectors using Cosine Similarity.
3. **Context Injection**: We grab the top 5 most similar chunks.
4. **Augmentation**: We wrap these chunks in a prompt: *"Use ONLY this context to answer the question: [Context Chunks]. Question: Who is Abhishek?"*
5. **Streaming**: The prompt is sent to Groq. As Groq generates tokens, the backend forwards them instantly to the frontend via SSE for real-time display.

---

## ⚡ Key Technical Highlights
*   **Zero-Latency Streaming**: Implemented Server-Sent Events (SSE) to eliminate the "blocking" wait time of traditional APIs.
*   **Semantic Search**: Used Vector Embeddings instead of keyword search, allowing the AI to understand the *meaning* of the document even if the exact words don't match.
*   **Cloud-Hybrid Scaling**: Uses high-speed cloud LPUs (Groq/OpenRouter) for production-ready performance.
