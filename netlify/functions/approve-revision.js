const { findOrderBySessionId, updateOrderRecord } = require('./_lib/airtable');
const { getEnv } = require('./_lib/env');

function htmlResponse(statusCode, message) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;">${message}</body></html>`,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sessionId = event.queryStringParameters?.session_id;
  const key = event.queryStringParameters?.key;

  if (!sessionId || !key) {
    return htmlResponse(400, 'Missing session_id or key.');
  }

  if (key !== getEnv('ADMIN_KEY')) {
    return htmlResponse(403, 'Invalid key.');
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('approve-revision lookup failed:', err.message);
    return htmlResponse(500, 'Lookup failed.');
  }

  if (!record) {
    return htmlResponse(404, 'Order not found.');
  }

  const pendingHtml = record.fields['Pending HTML'];
  if (!pendingHtml) {
    return htmlResponse(400, 'No pending revision to approve.');
  }

  try {
    await updateOrderRecord(record.id, {
      'Draft Status': 'Ready',
      'Draft HTML': pendingHtml,
      'Pending HTML': '',
      'Revision Request': '',
    });
  } catch (err) {
    console.error('approve-revision update failed:', err.message);
    return htmlResponse(500, 'Failed to approve.');
  }

  return htmlResponse(200, '&#9989; Approved — the change is now live on the customer\'s draft.');
};
