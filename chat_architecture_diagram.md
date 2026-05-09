# Chat Architecture: Data Flow Diagram

Here is a visual representation of exactly how the different files in our application communicate when you type a message and press "Send".

```mermaid
sequenceDiagram
    participant User
    participant Frontend as ChatTab.jsx (Frontend)
    participant Server as server.js (Backend)
    participant Route as chat.js (Route)
    participant Service as llmService.js (Service)
    participant Cloud as OpenRouter (Cloud API)

    %% 1. User Input
    User->>Frontend: Types message & clicks "Send"
    
    %% 2. Frontend prepares request
    Note over Frontend: Creates AbortController<br/>Disables "Send" button<br/>Shows "Stop" button
    Frontend->>Server: POST /api/chat<br/>{ messages: [...] }
    
    %% 3. Express Routing
    Server->>Route: Forwards request to chatRouter
    
    %% 4. Route setup
    Note over Route: Validates input<br/>Injects "System Prompt"<br/>Sets headers for SSE streaming
    
    %% 5. Calling Service
    Route->>Service: streamChat(messages, signal, onChunk)
    
    %% 6. Calling AI Engine
    Service->>Cloud: native fetch() with stream: true
    
    %% 7. Streaming Response
    loop Every computed token (word)
        Cloud-->>Service: Yields JSON chunk via ReadableStream
        Note over Service: Parses JSON, extracts text
        Service-->>Route: triggers onChunk(text) callback
        Route-->>Frontend: res.write(`data: {content: text}\n\n`) (SSE)
        Note over Frontend: Decodes chunk, updates React state<br/>ReactMarkdown renders HTML
        Frontend-->>User: Displays text on screen instantly
    end
    
    %% 8. Completion
    Ollama-->>Service: Stream finished
    Service-->>Route: Resolves Promise
    Route-->>Frontend: res.write(`data: [DONE]\n\n`)<br/>res.end()
    Frontend-->>User: Re-enables "Send" button
```

### Key Components Explained:
1. **`ChatTab.jsx`**: The React UI. It listens to your keystrokes, initiates the HTTP request, and parses the streaming chunks back into beautiful HTML on your screen.
2. **`server.js`**: The Express "traffic cop". It intercepts `/api/chat` requests from the frontend and sends them to the correct route file.
3. **`chat.js`**: The route logic. It's responsible for the "System Prompt" injection and setting up the Server-Sent Events (SSE) connection so the browser knows to expect a continuous stream of data.
4. **`llmService.js`**: The native bridge. It makes the actual `fetch` call to the **OpenRouter** cloud endpoint and parses the raw JSON lines returned by the AI.
