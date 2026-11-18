# Gyan AI

Gyan AI is a multi-workspace assistant for conversations, document Q&A, web research, image analysis, and poster generation. The frontend is built with React and Vite; an Express API connects the workspaces to OpenRouter and other configured services.

## Features

- **AI Chat** — streamed responses with Markdown, math, and highlighted code.
- **Knowledge Base** — upload PDF, DOCX, or TXT files, then ask questions grounded in indexed passages.
- **Web Research** — run tasks using the calculator and, when configured, Tavily web search.
- **Image Analysis** — upload an image for a prompted description or use the webcam for live object detection.
- **Poster Studio** — generate and download an image from a text prompt.
- **Workspace UI** — searchable chat history stored in the browser, collapsible navigation, and light and dark themes.

## Stack

- Frontend: React 18, Vite, Lucide React
- Backend: Node.js, Express
- Language models and embeddings: OpenRouter
- Document parsing: `pdf-parse` and Mammoth
- Web search: Tavily (optional)
- Camera object detection: TensorFlow.js and COCO-SSD, loaded by the browser when needed

## Requirements

- Node.js 20 or newer
- npm
- An OpenRouter API key for chat, document embeddings, and image analysis

Tavily and Hugging Face credentials are optional. Without `TAVILY_API_KEY`, web search is unavailable to the research agent. Poster generation can use the configured image services without `HF_TOKEN`, though provider availability can vary.

## Run locally

Create the backend environment file from the example and add your service credentials:

```sh
cp backend/.env.example backend/.env
```

At minimum, set `OPENROUTER_API_KEY` in `backend/.env`. Start the backend in one terminal:

```sh
cd backend
npm install
npm run dev
```

Start the frontend in a second terminal:

```sh
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. During local development, Vite proxies `/api` requests to the Express server at `http://localhost:3001`. The backend health endpoint is <http://localhost:3001/health>.

For a production frontend build, run these commands from `frontend`:

```sh
npm run build
npm run preview
```

The backend can be started with `npm start` from `backend`. It listens on `PORT` when supplied by the host and otherwise uses port `3001`.

## Environment variables

Backend variables belong in `backend/.env` locally and in the hosting provider's environment settings in production. See [`backend/.env.example`](backend/.env.example) for the full list.

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Required for chat, embeddings, and image analysis. |
| `TAVILY_API_KEY` | Enables live web search for the research agent. |
| `HF_TOKEN` | Optional Hugging Face image generation credential. |
| `LLM_MODEL` | Primary chat and agent model. |
| `LLM_MODEL_FALLBACK` | Fallback model for chat streaming. |
| `LLM_VISION_MODEL` | Model used for image analysis. |
| `EMBED_MODEL` | Model used to embed document chunks and queries. |
| `FRONTEND_ORIGINS` | Optional comma-separated browser origins allowed by CORS, such as `http://localhost:5173` or your Vercel domain. |
| `PORT` | HTTP port supplied by the hosting provider; defaults to `3001` locally. |

Service URL overrides for OpenRouter, Tavily, Hugging Face, and the poster image provider are also listed in the example file.

The Vercel frontend uses `VITE_API_BASE_URL` to call the separately hosted backend. Set it to the backend origin, for example `https://your-backend-app.herokuapp.com`. Leave it unset for local development. This URL is included in the frontend build, so do not put API secrets in `VITE_` variables.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend health check. |
| `POST` | `/api/chat` | Stream a chat response from a `messages` array. |
| `POST` | `/api/rag/upload` | Upload a PDF, DOCX, or TXT file for indexing (`multipart/form-data`, field `file`). |
| `POST` | `/api/rag/query` | Ask a question about indexed documents. |
| `POST` | `/api/agent/run` | Run a research task (`{ "query": "..." }`). |
| `POST` | `/api/vision/analyze` | Analyze a base64 image, with an optional prompt. |
| `POST` | `/api/poster/generate` | Generate an image from a prompt (`{ "prompt": "..." }`). |

Chat and RAG responses may use Server-Sent Events. The frontend consumes these streams directly.

## Deployment

The current deployment setup uses Vercel for the frontend and Heroku for the backend. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the project root settings, environment variables, and backend deployment command.

Chat history is stored in browser local storage. The document vector index is stored as a local JSON file by the backend. Heroku's filesystem is ephemeral, so indexed documents can be lost after a restart or deployment; use persistent storage before relying on RAG data in production.

## Project layout

```text
backend/
  routes/       Express API endpoints
  services/     OpenRouter, embeddings, and vector-store logic
  server.js     Express server entry point
  Procfile      Heroku web process
frontend/
  src/          React app and workspace components
  public/       Static assets
  vercel.json   SPA rewrite for Vercel
DEPLOYMENT.md   Heroku and Vercel deployment notes
docker-compose.yml
```
