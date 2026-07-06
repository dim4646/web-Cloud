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

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('submit-questionnaire lookup failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Lookup failed' }) };
  }

  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  const isMaintenance = record.fields.Package === 'Maintenance';

  try {
    await updateOrderRecord(record.id, {
      'Form Status': 'Received',
      ...(isMaintenance ? {} : { 'Draft Status': 'Generating' }),
      Answers: JSON.stringify(answers, null, 2),
    });
  } catch (err) {
    console.error('submit-questionnaire update failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Update failed' }) };
  }

  // Maintenance is for an existing site - there's nothing to draft, so skip
  // triggering the AI generation entirely.
  if (!isMaintenance) {
    // Hand off to the background function, which has a much higher execution
    // time limit than this one needs for the AI call. We only await the
    // initial 202 Accepted response (not the background work itself) -
    // awaiting is required because an un-awaited fetch can get cut off
    // before the request is actually sent, since Netlify may freeze the
    // execution environment as soon as this handler returns.
    const siteUrl = process.env.URL || `https://${event.headers.host}`;
    try {
      await fetch(`${siteUrl}/.netlify/functions/generate-draft-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, answers, package: record.fields.Package }),
      });
    } catch (err) {
      console.error('Failed to trigger draft generation:', err.message);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
