const { findOrderBySessionId, updateOrderRecord } = require('./_lib/airtable');
const { ROUNDS_LIMIT } = require('./_lib/design-presets');
const { getEnv } = require('./_lib/env');

// Entry point for the "🔄 regenerate" photo-slot button in preview-draft.js.
// A single Imagen/Gemini call is usually quick, but latency is variable
// enough (and this reuses the same rounds-limited self-serve economy as
// palette/font/text edits) that it follows the same hand-off-to-background
// pattern as self-serve-edit.js's changeText path rather than blocking here.
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

  const { sessionId, slotId } = body;
  if (!sessionId || !slotId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId or slotId' }) };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('regenerate-photo lookup failed:', err.message);
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

  try {
    // Round is only actually consumed by the background function on success
    // (mirrors self-serve-edit-background.js: "a failed attempt shouldn't
    // cost the customer one of their free rounds").
    await updateOrderRecord(record.id, { 'Draft Status': 'Self-Editing' });
    const siteUrl = getEnv('URL') || `https://${event.headers.host}`;
    await fetch(`${siteUrl}/.netlify/functions/regenerate-photo-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, slotId }),
    });
  } catch (err) {
    console.error('Failed to trigger regenerate-photo-background:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to start' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, processing: true }),
  };
};
