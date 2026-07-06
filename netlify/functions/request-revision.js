const { findOrderBySessionId, updateOrderRecord } = require('./_lib/airtable');

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

  const { sessionId, revisionText } = body;
  if (!sessionId || !revisionText) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId or revisionText' }) };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('request-revision lookup failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Lookup failed' }) };
  }

  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  try {
    await updateOrderRecord(record.id, {
      'Draft Status': 'Revising',
      'Revision Request': revisionText,
    });
  } catch (err) {
    console.error('request-revision update failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Update failed' }) };
  }

  // Await the initial 202 Accepted response (not the background work itself)
  // - an un-awaited fetch can get cut off before the request is actually
  // sent, since Netlify may freeze the execution environment as soon as
  // this handler returns.
  const siteUrl = process.env.URL || `https://${event.headers.host}`;
  try {
    await fetch(`${siteUrl}/.netlify/functions/revise-draft-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  } catch (err) {
    console.error('Failed to trigger revision generation:', err.message);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
