const { findOrderBySessionId, updateOrderRecord, uploadAttachment } = require('./_lib/airtable');
const { ROUNDS_LIMIT, PALETTES, FONT_PAIRS } = require('./_lib/design-presets');

// Both regexes target the CSS rule shape the generation prompt always
// produces (h1-h4 selector, body selector), not the current font name -
// that makes repeat rounds idempotent without needing to know what the
// previous font pair was.
function applyPalette(html, paletteId) {
  const palette = PALETTES.find((p) => p.id === paletteId);
  if (!palette) return html;
  let out = html;
  for (const [varName, hex] of Object.entries(palette.colors)) {
    const re = new RegExp(`(--${varName}\\s*:\\s*)#[0-9a-fA-F]{3,8}`, 'g');
    out = out.replace(re, `$1${hex}`);
  }
  return out;
}

function applyFontPair(html, fontId) {
  const pair = FONT_PAIRS.find((f) => f.id === fontId);
  if (!pair) return html;
  let out = html;
  out = out.replace(/(h1,\s*h2,\s*h3,\s*h4\s*\{[^}]*font-family:\s*')[^']+(')/, `$1${pair.heading}$2`);
  out = out.replace(/(body\s*\{[^}]*font-family:\s*')[^']+(')/, `$1${pair.body}$2`);
  out = out.replace(/href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"/, `href="${pair.googleFontsHref}"`);
  return out;
}

exports.applyPalette = applyPalette;
exports.applyFontPair = applyFontPair;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { sessionId, paletteId, fontId, photos } = body;
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId' }) };
  }
  if (!paletteId && !fontId && !(Array.isArray(photos) && photos.length)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Nothing to apply' }) };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('self-serve-edit lookup failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Lookup failed' }) };
  }
  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  const roundsUsed = record.fields['Self-Serve Rounds Used'] || 0;
  if (roundsUsed >= ROUNDS_LIMIT) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'limit_reached', roundsUsed, roundsLimit: ROUNDS_LIMIT }),
    };
  }

  const currentHtml = record.fields['Draft HTML'];
  if (!currentHtml) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Draft not ready yet' }) };
  }

  let html = currentHtml;
  if (paletteId) html = applyPalette(html, paletteId);
  if (fontId) html = applyFontPair(html, fontId);

  try {
    if (Array.isArray(photos)) {
      for (const photo of photos) {
        if (!photo || !photo.slotId || !photo.base64 || !photo.contentType) continue;
        const ext = (photo.filename || '').split('.').pop() || 'jpg';
        await uploadAttachment(record.id, 'Self-Serve Photos', {
          contentType: photo.contentType,
          file: photo.base64,
          filename: `slot-${photo.slotId}.${ext}`,
        });
      }
    }

    const newRoundsUsed = roundsUsed + 1;
    await updateOrderRecord(record.id, {
      'Draft HTML': html,
      'Self-Serve Rounds Used': newRoundsUsed,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        roundsUsed: newRoundsUsed,
        roundsLimit: ROUNDS_LIMIT,
        roundsRemaining: ROUNDS_LIMIT - newRoundsUsed,
      }),
    };
  } catch (err) {
    console.error('self-serve-edit apply failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to apply changes' }) };
  }
};
