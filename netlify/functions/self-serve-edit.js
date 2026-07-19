const { findOrderBySessionId, updateOrderRecord, uploadAttachment } = require('./_lib/airtable');
const { ROUNDS_LIMIT, PALETTES, FONT_PAIRS } = require('./_lib/design-presets');
const { deployLiveSite } = require('./_lib/netlify-deploy');
const { sendNotification } = require('./_lib/email');
const { injectPhotoUrls } = require('./preview-draft');

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

  const { sessionId, paletteId, fontId, photos, changeText } = body;
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId' }) };
  }
  if (!paletteId && !fontId && !(Array.isArray(photos) && photos.length) && !changeText) {
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

  // Free-text requests need a Claude call, which can run past Netlify's sync
  // function time limit - hand those off to a background function (same
  // pattern as request-revision.js -> revise-draft-background.js) instead of
  // blocking this response. Palette/font/photo-only rounds stay synchronous
  // below since they're just string swaps, no AI call needed.
  if (changeText) {
    try {
      await updateOrderRecord(record.id, { 'Draft Status': 'Self-Editing' });
      const siteUrl = process.env.URL || `https://${event.headers.host}`;
      await fetch(`${siteUrl}/.netlify/functions/self-serve-edit-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, paletteId, fontId, photos, changeText }),
      });
    } catch (err) {
      console.error('Failed to trigger self-serve-edit-background:', err.message);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to start' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, processing: true }),
    };
  }

  let html = currentHtml;
  if (paletteId) html = applyPalette(html, paletteId);
  if (fontId) html = applyFontPair(html, fontId);

  try {
    if (Array.isArray(photos)) {
      // Airtable attachment URLs are signed and expire, so - same as the
      // GrapesJS photo-proxy path - never embed one directly into the HTML
      // that gets deployed as a static file. preview-draft.js/get-draft.js
      // re-resolve data-wc-photo slots to a fresh Airtable URL on every
      // request, which is fine for those function-served pages, but the
      // static deployLiveSite() snapshot below has no request-time logic to
      // do that - without baking in a stable URL here, the deployed site
      // permanently shows the empty placeholder slot even though the photo
      // uploaded successfully (confirmed live: preview-draft.js showed the
      // photo, the deployed customer-facing link never did).
      const siteUrl = process.env.URL || `https://${event.headers.host}`;
      const proxyUrls = {};
      for (const photo of photos) {
        if (!photo || !photo.slotId || !photo.base64 || !photo.contentType) continue;
        const ext = (photo.filename || '').split('.').pop() || 'jpg';
        const filename = `slot-${photo.slotId}.${ext}`;
        await uploadAttachment(record.id, 'Self-Serve Photos', {
          contentType: photo.contentType,
          file: photo.base64,
          filename,
        });
        proxyUrls[photo.slotId] = `${siteUrl}/.netlify/functions/photo-proxy?session=${encodeURIComponent(sessionId)}&filename=${encodeURIComponent(filename)}`;
      }
      if (Object.keys(proxyUrls).length) {
        html = injectPhotoUrls(html, proxyUrls);
      }
    }

    const newRoundsUsed = roundsUsed + 1;
    await updateOrderRecord(record.id, {
      'Draft HTML': html,
      'Self-Serve Rounds Used': newRoundsUsed,
    });

    try {
      const { liveUrl, isFirstDeploy } = await deployLiveSite(record, html);
      if (isFirstDeploy) {
        await sendNotification(
          `Site is live: ${record.fields['Customer Name'] || 'customer'}`,
          `<h2>Customer site is now live</h2><p><a href="${liveUrl}">${liveUrl}</a></p>`
        );
      }
    } catch (err) {
      console.error('Live site deploy failed:', err.message);
    }

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
