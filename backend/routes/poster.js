const HF_API          = process.env.HF_IMAGE_API_URL   || 'https://api-inference.huggingface.co/models/stabilityai/sdxl-turbo';
const POLLINATIONS_URL = process.env.POLLINATIONS_URL   || 'https://image.pollinations.ai/prompt';

export const posterRouter = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

    console.log(`[Poster] Generating: "${prompt}"`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s max wait for high-quality Base64

    const fetchImageBase64 = async (url, isHf = false) => {
      const hfToken = process.env.HF_TOKEN;
      const headers = { 'User-Agent': 'Mozilla/5.0' };
      if (isHf) {
        headers['Content-Type'] = 'application/json';
        if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;
      }

      const response = await fetch(url, {
        method: isHf ? 'POST' : 'GET',
        headers,
        ...(isHf && { body: JSON.stringify({ inputs: prompt, parameters: { wait_for_model: true } }) }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error('Failed');
      const buffer = await response.arrayBuffer();
      return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
    };

    try {
      const seed = Math.floor(Math.random() * 1000000);
      const pollUrl = `${POLLINATIONS_URL}/${encodeURIComponent(prompt)}?width=512&height=512&seed=${seed}&nologo=true`;
      
      // Race HF and Pollinations (Backend Fetch)
      const base64 = await Promise.any([
        fetchImageBase64(HF_API, true),
        fetchImageBase64(pollUrl, false)
      ]);

      clearTimeout(timeoutId);
      console.log('[Poster] Success (Base64)');
      return res.json({ image: base64 });
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('[Poster] High-quality attempts failed or timed out, returning direct URL.');
    }

    // FINAL FALLBACK: Direct URL (Instant, no backend wait)
    const seed = Math.floor(Math.random() * 1000000);
    const finalUrl = `${POLLINATIONS_URL}/${encodeURIComponent(prompt)}?width=768&height=768&seed=${seed}&nologo=true`;
    res.json({ image: finalUrl });

  } catch (error) {
    console.error('[Poster Error]:', error.message);
    res.status(500).json({ error: 'Generation failed.' });
  }
};
