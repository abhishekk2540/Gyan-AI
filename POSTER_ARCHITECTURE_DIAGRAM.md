# Poster Maker Architecture: Backend Proxy Flow

This diagram shows how the app generates AI images through a backend proxy to ensure reliability.

```mermaid
sequenceDiagram
    participant User
    participant Frontend as PosterTab.jsx
    participant Server as server.js
    participant Route as poster.js
    participant API as Pollinations.ai (Flux)

    User->>Frontend: Types "A futuristic car" & clicks "Create"
    Frontend->>Server: POST /api/poster/generate<br/>{ prompt: "..." }
    Server->>Route: posterRouter
    
    Note over Route: Generates random seed<br/>Encodes prompt for URL
    Route->>API: fetch(Image URL)
    API-->>Route: Binary Image Data (Buffer)
    
    Note over Route: Converts Buffer to Base64 String
    Route-->>Frontend: { image: "data:image/jpeg;base64,..." }
    
    Note over Frontend: Sets image source<br/>Displays "Download" button
    Frontend-->>User: Displays AI Generated Poster
```

### Key Components Explained:
1. **`Pollinations.ai`**: A free-to-use API that provides access to the powerful **Flux.1** image generation model.
2. **Backend Proxy**: Instead of the browser fetching the image directly (which can be blocked by CORS or Firewalls), the backend fetches it and sends it to the UI as a secure data string.
3. **Flux.1 Engine**: One of the latest and most accurate image generation models, capable of following complex prompts.
