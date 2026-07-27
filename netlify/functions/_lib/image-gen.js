const { getEnv } = require('./env');

// The old Imagen predict-style models (imagen-3.x/4.x) either 404 or are
// blocked for new API keys - gemini-2.5-flash-image is the current
// generally-available image model, called through generateContent like any
// other Gemini model rather than the separate :predict endpoint.
const MODEL = 'gemini-2.5-flash-image';

// Generates a single photorealistic image from a text prompt via Gemini's
// image-generation model. Returns { base64, contentType } or throws -
// callers are expected to wrap this in try/catch and fall back to leaving
// the existing [PLACEHOLDER] text untouched on failure, same pattern as
// deployLiveSite's "never break the customer-facing flow" approach.
async function generateImage(prompt) {
  const apiKey = getEnv('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Gemini image request failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    throw new Error('Gemini response contained no image data');
  }
  return {
    base64: imagePart.inlineData.data,
    contentType: imagePart.inlineData.mimeType || 'image/png',
  };
}

module.exports = { generateImage };
