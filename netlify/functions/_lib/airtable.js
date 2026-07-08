const { getEnv } = require('./env');

const AIRTABLE_BASE_ID = 'appv7AQg99c5GqdTU';
const AIRTABLE_TABLE_ID = 'tblYF1s42rbE88ZYJ';
const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
// Attachment uploads go through a separate host from the regular data API.
const CONTENT_BASE_URL = `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}`;

async function findOrderBySessionId(sessionId) {
  const formula = encodeURIComponent(`{Stripe Session ID}="${sessionId}"`);
  const res = await fetch(`${BASE_URL}?filterByFormula=${formula}&maxRecords=1`, {
    headers: { Authorization: `Bearer ${getEnv('AIRTABLE_API_KEY')}` },
  });
  if (!res.ok) {
    // Distinguish "Airtable/auth is broken" from "no matching record" so
    // callers don't silently report 404 for what's actually a config error.
    throw new Error(`Airtable lookup failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.records?.[0] || null;
}

async function updateOrderRecord(recordId, fields) {
  const res = await fetch(`${BASE_URL}/${recordId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${getEnv('AIRTABLE_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ typecast: true, fields }),
  });
  if (!res.ok) {
    throw new Error(`Airtable update failed: ${await res.text()}`);
  }
  return res.json();
}

// Uploads a base64-encoded file directly into an attachment field. Unlike
// updateOrderRecord, this appends to the field's existing attachments rather
// than replacing them, so repeat uploads to the same slot accumulate - callers
// that care about "latest wins" should pick the last matching filename.
async function uploadAttachment(recordId, fieldName, { contentType, file, filename }) {
  const res = await fetch(`${CONTENT_BASE_URL}/${recordId}/${encodeURIComponent(fieldName)}/uploadAttachment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getEnv('AIRTABLE_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contentType, file, filename }),
  });
  if (!res.ok) {
    throw new Error(`Airtable attachment upload failed: ${await res.text()}`);
  }
  return res.json();
}

module.exports = { findOrderBySessionId, updateOrderRecord, uploadAttachment };
