const { findOrderBySessionId } = require('./_lib/airtable');

// Airtable attachment URLs are signed and expire after a while, so we never
// embed one directly into saved Draft HTML. Instead the visual editor embeds
// this proxy's own stable URL, and this function looks up a fresh Airtable
// URL on every request and redirects to it - same fix-expiry approach as the
// data-wc-photo slot system, but keyed by filename instead of a slot number
// so it works for arbitrary images added via the GrapesJS canvas.
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sessionId = event.queryStringParameters?.session;
  const filename = event.queryStringParameters?.filename;
  if (!sessionId || !filename) {
    return { statusCode: 400, body: 'Missing session or filename' };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('photo-proxy lookup failed:', err.message);
    return { statusCode: 500, body: 'Lookup failed' };
  }
  if (!record) {
    return { statusCode: 404, body: 'Order not found' };
  }

  const attachments = record.fields['Self-Serve Photos'] || [];
  const match = attachments.find((a) => a.filename === filename);
  if (!match) {
    return { statusCode: 404, body: 'Photo not found' };
  }

  return {
    statusCode: 302,
    headers: { Location: match.url },
    body: '',
  };
};
