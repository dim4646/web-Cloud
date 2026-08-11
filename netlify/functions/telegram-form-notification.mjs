function escapeHtml(value) {
  return String(value || '').replace(/[&<>]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  })[character]);
}

function getEnv(name) {
  return Netlify.env.get(name);
}

export default {
  async formSubmitted(event) {
    const token = getEnv('TELEGRAM_BOT_TOKEN');
    const chatId = getEnv('TELEGRAM_CHAT_ID');

    if (!token || !chatId) {
      console.error('Telegram notification skipped: required environment variables are missing.');
      return;
    }

    const data = event.data || {};
    const name = escapeHtml(data.name || 'Not provided');
    const email = escapeHtml(data.email || 'Not provided');
    const message = escapeHtml(String(data.message || 'No message').slice(0, 2800));

    const text = [
      '<b>New WebCloud website enquiry</b>',
      '',
      `<b>Name:</b> ${name}`,
      `<b>Email:</b> ${email}`,
      '<b>Message:</b>',
      message,
    ].join('\n');

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error(`Telegram notification failed (${response.status}): ${details.slice(0, 500)}`);
    }
  },
};
