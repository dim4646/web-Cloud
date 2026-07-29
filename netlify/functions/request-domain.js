const { findOrderBySessionId, updateOrderRecord } = require('./_lib/airtable');
const { sendNotification } = require('./_lib/email');

// Business-package-only: customer submits the domain name they want here.
// Deliberately semi-automatic (agreed 2026-07-13, built 2026-07-29) - no
// unattended real-money registrar API call against a card on file. This
// just records the request and emails Dimos a clickable VentraIP search
// link so he can check availability and register it himself with a click,
// same registrar webcloudsolutions.com.au itself uses.
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

  const { sessionId, domain } = body;
  const cleanDomain = (domain || '').trim();
  if (!sessionId || !cleanDomain) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId or domain' }) };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('request-domain lookup failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Lookup failed' }) };
  }
  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  if (record.fields['Package'] !== 'Business') {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Domain registration is only included with the Business package' }),
    };
  }

  try {
    await updateOrderRecord(record.id, {
      'Requested Domain': cleanDomain,
      'Domain Status': 'Requested',
    });

    const searchUrl = `https://www.ventraip.com.au/domain-name-search/?domain=${encodeURIComponent(cleanDomain)}`;
    const liveSiteUrl = record.fields['Live Site URL'];
    await sendNotification(
      `Domain requested: ${cleanDomain} (${record.fields['Customer Name'] || 'customer'})`,
      `<h2>Domain registration requested</h2>
       <p><strong>Customer:</strong> ${record.fields['Customer Name'] || 'unknown'}</p>
       <p><strong>Domain requested:</strong> ${cleanDomain}</p>
       <p><a href="${searchUrl}">Check availability &amp; register on VentraIP →</a></p>
       <p>Once registered, point DNS to the customer's live site${liveSiteUrl ? `: <a href="${liveSiteUrl}">${liveSiteUrl}</a>` : ' (not deployed yet)'}.</p>`
    );
  } catch (err) {
    console.error('request-domain failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to submit domain request' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
