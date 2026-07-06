const { getEnv } = require('./env');

// Non-fatal by design: a failed notification email should never block the
// order/draft/revision flow itself, so callers just await this and move on.
async function sendNotification(subject, html) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getEnv('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getEnv('RESEND_FROM_EMAIL'),
        to: [getEnv('NOTIFICATION_EMAIL')],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error('Resend error:', await res.text());
    }
  } catch (err) {
    console.error('Email request failed:', err.message);
  }
}

module.exports = { sendNotification };
