const { findOrderBySessionId } = require('./_lib/airtable');

const FIELD_BY_INDEX = {
  1: 'Draft Variation 1',
  2: 'Draft Variation 2',
  3: 'Draft Variation 3',
};

// Serves one of the three not-yet-chosen design variations, plain (no
// self-serve widget - that only gets injected once a variation is chosen
// and becomes the real "Draft HTML" via preview-draft.js).
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sessionId = event.queryStringParameters?.session_id;
  const variation = FIELD_BY_INDEX[event.queryStringParameters?.variation];
  if (!sessionId || !variation) {
    return { statusCode: 400, body: 'Missing or invalid session_id/variation' };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('preview-variation lookup failed:', err.message);
    return { statusCode: 500, body: 'Failed to look up draft' };
  }

  const html = record?.fields?.[variation];
  if (!html) {
    return { statusCode: 404, headers: { 'Content-Type': 'text/plain' }, body: 'Variation not found or not ready yet.' };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
};
