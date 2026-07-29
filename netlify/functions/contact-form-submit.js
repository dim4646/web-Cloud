const { findOrderBySessionId } = require('./_lib/airtable');
const { sendEmail } = require('./_lib/email');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Handles the "Send a Message" contact form on customer-generated sites.
// Those sites live on a different origin (*.netlify.app or the customer's
// own domain) from webcloudsolutions.com.au, never this one, so CORS is
// required. Looks up the destination address from the order record by
// sessionId rather than trusting a client-supplied "to" - otherwise this
// endpoint would be an open relay anyone could point at any address.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { sessionId, name, email, message } = body;
  if (!sessionId || !message) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing sessionId or message' }) };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('contact-form-submit lookup failed:', err.message);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Lookup failed' }) };
  }
  if (!record || !record.fields['Email']) {
    return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Order not found' }) };
  }

  const visitorEmail = typeof email === 'string' && EMAIL_RE.test(email.trim()) ? email.trim() : undefined;

  try {
    await sendEmail({
      to: record.fields['Email'],
      replyTo: visitorEmail,
      subject: `New message from your website${name ? ` — ${name}` : ''}`,
      html: `
        <h2>New message from your website's contact form</h2>
        <p><strong>Name:</strong> ${escapeHtml(name) || '(not provided)'}</p>
        <p><strong>Email:</strong> ${escapeHtml(email) || '(not provided)'}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `,
    });
  } catch (err) {
    console.error('contact-form-submit send failed:', err.message);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Failed to send' }) };
  }

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
};
