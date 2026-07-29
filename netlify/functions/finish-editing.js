const { findOrderBySessionId } = require('./_lib/airtable');
const { sendEmail } = require('./_lib/email');
const { getEnv } = require('./_lib/env');
const { ROUNDS_LIMIT } = require('./_lib/design-presets');

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
  const startUrl = `${siteUrl}/start.html?session_id=${encodeURIComponent(sessionId)}`;

  if (!customerEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No customer email on file' }) };
  }

  const roundsUsed = record.fields['Self-Serve Rounds Used'] || 0;
  const roundsRemaining = Math.max(0, ROUNDS_LIMIT - roundsUsed);
  // mshots (WordPress's free screenshot service) permanently 403s on
  // *.netlify.app domains specifically (works fine on real custom domains) -
  // confirmed 2026-07-29. thum.io doesn't block Netlify's own subdomains.
  // thum.io caches screenshots per-URL for 24h, so a bogus query param is
  // appended to the target URL (harmless - the static site ignores unknown
  // params) purely to bust that cache: without it, re-sending this email
  // after the customer edits their site would show the old screenshot from
  // whenever thum.io first rendered that URL - confirmed live 2026-07-29.
  const cacheBustedUrl = `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
  const screenshotUrl = `https://image.thum.io/get/width/1200/${cacheBustedUrl}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(finalUrl)}`;

  // Not just a Business-package perk - any customer might want a real domain
  // instead of their *.netlify.app link, so offer it to everyone here.
  // Deliberately no example domain text here (e.g. "yourbusiness.com.au") -
  // Gmail and other clients auto-linkify any plausible-looking domain string
  // even without an <a> tag, and if that string happens to be a real
  // registered/parked domain, the "example" becomes a live, misleading link.
  const domainCta = `<p>🌐 Want a custom domain of your own — a proper .com.au address — instead of the address above? Just reply and tell us the name you have in mind, and we'll check availability and send you a price!</p>`;

  await sendEmail({
    to: customerEmail,
    replyTo: getEnv('RESEND_FROM_EMAIL'),
    subject: `Your website is ready 🎉 — ${record.fields['Customer Name'] || 'WebCloud'}`,
    html: `
      <h2>Your website is ready! 🎉</h2>
      <p>Thank you so much for choosing WebCloud — we're excited for you to see it.</p>
      <p><a href="${finalUrl}"><img src="${screenshotUrl}" alt="Preview of your site" style="max-width:100%;border:1px solid #e2e2e2;border-radius:8px;" /></a></p>
      <p>Here's your permanent link — this is your website's real, final address:</p>
      <p><a href="${finalUrl}">${finalUrl}</a></p>
      <p>Bookmark this page so you don't lose it.</p>
      <p><img src="${qrCodeUrl}" alt="QR code linking to your site" width="140" height="140" style="border:1px solid #e2e2e2;border-radius:8px;padding:8px;" /><br><span style="font-size:0.85em;color:#5A6478;">Scan to open your site on your phone</span></p>
      <p>You have <b>${roundsRemaining} of ${ROUNDS_LIMIT}</b> free self-serve edits left (colors, fonts, wording, photos) — just open your project page to use them.</p>
      ${domainCta}
      <p>Need anything else, or have a question? Just reply to this email, or head to <a href="${startUrl}">your project page</a> and use the "Want something changed?" box — either way it reaches us directly.</p>
      <p>Thanks again for trusting us with your site!<br>— <a href="https://webcloudsolutions.com.au">The WebCloud team</a></p>
    `,
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
