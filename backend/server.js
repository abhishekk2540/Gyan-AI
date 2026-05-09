import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import morgan from 'morgan';
import { chatRouter } from './routes/chat.js';
import { ragUploadRouter, ragQueryRouter } from './routes/rag.js';
import { agentRouter } from './routes/agent.js';
import { visionRouter } from './routes/vision.js';
import { posterRouter } from './routes/poster.js';
import { initStore } from './services/vectorStore.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Vector Store
initStore();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for vision images
app.use(morgan('dev')); // Clean logging of requests
app.use(fileUpload()); // Handles file uploads natively without Multer bugs

// Routes
app.post('/api/chat', chatRouter);
app.post('/api/rag/upload', ragUploadRouter);
app.post('/api/rag/query', ragQueryRouter);
app.post('/api/agent/run', agentRouter);
app.post('/api/vision/analyze', visionRouter);
app.post('/api/poster/generate', posterRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is running correctly' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`💬 Chat API available at /api/chat`);
  console.log(`📄 RAG API available at /api/rag/upload & /api/rag/query`);
  console.log(`========================================\n`);
});
