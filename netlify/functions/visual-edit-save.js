const { findOrderBySessionId, updateOrderRecord } = require('./_lib/airtable');
const { deployLiveSite } = require('./_lib/netlify-deploy');
const { sendNotification } = require('./_lib/email');

// Saves HTML produced by the GrapesJS visual editor directly to Airtable.
// Deliberately bypasses ROUNDS_LIMIT and never calls the AI - direct
// manipulation of existing markup carries no generation cost, so it stays
// unlimited by design (unlike the AI free-text self-serve path).
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

  const { sessionId, html } = body;
  if (!sessionId || !html) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId or html' }) };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('visual-edit-save lookup failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Lookup failed' }) };
  }
  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  try {
    await updateOrderRecord(record.id, { 'Draft HTML': html });

    try {
      const { liveUrl, isFirstDeploy } = await deployLiveSite(record, html);
      if (isFirstDeploy) {
        await sendNotification(
          `Site is live: ${record.fields['Customer Name'] || 'customer'}`,
          `<h2>Customer site is now live</h2><p><a href="${liveUrl}">${liveUrl}</a></p>`
        );
      }
    } catch (deployErr) {
      console.error('Live site deploy failed:', deployErr.message);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('visual-edit-save update failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save changes' }) };
  }
};
