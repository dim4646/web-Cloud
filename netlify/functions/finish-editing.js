const { findOrderBySessionId } = require('./_lib/airtable');
const { sendEmail } = require('./_lib/email');

// Customer-triggered "I'm happy with this" confirmation - the pipeline never
// otherwise emails the customer their own final link (only Dimos gets
// owner-facing notifications), so someone who closes the tab after editing
// has no way to find their site again unless they email it to themselves.
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

  const { sessionId } = body;
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId' }) };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('finish-editing lookup failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Lookup failed' }) };
  }
  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  const customerEmail = record.fields['Email'];
  const siteUrl = process.env.URL || `https://${event.headers.host}`;
  const finalUrl = record.fields['Live Site URL']
    || `${siteUrl}/.netlify/functions/preview-draft?session_id=${encodeURIComponent(sessionId)}`;

  if (!customerEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No customer email on file' }) };
  }

  await sendEmail({
    to: customerEmail,
    subject: `Your website is ready — ${record.fields['Customer Name'] || 'WebCloud'}`,
    html: `
      <h2>Your site is ready 🎉</h2>
      <p>Here's your permanent link — this is your website's real, final address:</p>
      <p><a href="${finalUrl}">${finalUrl}</a></p>
      <p>Bookmark this page so you don't lose it. If you want to make more changes later, just come back to this link.</p>
      <p>Need any further edits, updates, or have a question? Just reach out to our team at <a href="mailto:notifications@webcloudsolutions.com.au">notifications@webcloudsolutions.com.au</a> — happy to help.</p>
      <p>— The WebCloud team</p>
    `,
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
