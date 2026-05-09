const OPENROUTER_EMBED_URL = process.env.OPENROUTER_EMBED_URL || 'https://openrouter.ai/api/v1/embeddings';
const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-small';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Converts text into a numerical vector using OpenRouter (OpenAI).
 * Retries up to MAX_RETRIES times on transient failures or bad responses.
 */
export const generateEmbedding = async (prompt) => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(OPENROUTER_EMBED_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
        },
        body: JSON.stringify({ model: EMBED_MODEL, input: prompt })
      });

      if (!res.ok) {
        throw new Error(`OpenRouter embedding failed. Status: ${res.status}`);
      }

      const data = await res.json();

      // Validate the response shape before accessing nested fields
      const embedding = data?.data?.[0]?.embedding;
      if (!Array.isArray(embedding)) {
        console.warn(`[Embedding] Unexpected response (attempt ${attempt}/${MAX_RETRIES}):`, JSON.stringify(data).slice(0, 200));
        throw new Error(`Invalid embedding response: missing data[0].embedding`);
      }

      return embedding;
    } catch (err) {
      console.error(`[Embedding Error] Attempt ${attempt}/${MAX_RETRIES}: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt)); // backoff: 1s, 2s
      } else {
        throw err; // Exhausted retries — propagate so caller can skip/handle
      }
    }
  }
};
