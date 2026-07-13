const { findOrderBySessionId } = require('./_lib/airtable');
const { resolvePhotoSlotUrls, injectPhotoUrls } = require('./preview-draft');

// Plain JSON fetch of the current draft HTML, with real photo URLs already
// resolved into it - used by visual-edit.html to load a canvas for GrapesJS.
// Deliberately does NOT inject the preview-draft.js floating widget script,
// since that widget doesn't belong inside the editable canvas itself.
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id' }) };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('get-draft lookup failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to look up draft' }) };
  }

  let html = record?.fields?.['Draft HTML'];
  if (!html) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Draft not found or not ready yet' }) };
  }

  const slotUrls = resolvePhotoSlotUrls(record.fields['Self-Serve Photos']);
  html = injectPhotoUrls(html, slotUrls);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  };
};
