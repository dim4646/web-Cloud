const { findOrderBySessionId, uploadAttachment } = require('./_lib/airtable');

// Uploads an image from the GrapesJS visual editor. Reuses the same
// Airtable "Self-Serve Photos" attachment field the camera-icon self-serve
// flow already uses, but with a unique filename (not the slot-N convention,
// since these images aren't tied to a fixed data-wc-photo slot) so multiple
// visual-editor uploads coexist. Returns this site's own stable photo-proxy
// URL rather than Airtable's signed URL, since the latter expires.
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

  const { sessionId, contentType, base64, filename } = body;
  if (!sessionId || !contentType || !base64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId, contentType, or base64' }) };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('visual-upload-photo lookup failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Lookup failed' }) };
  }
  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  const ext = (filename || '').split('.').pop() || 'jpg';
  const uniqueFilename = `visual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    await uploadAttachment(record.id, 'Self-Serve Photos', {
      contentType,
      file: base64,
      filename: uniqueFilename,
    });
  } catch (err) {
    console.error('visual-upload-photo upload failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Upload failed' }) };
  }

  const siteUrl = process.env.URL || `https://${event.headers.host}`;
  const proxyUrl = `${siteUrl}/.netlify/functions/photo-proxy?session=${encodeURIComponent(sessionId)}&filename=${encodeURIComponent(uniqueFilename)}`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: proxyUrl }),
  };
};
