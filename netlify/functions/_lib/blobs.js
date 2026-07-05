const { getStore } = require('@netlify/blobs');
const { getEnv } = require('./env');

// Legacy (V1, `exports.handler`) functions don't get Netlify Blobs
// auto-configured the way the newer function format does - the site ID and
// an API token have to be supplied explicitly. Netlify injects them as a
// base64-encoded JSON blob in NETLIFY_BLOBS_CONTEXT for exactly this case.
function getDraftsStore() {
  const raw = getEnv('NETLIFY_BLOBS_CONTEXT');
  if (raw) {
    try {
      const ctx = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
      return getStore({
        name: 'drafts',
        siteID: ctx.siteID,
        token: ctx.token,
        edgeURL: ctx.edgeURL,
        uncachedEdgeURL: ctx.uncachedEdgeURL,
      });
    } catch (err) {
      console.error('Failed to parse NETLIFY_BLOBS_CONTEXT:', err.message);
    }
  }
  return getStore('drafts');
}

module.exports = { getDraftsStore };
