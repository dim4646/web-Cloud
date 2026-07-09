const Anthropic = require('@anthropic-ai/sdk');
const { findOrderBySessionId, updateOrderRecord, uploadAttachment } = require('./_lib/airtable');
const { getEnv } = require('./_lib/env');
const { ROUNDS_LIMIT } = require('./_lib/design-presets');
const { applyPalette, applyFontPair } = require('./self-serve-edit');

exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    console.error('Invalid JSON payload to self-serve-edit-background');
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { sessionId, paletteId, fontId, photos, changeText } = payload;
  if (!sessionId) {
    console.error('Missing sessionId in self-serve-edit-background');
    return { statusCode: 400, body: 'Missing sessionId' };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('self-serve-edit-background lookup failed:', err.message);
    return { statusCode: 500, body: 'Lookup failed' };
  }
  if (!record) {
    console.error('self-serve-edit-background: order not found for', sessionId);
    return { statusCode: 404, body: 'Order not found' };
  }

  const roundsUsed = record.fields['Self-Serve Rounds Used'] || 0;
  const currentHtml = record.fields['Draft HTML'];
  if (!currentHtml) {
    console.error('self-serve-edit-background: missing current HTML');
    await updateOrderRecord(record.id, { 'Draft Status': 'Ready' }).catch(() => {});
    return { statusCode: 400, body: 'Missing current HTML' };
  }

  // Apply the cheap deterministic parts first so the Claude call only has to
  // handle the free-text request, on top of an already-updated palette/font.
  let html = currentHtml;
  if (paletteId) html = applyPalette(html, paletteId);
  if (fontId) html = applyFontPair(html, fontId);

  try {
    if (Array.isArray(photos)) {
      for (const photo of photos) {
        if (!photo || !photo.slotId || !photo.base64 || !photo.contentType) continue;
        const ext = (photo.filename || '').split('.').pop() || 'jpg';
        await uploadAttachment(record.id, 'Self-Serve Photos', {
          contentType: photo.contentType,
          file: photo.base64,
          filename: `slot-${photo.slotId}.${ext}`,
        });
      }
    }

    if (changeText) {
      const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') });

      const prompt = `You are a web designer updating an existing single-page draft website based on a client's own self-service edit request.

Here is the current HTML of the site:
${html}

The client has requested this change themselves, and it will go live immediately with no human review, so keep the rest of the page intact and don't remove core sections unless they explicitly ask for that:
"${changeText}"

Apply the requested change(s) to the HTML above. Keep everything else (design, structure, other content, [PLACEHOLDER: ...] markers, data-wc-photo="N" attributes) exactly as it was unless the request implies otherwise. Return the complete, updated, self-contained HTML document.

Respond with ONLY the raw HTML, starting with <!DOCTYPE html> — no markdown code fences, no explanation before or after.`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      });

      if (message.stop_reason === 'max_tokens') {
        throw new Error('Model output was truncated by the max_tokens limit - the generated HTML is incomplete.');
      }

      let updated = (message.content || [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();
      updated = updated.replace(/```html\s*/gi, '').replace(/```\s*/g, '').trim();

      const docStart = updated.search(/<!doctype html/i);
      const htmlStart = updated.search(/<html[ >]/i);
      const start = docStart !== -1 ? docStart : htmlStart;
      if (start === -1) {
        throw new Error(
          `Model did not return an HTML document. stop_reason=${message.stop_reason}, raw=${updated.slice(0, 300)}`
        );
      }
      html = updated.slice(start);
    }

    const newRoundsUsed = roundsUsed + 1;
    await updateOrderRecord(record.id, {
      'Draft Status': 'Ready',
      'Draft HTML': html,
      'Self-Serve Rounds Used': newRoundsUsed,
    });
  } catch (err) {
    console.error('self-serve-edit-background failed:', err.message);
    // A failed attempt shouldn't cost the customer one of their free rounds.
    await updateOrderRecord(record.id, { 'Draft Status': 'Ready' }).catch(() => {});
  }

  return { statusCode: 200, body: 'ok' };
};
