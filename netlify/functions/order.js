const { findOrderBySessionId } = require('./_lib/airtable');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id' }) };
  }

  const record = await findOrderBySessionId(sessionId);
  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  const f = record.fields;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      package: f.Package || null,
      customerName: f['Customer Name'] || null,
      formStatus: f['Form Status'] || null,
      draftStatus: f['Draft Status'] || null,
      draftUrl: f['Draft URL'] || null,
    }),
  };
};
