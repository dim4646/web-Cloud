const { getDraftsStore } = require('./_lib/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return { statusCode: 400, body: 'Missing session_id' };
  }

  let html;
  try {
    const store = getDraftsStore();
    html = await store.get(sessionId, { type: 'text' });
  } catch (err) {
    console.error('preview-draft blob read failed:', err.message);
    return { statusCode: 500, body: 'Failed to read draft' };
  }

  if (!html) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Draft not found or not ready yet.',
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
};
