const { getEnv } = require('./env');

const MODEL = 'imagen-3.0-generate-002';

// Generates a single photorealistic image from a text prompt via Google's
// Imagen model (Gemini API). Returns { base64, contentType } or throws -
// callers are expected to wrap this in try/catch and fall back to leaving
// the existing [PLACEHOLDER] text untouched on failure, same pattern as
// deployLiveSite's "never break the customer-facing flow" approach.
async function generateImage(prompt) {
  const apiKey = getEnv('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '4:3' },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Imagen request failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }
  const data = await res.json();
  const prediction = data.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error('Imagen response missing image bytes');
  }
  return {
    base64: prediction.bytesBase64Encoded,
    contentType: prediction.mimeType || 'image/png',
  };
}

module.exports = { generateImage };
