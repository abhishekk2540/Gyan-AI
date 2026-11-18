import { analyzeImage } from '../services/llmService.js';

export const visionRouter = async (req, res) => {
  try {
    const { image, prompt } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    console.log(`[Vision] Analyzing image (${(image.length / 1024).toFixed(1)} KB)...`);

    // The 'image' field is expected to be a Base64 string (without the data:image/jpeg;base64, prefix)
    const description = await analyzeImage(image, typeof prompt === 'string' ? prompt.trim() || undefined : undefined);

    res.json({ description });
  } catch (error) {
    console.error('[Vision Route Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze image' });
  }
};
