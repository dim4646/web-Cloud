const { getEnv } = require('./_lib/env');

// Netlify Forms "outgoing webhook" notification POSTs a JSON payload here
// on every new form submission. We reformat it as a Slack message and
// send it via an Incoming Webhook URL.
//
// Required environment variable (Site settings -> Environment variables):
//   SLACK_WEBHOOK_URL  - default Incoming Webhook URL from https://api.slack.com/apps
//
// Optional per-form overrides, so different sites/forms can post to
// different Slack channels (each channel needs its own Incoming Webhook URL):
//   SLACK_WEBHOOK_URL_IT_ENQUIRY  - used when form_name is "it-enquiry"
const FORM_WEBHOOK_ENV = {
  'it-enquiry': 'SLACK_WEBHOOK_URL_IT_ENQUIRY',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Netlify's outgoing webhook payload shape:
  // { form_name, human_fields: { Name, Email, ... }, ... }
  const formName = payload.form_name || payload.payload?.form_name || 'unknown form';
  const fields = payload.human_fields || payload.payload?.human_fields || payload.data || {};

  const webhookUrl = getEnv(FORM_WEBHOOK_ENV[formName]) || getEnv('SLACK_WEBHOOK_URL');
  if (!webhookUrl) {
    console.error(`slack-notify: no Slack webhook configured for form "${formName}"`);
    return { statusCode: 500, body: 'Slack not configured' };
  }

  const text = [
    `*New enquiry — ${formName}*`,
    ...Object.entries(fields).map(([key, value]) => `*${key}:* ${value}`),
  ].join('\n');

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('slack-notify: Slack API error', res.status, errText);
      return { statusCode: 502, body: 'Slack send failed' };
    }
  } catch (err) {
    console.error('slack-notify: fetch failed', err.message);
    return { statusCode: 502, body: 'Slack send failed' };
  }

  return { statusCode: 200, body: 'ok' };
};
