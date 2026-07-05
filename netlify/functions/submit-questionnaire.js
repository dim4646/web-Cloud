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

  const { sessionId, answers } = body;
  if (!sessionId || !answers) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId or answers' }) };
  }

  const record = await findOrderBySessionId(sessionId);
  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  await updateOrderRecord(record.id, {
    'Form Status': 'Received',
    'Draft Status': 'Generating',
    Answers: JSON.stringify(answers, null, 2),
  });

  // Fire-and-forget: hand off to the background function, which has a much
  // higher execution time limit than this one needs for the AI call.
  const siteUrl = process.env.URL || `https://${event.headers.host}`;
  fetch(`${siteUrl}/.netlify/functions/generate-draft-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, answers, package: record.fields.Package }),
  }).catch((err) => console.error('Failed to trigger draft generation:', err.message));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
