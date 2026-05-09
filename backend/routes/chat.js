import { streamChat } from '../services/llmService.js';

export const chatRouter = async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  // Inject a system prompt to enforce concise answers and markdown formatting
  const systemMessage = {
    role: 'system',
    content: 'You are a highly capable AI assistant. ALWAYS provide concise, brief, and direct answers. Use Markdown formatting (headings like ###, and bullet points) to make your output highly readable and structured. Do not write long, overly detailed explanations.'
  };

  const finalMessages = [systemMessage, ...messages];

  // Set headers for Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Establish connection immediately

  // Listen for the client prematurely aborting the request (e.g., hitting "Stop")
  const abortController = new AbortController();
  req.on('aborted', () => { abortController.abort(); });

  try {
    await streamChat(finalMessages, abortController.signal, (chunk) => {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[Chat Route Error]:', error.message);

    // Build a user-friendly message based on the error type
    let friendlyMsg = '⚠️ The AI encountered an issue. Please try rephrasing your message.';
    if (error.message?.includes('looping') || error.message?.includes('loop detection')) {
      friendlyMsg = '⚠️ The AI detected a loop in its response. Please rephrase or ask something different.';
    } else if (error.message?.includes('content_filter') || error.message?.includes('flagged')) {
      friendlyMsg = '⚠️ The response was blocked by a content filter. Please try a different prompt.';
    } else if (error.message?.includes('rate') || error.message?.includes('429')) {
      friendlyMsg = '⚠️ Rate limit reached. Please wait a moment and try again.';
    }

    if (!res.headersSent) {
      res.status(500).json({ error: friendlyMsg });
    } else {
      res.write(`data: ${JSON.stringify({ content: `\n\n${friendlyMsg}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
};
