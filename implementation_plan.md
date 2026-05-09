# Local AI Assistant — 7-Day MVP Implementation Plan

## Overview

A **local-first AI assistant** built with a React frontend and Node.js/Express backend, powered by Ollama for local LLMs. The app will have four core feature tabs: **Chat**, **RAG (Ask My Docs)**, **Agent**, and **Vision** (object detection via webcam). All features use free/open-source tools.

---

## Architecture

```
React (Vite) ─────────────────────────────────────────────────────────
│  ┌──────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │  Chat    │  │  RAG / Docs │  │   Agent    │  │  Vision      │  │
│  │  Tab     │  │  Tab        │  │  Tab       │  │  (webcam)    │  │
│  └────┬─────┘  └──────┬──────┘  └─────┬──────┘  └──────┬───────┘  │
└───────┼───────────────┼───────────────┼─────────────────┼──────────┘
        │  REST / SSE   │               │                 │ TF.js (in-browser)
        ▼               ▼               ▼
   Node.js Express API (backend/)
        │               │               │
   Ollama (LLM)   ChromaDB (RAG)   Tool Runner
   llama3/phi3    Embeddings        ├─ Calculator
                  nomic-embed-text  └─ DuckDuckGo
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Vite + Vanilla CSS | Fast, modern, no extra setup |
| Backend | Node.js + Express | Lightweight, easy |
| LLM | Ollama (`llama3` or `phi3`) | Fully local, free |
| RAG Store | ChromaDB (Docker) | Simple, persistent vector store |
| Embeddings | `nomic-embed-text` via Ollama | Free, local |
| PDF Parse | `pdf-parse` (npm) | Extract text from PDFs |
| Object Detection | TensorFlow.js + COCO-SSD | Runs in-browser, no backend needed |
| Styling | Vanilla CSS (glassmorphism dark theme) | Premium look, no dependencies |

---

## Folder Structure

```
ai-assistant/
├── backend/
│   ├── server.js             # Express entry point
│   ├── routes/
│   │   ├── chat.js           # /api/chat (streaming SSE)
│   │   ├── rag.js            # /api/rag/upload + /api/rag/query
│   │   └── agent.js          # /api/agent/run
│   ├── services/
│   │   ├── ollama.js         # Ollama API wrapper
│   │   ├── chromadb.js       # ChromaDB client
│   │   ├── embeddings.js     # nomic-embed-text via Ollama
│   │   └── tools/
│   │       ├── calculator.js
│   │       └── search.js     # DuckDuckGo scraper
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Tab router
│   │   ├── components/
│   │   │   ├── ChatTab.jsx
│   │   │   ├── RagTab.jsx
│   │   │   ├── AgentTab.jsx
│   │   │   └── VisionTab.jsx
│   │   ├── styles/
│   │   │   └── index.css     # Global design system
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── docker-compose.yml        # ChromaDB
└── README.md
```

---

## Day-by-Day Plan

### Day 1 — Project Setup + Chat API

**Goal**: Working local AI chat

**Tasks**:
- Initialize Vite React frontend + Express backend
- Install and verify Ollama (`ollama pull llama3` or `phi3` for lighter)
- Build `/api/chat` route — POST with `{ messages: [] }` → Ollama
- Basic Chat UI: message list + input box
- Wire up frontend ↔ backend

**API**:
```
POST /api/chat
Body: { messages: [{ role, content }] }
Response: { reply: "..." }
```

**Deliverable**: You can type and get AI replies

---

### Day 2 — Streaming + Chat UI Polish

**Goal**: ChatGPT-like feel

**Tasks**:
- Add SSE streaming (`res.write` chunks) from Ollama stream API
- Frontend reads `EventSource` or `fetch` with `ReadableStream`
- Add message history state in React
- Add typing indicator, smooth scroll, timestamp
- Apply glassmorphism dark theme, custom fonts (Inter via Google Fonts)
- Add sidebar with model name indicator

**Deliverable**: Professional streaming chat UI

---

### Day 3 — RAG (Ask My Docs)

**Goal**: Upload PDF, ask questions from it

**Tasks**:
- Run ChromaDB via Docker (`docker-compose up`)
- Install `chromadb`, `pdf-parse` npm packages
- Build `/api/rag/upload` — accepts PDF, extracts text, chunks it, embeds it, stores in ChromaDB
- Build `/api/rag/query` — embeds question, retrieves top-K chunks, feeds to Ollama as context
- RAG Tab UI: drag-drop upload + query input + source citations

**Chunking strategy**: Split by 500 characters with 100-char overlap

**Prompt template**:
```
You are a helpful assistant. Use the following context to answer:

Context:
{retrieved_chunks}

Question: {user_query}
Answer:
```

**Deliverable**: "Ask my notes" feature working with PDFs

---

### Day 4 — AI Agent (ReAct Lite)

**Goal**: AI that can use tools

**Tools implemented**:
1. `calculator` — safe math evaluation via `mathjs`
2. `web_search` — DuckDuckGo instant answer API (free, no key)

**ReAct Loop** (simplified):
```
User query → Ollama decides if tool needed → 
If yes: call tool → inject result → final answer
If no: direct answer
```

**System prompt**:
```
You are an agent with access to tools:
- calculator(expression): evaluates math
- web_search(query): searches the web

Respond with JSON: { "tool": "calculator", "input": "2+2" } 
or { "tool": "none", "answer": "..." }
```

**API**:
```
POST /api/agent/run
Body: { query: "..." }
Response: { steps: [...], answer: "..." }
```

**Deliverable**: Agent that shows its thinking + tool results

---

### Day 5 — Vision (Object Detection)

**Goal**: Real-time webcam object detection in browser

**Tasks**:
- Add TensorFlow.js + `@tensorflow-models/coco-ssd` to frontend
- Access webcam via `getUserMedia`
- Run detection loop (requestAnimationFrame)
- Draw bounding boxes + labels on canvas overlay
- Show detection list with confidence scores

**All runs in-browser** — no backend needed for this feature

**Deliverable**: Live webcam detection with labeled boxes

---

### Day 6 — Integration + Polish

**Goal**: Unified, polished app

**Tasks**:
- Tab navigation (Chat / RAG / Agent / Vision)
- Unified dark glassmorphism design across all tabs
- Loading skeletons, error states, empty states
- Toast notifications for upload success/failure
- Responsive layout (mobile-friendly)
- Optional: Add `llama3.2-vision` for image uploads (if Ollama supports it)

**Deliverable**: Full app feels like a product

---

### Day 7 — Deployment + README

**Goal**: Live link + resume-ready project

**Tasks**:
- Frontend → Vercel (`npm run build` → deploy)
- Backend → Render (free tier, Node.js service)
- ChromaDB → Use in-memory mode for hosted demo (or Render persistent disk)
- Write `README.md` with: features, architecture diagram, setup guide, demo GIF
- Record 60-second demo video (Loom/OBS)
- Push to GitHub with good commit history

**Deliverable**: Live URL + GitHub repo + demo video

---

## Prerequisites (Install Before Day 1)

| Tool | Install Command |
|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) |
| Ollama | [ollama.ai](https://ollama.ai) |
| Docker Desktop | [docker.com](https://docker.com) |
| Git | [git-scm.com](https://git-scm.com) |

```bash
# After Ollama install:
ollama pull llama3       # ~4.7GB
ollama pull nomic-embed-text  # for RAG embeddings
```

---

## Open Questions

> [!IMPORTANT]
> **Model choice**: `llama3` (8B, ~4.7GB) needs ~8GB RAM. If your machine has less, use `phi3` (~2.3GB) or `gemma2:2b` (~1.4GB). Which do you prefer?

> [!IMPORTANT]
> **Docker availability**: ChromaDB runs best via Docker. If Docker isn't available, I can swap it for a local JSON-file vector store (simpler but less scalable). Do you have Docker Desktop?

> [!NOTE]
> **Streaming preference**: Day 2 streaming requires SSE or ReadableStream. I'll implement this by default. Let me know if you prefer simpler polling instead.

> [!NOTE]
> **Image generation**: Stable Diffusion local is heavy (needs GPU). For Day 6 optional, I can integrate a free API like Pollinations.ai instead. Want this included?

---

## Verification Plan

### Automated
- Manual API tests via `curl` / Postman for each route
- Browser console checks for TF.js model load

### Manual
- Chat: Send 5 messages, verify streaming response
- RAG: Upload a PDF, ask 3 questions, verify answers reference PDF content
- Agent: Ask "What is 2345 * 678?" → verify calculator tool used
- Agent: Ask "Who is the president of France?" → verify web_search used
- Vision: Point webcam at objects, verify bounding boxes render correctly

---

## Resume Line

> *"Built a local-first AI assistant with RAG pipeline (ChromaDB + Ollama embeddings), ReAct agent with tool calling, and real-time webcam object detection using COCO-SSD — fully open source, zero paid APIs."*
