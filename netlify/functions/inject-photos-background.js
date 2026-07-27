const { findOrderBySessionId, updateOrderRecord } = require('./_lib/airtable');
const { deployLiveSite } = require('./_lib/netlify-deploy');
const { injectGeneratedPhotos } = require('./_lib/inject-photos');
const { getEnv } = require('./_lib/env');

// Background function (Netlify's "-background" suffix -> up to 15 min,
// invoked fire-and-forget from choose-draft-variation.js) that generates a
// real photo per [PLACEHOLDER] slot via Gemini and redeploys the site once
// done. Split out from choose-draft-variation.js because generating ~5-9
// images sequentially blew past the sync function time limit.
exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    console.error('Invalid JSON payload to inject-photos-background');
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { sessionId } = payload;
  if (!sessionId) {
    console.error('Missing sessionId in inject-photos-background');
    return { statusCode: 400, body: 'Missing sessionId' };
  }

  try {
    const record = await findOrderBySessionId(sessionId);
    if (!record) {
      console.error('inject-photos-background: order not found for session', sessionId);
      return { statusCode: 200, body: 'ok' };
    }

    const currentHtml = record.fields['Draft HTML'];
    if (!currentHtml) {
      return { statusCode: 200, body: 'ok' };
    }

    let answers = {};
    try {
      answers = JSON.parse(record.fields['Answers'] || '{}');
    } catch {
      // ignore malformed/missing Answers JSON, brandContext just falls back below
    }
    const brandContext = `Business: ${answers.projectName || record.fields['Customer Name'] || 'this business'}. Visual style: ${answers.style || 'clean and professional'}.`;

    const newHtml = await injectGeneratedPhotos(currentHtml, record, brandContext);
    if (newHtml === currentHtml) {
      // Nothing changed (no GEMINI_API_KEY, no slots matched, or every
      // generation failed) - skip the write/redeploy entirely.
      return { statusCode: 200, body: 'ok' };
    }

    await updateOrderRecord(record.id, { 'Draft HTML': newHtml });

    try {
      await deployLiveSite(record, newHtml);
    } catch (deployErr) {
      console.error('inject-photos-background redeploy failed:', deployErr.message);
    }
  } catch (err) {
    console.error('inject-photos-background failed:', err.message);
  }

  return { statusCode: 200, body: 'ok' };
};
