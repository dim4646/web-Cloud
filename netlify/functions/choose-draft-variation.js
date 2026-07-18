const { findOrderBySessionId, updateOrderRecord } = require('./_lib/airtable');
const { getEnv } = require('./_lib/env');
const { deployLiveSite } = require('./_lib/netlify-deploy');
const { sendNotification } = require('./_lib/email');

const FIELD_BY_INDEX = {
  1: 'Draft Variation 1',
  2: 'Draft Variation 2',
  3: 'Draft Variation 3',
};

// Promotes one of the three generated variations to be the customer's real
// "Draft HTML" - from here on it's a normal draft (self-serve editing,
// visual editor, revisions all operate on this same field like before).
// This is also where the first real hosting deploy happens, since there's
// no point deploying all 3 unpicked variations.
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

  const { sessionId, variation } = body;
  const field = FIELD_BY_INDEX[variation];
  if (!sessionId || !field) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId or invalid variation' }) };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('choose-draft-variation lookup failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Lookup failed' }) };
  }
  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  const html = record.fields[field];
  if (!html) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Variation not found or not ready yet' }) };
  }

  try {
    const siteUrl = getEnv('URL') || `https://${event.headers.host}`;
    await updateOrderRecord(record.id, {
      'Draft Status': 'Ready',
      'Draft HTML': html,
      'Draft URL': `${siteUrl}/.netlify/functions/preview-draft?session_id=${encodeURIComponent(sessionId)}`,
    });

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

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('choose-draft-variation update failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save choice' }) };
  }
};
