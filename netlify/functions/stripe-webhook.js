const Stripe = require('stripe');
const { getEnv } = require('./_lib/env');
const { sendNotification, sendEmail } = require('./_lib/email');

const PRICE_TO_PACKAGE = {
  price_1TphB7JM2u2WIzsFKS2pdpUT: 'Basic',
  price_1TphBFJM2u2WIzsFg5BByaJO: 'Business',
  price_1TphDPJM2u2WIzsF3ixJVTz4: 'Portfolio',
  price_1TphBMJM2u2WIzsFK9zUxSLp: 'Maintenance',
};

const AIRTABLE_BASE_ID = 'appv7AQg99c5GqdTU';
const AIRTABLE_TABLE_ID = 'tblYF1s42rbE88ZYJ';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const stripe = Stripe(getEnv('STRIPE_SECRET_KEY'));

  const sig = event.headers['stripe-signature'];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      getEnv('STRIPE_WEBHOOK_SECRET')
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'Event ignored' };
  }

  const session = stripeEvent.data.object;

  // Retrieve full session with line_items to resolve price → package
  let fullSession;
  try {
    fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items'],
    });
  } catch (err) {
    console.error('Failed to retrieve Stripe session:', err.message);
    return { statusCode: 500, body: 'Failed to retrieve session' };
  }

  const customerName = session.customer_details?.name || 'Unknown';
  const email = session.customer_details?.email || '';
  const sessionId = session.id;
  const priceId = fullSession.line_items?.data?.[0]?.price?.id;
  const packageName = PRICE_TO_PACKAGE[priceId] || 'Unknown';
  const today = new Date().toISOString().split('T')[0];

  // Create Airtable record
  try {
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getEnv('AIRTABLE_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          typecast: true,
          fields: {
            'Customer Name': customerName,
            Email: email,
            Package: packageName,
            'Payment Status': 'Paid',
            'Form Status': 'Waiting',
            'Draft Status': 'Queued',
            'Stripe Session ID': sessionId,
            Date: today,
          },
        }),
      }
    );

    if (!airtableRes.ok) {
      const errText = await airtableRes.text();
      console.error('Airtable error:', errText);
      return { statusCode: 500, body: 'Failed to create Airtable record' };
    }
  } catch (err) {
    console.error('Airtable request failed:', err.message);
    return { statusCode: 500, body: 'Airtable request failed' };
  }

  // Ask about a custom domain upfront, right after checkout, rather than
  // waiting until the site is finished - not just a Business-package perk
  // (Basic/Portfolio customers can want a real domain too), so this goes to
  // everyone. Wording differs slightly since domain handling is a built-in
  // part of the Business package but an optional add-on for the others.
  if (email) {
    // Deliberately no example domain text (e.g. "yourbusiness.com.au") -
    // Gmail and other clients auto-linkify any plausible-looking domain
    // string even without an <a> tag, and if that string happens to be a
    // real registered/parked domain, the "example" becomes a live,
    // misleading link (confirmed live 2026-07-29).
    const domainParagraph = packageName === 'Business'
      ? `<p>Since you're on the Business package, we handle registering a custom domain for you (a proper .com.au address) — the registration itself is billed separately (typically $20–$80 AUD/year, depending on the name). If you already know the name you'd like, just reply to this email and let us know — we'll check availability and send you a price.</p>`
      : `<p>By the way — if you'd like a custom domain of your own (a proper .com.au address) instead of the free address your site will launch on, just reply and let us know the name you have in mind. We'll check availability and send you a price (typically $20–$80 AUD/year).</p>`;

    await sendEmail({
      to: email,
      replyTo: getEnv('RESEND_FROM_EMAIL'),
      subject: 'Welcome to WebCloud! Quick question about your domain 🌐',
      html: `
        <h2>Welcome to WebCloud! 🎉</h2>
        <p>Thanks so much for signing up, ${customerName} — we're already getting started on your site.</p>
        ${domainParagraph}
        <p>No rush — you can also decide this later once your draft is ready. We just like to get it sorted early so it's live by the time your site is!</p>
        <p>— <a href="https://webcloudsolutions.com.au">The WebCloud team</a></p>
      `,
    });
  }

  await sendNotification(
    `New order: ${packageName} from ${customerName}`,
    `
      <h2>New WebCloud Order</h2>
      <table cellpadding="8" style="border-collapse:collapse">
        <tr><td><strong>Package</strong></td><td>${packageName}</td></tr>
        <tr><td><strong>Customer</strong></td><td>${customerName}</td></tr>
        <tr><td><strong>Email</strong></td><td>${email}</td></tr>
        <tr><td><strong>Session ID</strong></td><td>${sessionId}</td></tr>
        <tr><td><strong>Date</strong></td><td>${today}</td></tr>
      </table>
    `
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true, package: packageName }),
  };
};
