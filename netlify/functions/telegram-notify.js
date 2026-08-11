const { getEnv } = require('./_lib/env');

// Netlify Forms "outgoing webhook" notification POSTs a JSON payload here
// on every new form submission. We reformat it as a Telegram message and
// send it via the Bot API's sendMessage endpoint.
//
// Required environment variables (Site settings -> Environment variables):
//   TELEGRAM_BOT_TOKEN  - token from @BotFather
//   TELEGRAM_CHAT_ID    - your personal or group chat id

function escapeHtml(str) {
  return String(str || '').replace(/[&<>]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]
  ));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const token = getEnv('TELEGRAM_BOT_TOKEN');
  const chatId = getEnv('TELEGRAM_CHAT_ID');
  if (!token || !chatId) {
    console.error('telegram-notify: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return { statusCode: 500, body: 'Telegram not configured' };
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

  const lines = [
    `<b>New enquiry — ${escapeHtml(formName)}</b>`,
    ...Object.entries(fields).map(
      ([key, value]) => `<b>${escapeHtml(key)}:</b> ${escapeHtml(value)}`
    ),
  ];
  const text = lines.join('\n').slice(0, 4000); // Telegram message limit safety margin

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('telegram-notify: Telegram API error', res.status, errText);
      return { statusCode: 502, body: 'Telegram send failed' };
    }
  } catch (err) {
    console.error('telegram-notify: fetch failed', err.message);
    return { statusCode: 502, body: 'Telegram send failed' };
  }

  return { statusCode: 200, body: 'ok' };
};
