const Stripe = require('stripe');
const { getEnv } = require('./_lib/env');

const AIRTABLE_BASE_ID = 'appv7AQg99c5GqdTU';
const AIRTABLE_TABLE_ID = 'tblYF1s42rbE88ZYJ';

// Business-operations snapshot for the lab monitoring report - how many
// orders need attention right now, and recent Stripe payment activity.
// Gated by the same MONITOR_KEY as account-credits.js.
async function airtableCounts() {
  const headers = { Authorization: `Bearer ${getEnv('AIRTABLE_API_KEY')}` };
  const inProgressFormula = encodeURIComponent(
    "OR({Draft Status}='Queued',{Draft Status}='Generating',{Draft Status}='Choosing',{Draft Status}='Revising',{Draft Status}='Self-Editing')"
  );
  const pendingReviewFormula = encodeURIComponent("{Draft Status}='Pending Review'");

  const [inProgressRes, pendingReviewRes] = await Promise.all([
    fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${inProgressFormula}&fields%5B%5D=Draft%20Status`, { headers }),
    fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${pendingReviewFormula}&fields%5B%5D=Draft%20Status`, { headers }),
  ]);
  const [inProgress, pendingReview] = await Promise.all([inProgressRes.json(), pendingReviewRes.json()]);

  return {
    inProgress: (inProgress.records || []).length,
    pendingReview: (pendingReview.records || []).length,
  };
}

async function stripeSummary() {
  const stripe = Stripe(getEnv('STRIPE_SECRET_KEY'));
  const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const [balance, charges] = await Promise.all([
    stripe.balance.retrieve(),
    stripe.charges.list({ created: { gte: since }, limit: 100 }),
  ]);
  const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
  const currency = balance.available[0]?.currency?.toUpperCase() || '';
  const successfulLast7d = charges.data.filter((c) => c.status === 'succeeded').length;

  return { availableBalance: available, currency, successfulLast7d };
}

exports.handler = async (event) => {
  if (event.queryStringParameters?.key !== getEnv('MONITOR_KEY')) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Invalid key' }) };
  }

  const [airtable, stripe] = await Promise.allSettled([airtableCounts(), stripeSummary()]);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      airtable: airtable.status === 'fulfilled' ? airtable.value : null,
      stripe: stripe.status === 'fulfilled' ? stripe.value : null,
    }),
  };
};
