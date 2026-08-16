const { findOrderBySessionId, updateOrderRecord } = require('./_lib/airtable');
const { sendNotification } = require('./_lib/email');

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// A lightweight change-request inbox for existing Maintenance customers -
// deliberately doesn't touch Draft Status/Revision Request, since those
// drive the AI draft-generation pipeline and Maintenance customers have no
// draft (their site lives outside WebCloud). Just logs the request and
// alerts the owner to action it manually.
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

  const { sessionId, websiteUrl, whatChanged, pageSection, newText, fileUrl, deadline, notes } = body;
  if (!sessionId || !whatChanged) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId or whatChanged' }) };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('maintenance-change-request lookup failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Lookup failed' }) };
  }
  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  const entryLines = [
    `--- ${new Date().toISOString()} ---`,
    `Website: ${websiteUrl || '(not given)'}`,
    `Change requested: ${whatChanged}`,
    pageSection ? `Page/section: ${pageSection}` : null,
    newText ? `New text: ${newText}` : null,
    fileUrl ? `Uploaded file: ${fileUrl}` : null,
    deadline ? `Deadline: ${deadline}` : null,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean);
  const entry = entryLines.join('\n');

  const existingLog = record.fields['Maintenance Change Requests'] || '';
  const updatedLog = existingLog ? `${existingLog}\n\n${entry}` : entry;

  try {
    await updateOrderRecord(record.id, { 'Maintenance Change Requests': updatedLog });
  } catch (err) {
    console.error('maintenance-change-request update failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Update failed' }) };
  }

  await sendNotification(
    `Maintenance change request: ${record.fields['Customer Name'] || 'customer'}`,
    `
      <h2>New maintenance change request</h2>
      <table cellpadding="8" style="border-collapse:collapse">
        <tr><td><strong>Customer</strong></td><td>${escapeHtml(record.fields['Customer Name'])}</td></tr>
        <tr><td><strong>Email</strong></td><td>${escapeHtml(record.fields['Email'])}</td></tr>
        <tr><td><strong>Website</strong></td><td>${escapeHtml(websiteUrl)}</td></tr>
        <tr><td><strong>Change requested</strong></td><td>${escapeHtml(whatChanged)}</td></tr>
        ${pageSection ? `<tr><td><strong>Page/section</strong></td><td>${escapeHtml(pageSection)}</td></tr>` : ''}
        ${newText ? `<tr><td><strong>New text</strong></td><td>${escapeHtml(newText)}</td></tr>` : ''}
        ${fileUrl ? `<tr><td><strong>Uploaded file</strong></td><td><a href="${fileUrl}">${escapeHtml(fileUrl)}</a></td></tr>` : ''}
        ${deadline ? `<tr><td><strong>Deadline</strong></td><td>${escapeHtml(deadline)}</td></tr>` : ''}
        ${notes ? `<tr><td><strong>Notes</strong></td><td>${escapeHtml(notes)}</td></tr>` : ''}
      </table>
    `
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
