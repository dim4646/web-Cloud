// Netlify's newer runtime only exposes "secret"-marked env vars through the
// global `Netlify.env` API, not `process.env` - so prefer that when present
// and fall back to `process.env` for local/CLI runs where it isn't defined.
function getEnv(key) {
  if (typeof Netlify !== 'undefined' && Netlify.env && typeof Netlify.env.get === 'function') {
    const value = Netlify.env.get(key);
    if (value !== undefined) return value;
  }
  return process.env[key];
}

module.exports = { getEnv };
