const AIRTABLE_BASE_ID = 'appv7AQg99c5GqdTU';
const AIRTABLE_TABLE_ID = 'tblYF1s42rbE88ZYJ';
const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

async function findOrderBySessionId(sessionId) {
  const formula = encodeURIComponent(`{Stripe Session ID}="${sessionId}"`);
  const res = await fetch(`${BASE_URL}?filterByFormula=${formula}&maxRecords=1`, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
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
      Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ typecast: true, fields }),
  });
  if (!res.ok) {
    throw new Error(`Airtable update failed: ${await res.text()}`);
  }
  return res.json();
}

module.exports = { findOrderBySessionId, updateOrderRecord };
