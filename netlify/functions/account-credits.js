const { getEnv } = require('./_lib/env');

// Exposes Netlify account credit usage for the lab monitoring report on the
// Raspberry Pi - reuses the NETLIFY_API_TOKEN already configured for site
// auto-deploy instead of needing a second copy of a Netlify credential
// stored on the Pi. Gated by ADMIN_KEY since it reveals account billing info.
exports.handler = async (event) => {
  if (event.queryStringParameters?.key !== getEnv('ADMIN_KEY')) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Invalid key' }) };
  }

  const res = await fetch('https://api.netlify.com/api/v1/accounts', {
    headers: { Authorization: `Bearer ${getEnv('NETLIFY_API_TOKEN')}` },
  });
  if (!res.ok) {
    return { statusCode: 502, body: JSON.stringify({ error: `Netlify API failed: ${res.status}` }) };
  }
  const accounts = await res.json();
  const acc = accounts[0];
  const credits = acc?.capabilities?.credits || {};

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan: acc?.type_name,
      creditsIncluded: credits.included,
      creditsUsed: credits.used,
      creditsRemaining: (credits.included ?? 0) - (credits.used ?? 0),
      periodStart: acc?.current_usage_period_start,
      periodEnd: acc?.next_usage_period_start,
    }),
  };
};
