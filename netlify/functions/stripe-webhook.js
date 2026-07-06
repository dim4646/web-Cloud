const Stripe = require('stripe');
const { getEnv } = require('./_lib/env');
const { sendNotification } = require('./_lib/email');

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
