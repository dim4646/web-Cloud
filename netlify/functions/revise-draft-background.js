const Anthropic = require('@anthropic-ai/sdk');
const { findOrderBySessionId, updateOrderRecord } = require('./_lib/airtable');
const { getEnv } = require('./_lib/env');
const { sendNotification } = require('./_lib/email');

exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    console.error('Invalid JSON payload to revise-draft-background');
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { sessionId } = payload;
  if (!sessionId) {
    console.error('Missing sessionId in revise-draft-background');
    return { statusCode: 400, body: 'Missing sessionId' };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('revise-draft-background lookup failed:', err.message);
    return { statusCode: 500, body: 'Lookup failed' };
  }

  if (!record) {
    console.error('revise-draft-background: order not found for', sessionId);
    return { statusCode: 404, body: 'Order not found' };
  }

  const currentHtml = record.fields['Draft HTML'];
  const revisionRequest = record.fields['Revision Request'];

  if (!currentHtml || !revisionRequest) {
    console.error('revise-draft-background: missing current HTML or revision request');
    await updateOrderRecord(record.id, { 'Draft Status': 'Ready' }).catch(() => {});
    return { statusCode: 400, body: 'Missing current HTML or revision request' };
  }

  try {
    const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') });

    const prompt = `You are a web designer updating an existing single-page draft website based on client feedback.

Here is the current HTML of the site:
${currentHtml}

The client has requested this change:
"${revisionRequest}"

Apply the requested change(s) to the HTML above. Keep everything else (design, structure, other content, [PLACEHOLDER: ...] markers) exactly as it was unless the request implies otherwise. Return the complete, updated, self-contained HTML document.

Respond with ONLY the raw HTML, starting with <!DOCTYPE html> — no markdown code fences, no explanation before or after.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    let html = (message.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    html = html.replace(/```html\s*/gi, '').replace(/```\s*/g, '').trim();

    const docStart = html.search(/<!doctype html/i);
    const htmlStart = html.search(/<html[ >]/i);
    const start = docStart !== -1 ? docStart : htmlStart;

    if (start === -1) {
      throw new Error(
        `Model did not return an HTML document. stop_reason=${message.stop_reason}, raw=${html.slice(0, 300)}`
      );
    }
    html = html.slice(start);

    const siteUrl = getEnv('URL') || '';
    const adminKey = getEnv('ADMIN_KEY') || '';
    const previewUrl = `${siteUrl}/.netlify/functions/preview-pending?session_id=${encodeURIComponent(sessionId)}`;
    const approveUrl = `${siteUrl}/.netlify/functions/approve-revision?session_id=${encodeURIComponent(sessionId)}&key=${encodeURIComponent(adminKey)}`;
    await updateOrderRecord(record.id, {
      'Draft Status': 'Pending Review',
      'Pending HTML': html,
      'Pending Preview URL': previewUrl,
      'Approve URL': approveUrl,
    });

    await sendNotification(
      `Revision ready for review: ${record.fields['Customer Name'] || 'customer'}`,
      `
        <h2>Revision Ready for Review</h2>
        <table cellpadding="8" style="border-collapse:collapse">
          <tr><td><strong>Customer</strong></td><td>${record.fields['Customer Name'] || ''}</td></tr>
          <tr><td><strong>Package</strong></td><td>${record.fields.Package || ''}</td></tr>
          <tr><td><strong>Requested change</strong></td><td>${revisionRequest}</td></tr>
        </table>
        <p><a href="${previewUrl}">Preview the revised draft</a></p>
        <p><a href="${approveUrl}">Approve &amp; go live</a></p>
      `
    );
  } catch (err) {
    console.error('Draft revision failed:', err.message);
    try {
      await updateOrderRecord(record.id, { 'Draft Status': 'Ready' });
    } catch (innerErr) {
      console.error('Failed to reset draft status after revision failure:', innerErr.message);
    }
  }

  return { statusCode: 200, body: 'ok' };
};
