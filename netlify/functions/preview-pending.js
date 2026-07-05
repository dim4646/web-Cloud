const { findOrderBySessionId } = require('./_lib/airtable');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return { statusCode: 400, body: 'Missing session_id' };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('preview-pending lookup failed:', err.message);
    return { statusCode: 500, body: 'Failed to look up draft' };
  }

  const html = record?.fields?.['Pending HTML'];

  if (!html) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/plain' },
      body: 'No pending revision found.',
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
};
