const crypto = require('crypto');
const { getEnv } = require('./env');
const { updateOrderRecord } = require('./airtable');

const API_BASE = 'https://api.netlify.com/api/v1';

function slugify(name) {
  const slug = (name || 'site')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'site';
}

async function netlifyFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getEnv('NETLIFY_API_TOKEN')}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Netlify API ${path} failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function createSite(customerName) {
  const suffix = crypto.randomBytes(3).toString('hex');
  const name = `wc-${slugify(customerName)}-${suffix}`;
  return netlifyFetch('/sites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

// Netlify's file-digest deploy flow: declare the file + its sha1 hash, then
// upload the actual bytes only for whatever comes back in `required`. Avoids
// needing a zip library for what's always just a single index.html.
async function uploadDeploy(siteId, html) {
  const sha1 = crypto.createHash('sha1').update(html).digest('hex');
  const deploy = await netlifyFetch(`/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: { '/index.html': sha1 } }),
  });

  if (Array.isArray(deploy.required) && deploy.required.includes(sha1)) {
    await netlifyFetch(`/deploys/${deploy.id}/files/index.html`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: html,
    });
  }

  return deploy;
}

// Deploys `html` as the customer's permanent live site, called after every
// write to Draft HTML. Creates a Netlify site on the first call and persists
// its id/url on the order record so every later edit (approvals, self-serve
// rounds, visual-editor saves) redeploys the same site instead of spawning a
// new one each time.
async function deployLiveSite(record, html) {
  let siteId = record.fields['Netlify Site ID'];
  let liveUrl = record.fields['Live Site URL'];
  const isFirstDeploy = !siteId;

  // Every caller fetches `record` before writing the new Draft HTML, so
  // record.fields['Draft HTML'] here still holds the pre-save content -
  // comparing against it catches true no-op saves (e.g. clicking "Save
  // changes" in the visual editor with no actual edits) before spending a
  // real deploy. Netlify's account-wide credit pool (15 credits/deploy,
  // shared across every customer site) makes deploying unchanged content
  // pure waste. Never skips the first deploy since siteId won't exist yet.
  if (!isFirstDeploy && html === record.fields['Draft HTML']) {
    return { liveUrl, isFirstDeploy: false, skipped: true };
  }

  if (isFirstDeploy) {
    const site = await createSite(record.fields['Customer Name']);
    siteId = site.id;
    liveUrl = site.ssl_url || site.url;
  }

  await uploadDeploy(siteId, html);

  await updateOrderRecord(record.id, {
    'Netlify Site ID': siteId,
    'Live Site URL': liveUrl,
  });

  return { liveUrl, isFirstDeploy };
}

module.exports = { deployLiveSite };
