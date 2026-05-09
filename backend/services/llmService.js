const API_URL        = process.env.OPENROUTER_API_URL      || 'https://openrouter.ai/api/v1/chat/completions';
const MODEL          = process.env.LLM_MODEL               || 'openai/gpt-oss-120b:free';
const MODEL_FALLBACK = process.env.LLM_MODEL_FALLBACK      || 'openai/gpt-oss-20b:free';
const VISION_MODEL   = process.env.LLM_VISION_MODEL        || 'openai/gpt-4o-mini';

/**
 * Internal helper: tries primary model, falls back on 429 or model-output errors.
 */
const callAPI = async (payload, signal, model = MODEL) => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({ ...payload, model }),
    signal,
  });
  return res;
};

/**
 * Gets a full chat response from OpenRouter (non-streaming).
 */
export const chat = async (messages) => {
  try {
    let response = await callAPI({ messages, stream: false });

    // Auto-fallback on rate-limit
    if (response.status === 429) {
      console.warn(`[LLM] ${MODEL} rate-limited (429), retrying with fallback ${MODEL_FALLBACK}...`);
      response = await callAPI({ messages, stream: false }, undefined, MODEL_FALLBACK);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
    }

    const data = await response.json();

    // Check for in-body error (OpenRouter sometimes returns 200 with an error field)
    if (data.error) {
      throw new Error(data.error.message || 'Model returned an error');
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('[OpenRouter Chat Error]:', error.message);
    throw error;
  }
};

/**
 * Streams chat responses from OpenRouter API.
 * Handles in-stream model errors (e.g. loop detection) and auto-retries with fallback.
 */
export const streamChat = async (messages, signal, onChunk) => {
  const attempt = async (model) => {
    let response = await callAPI({ messages, stream: true }, signal, model);

    // Rate-limit fallback
    if (response.status === 429 && model === MODEL) {
      console.warn(`[LLM] ${MODEL} rate-limited (429), retrying with ${MODEL_FALLBACK}...`);
      response = await callAPI({ messages, stream: true }, signal, MODEL_FALLBACK);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkStr = decoder.decode(value, { stream: true });
      const lines = chunkStr.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const dataStr = line.replace('data: ', '').trim();
        if (dataStr === '[DONE]') return; // clean finish

        try {
          const json = JSON.parse(dataStr);

          // ── Detect in-stream model errors ──────────────────────────
          if (json.error) {
            const msg = json.error.message || JSON.stringify(json.error);
            throw new Error(`model output error: ${msg}`);
          }

          // ── Normal content chunk ───────────────────────────────────
          const content = json.choices?.[0]?.delta?.content;
          if (content) onChunk(content);

          // ── finish_reason: error or content_filter ─────────────────
          const finishReason = json.choices?.[0]?.finish_reason;
          if (finishReason && finishReason !== 'stop' && finishReason !== 'length' && finishReason !== null) {
            console.warn(`[LLM] Unexpected finish_reason: ${finishReason}`);
          }
        } catch (e) {
          // Re-throw actual model errors; ignore JSON parse failures on partial chunks
          if (e.message.startsWith('model output error:')) throw e;
          console.warn('[LLM] Failed to parse SSE chunk:', dataStr.slice(0, 120));
        }
      }
    }
  };

  try {
    try {
      await attempt(MODEL);
    } catch (firstErr) {
      // Silent re-throw for abort or non-model errors
      if (firstErr.name === 'AbortError') throw firstErr;

      // Auto-retry with fallback model on loop detection / model output errors
      if (firstErr.message.includes('model output error') || firstErr.message.includes('looping')) {
        console.warn(`[LLM] Model error on ${MODEL}, retrying with fallback ${MODEL_FALLBACK}:`, firstErr.message);
        await attempt(MODEL_FALLBACK);
        return;
      }

      throw firstErr;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('[LLM] Generation stopped by user.');
      return;
    }
    console.error('[LLM Stream Error]:', error.message);
    throw error;
  }
};


/**
 * Analyzes an image using OpenRouter Vision models.
 */
export const analyzeImage = async (base64Image, prompt = "Describe this image concisely in 15-30 words.") => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { 
                type: "image_url", 
                image_url: { 
                  url: `data:image/jpeg;base64,${base64Image}` 
                } 
              }
            ]
          }
        ],
        stream: false
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter Vision error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('[Vision Service Error]:', error);
    throw error;
  }
};
