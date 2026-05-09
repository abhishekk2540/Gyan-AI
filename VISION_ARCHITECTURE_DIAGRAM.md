# Vision Architecture: Dual-Layer Analysis

This diagram shows how the app handles both real-time local detection and cloud-based AI analysis.

```mermaid
sequenceDiagram
    participant User
    participant Frontend as VisionTab.jsx
    participant TF as TensorFlow.js (Local Model)
    participant Server as server.js
    participant Route as vision.js
    participant Cloud as OpenRouter (Gemini/GPT-4o)

    %% Layer 1: Local
    Note over User, TF: --- LAYER 1: LOCAL DETECTION ---
    User->>Frontend: Starts Camera
    loop Every Frame (~60 FPS)
        Frontend->>TF: Send video frame
        TF-->>Frontend: [Object Bounding Boxes]
        Note over Frontend: Draws boxes (Person, Chair, etc.) on Canvas
    end

    %% Layer 2: Cloud
    Note over User, Cloud: --- LAYER 2: AI ANALYSIS ---
    User->>Frontend: Clicks "Analyze Frame"
    Note over Frontend: Captures Canvas snapshot<br/>Converts to Base64 String
    Frontend->>Server: POST /api/vision/analyze<br/>{ image: "base64..." }
    Server->>Route: visionRouter
    Note over Route: Validates image payload (10MB limit)
    Route->>Cloud: analyzeImage(base64)
    Note over Cloud: Multimodal Vision Processing
    Cloud-->>Route: "I see a laptop and a coffee cup..."
    Route-->>Frontend: { description: "..." }
    Frontend-->>User: Displays AI Analysis result
```

### Key Components Explained:
1. **`TensorFlow.js`**: Runs the `COCO-SSD` model directly in the browser. This ensures privacy because real-time video never leaves your computer.
2. **`COCO-SSD`**: A pre-trained model that can recognize 80 different common objects.
3. **Multimodal API**: When deep understanding is needed (like reading text or describing a scene), the app sends a single snapshot to **OpenRouter** (GPT-4o-mini).
