const { findOrderBySessionId, updateOrderRecord, uploadAttachment } = require('./_lib/airtable');
const { generateImage } = require('./_lib/image-gen');
const { deployLiveSite } = require('./_lib/netlify-deploy');
const { getEnv } = require('./_lib/env');

// Background function for the "🔄 regenerate" button - re-runs Imagen/Gemini
// for exactly one data-wc-photo slot using the description saved in that
// slot's data-wc-photo-desc attribute (written once by inject-photos.js the
// first time a slot's photo was generated), then swaps just that slot's
// background-image and redeploys. Same fire-and-forget shape as
// self-serve-edit-background.js.
exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    console.error('Invalid JSON payload to regenerate-photo-background');
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { sessionId, slotId } = payload;
  if (!sessionId || !slotId) {
    console.error('Missing sessionId or slotId in regenerate-photo-background');
    return { statusCode: 400, body: 'Missing sessionId or slotId' };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('regenerate-photo-background lookup failed:', err.message);
    return { statusCode: 500, body: 'Lookup failed' };
  }
  if (!record) {
    console.error('regenerate-photo-background: order not found for', sessionId);
    return { statusCode: 404, body: 'Order not found' };
  }

  const roundsUsed = record.fields['Self-Serve Rounds Used'] || 0;
  const currentHtml = record.fields['Draft HTML'];

  try {
    if (!currentHtml) throw new Error('Missing current Draft HTML');

    const slotRegex = new RegExp(
      `<([a-z][a-z0-9]*)\\b([^>]*\\bdata-wc-photo="${slotId}"[^>]*)>([\\s\\S]*?)<\\/\\1>`,
      'i'
    );
    const match = currentHtml.match(slotRegex);
    if (!match) throw new Error(`No data-wc-photo="${slotId}" element found in current draft`);
    const [fullMatch, tag, attrs, innerContent] = match;

    const descAttrMatch = attrs.match(/data-wc-photo-desc="([^"]*)"/i);
    if (!descAttrMatch) throw new Error(`Slot ${slotId} has no saved description to regenerate from`);
    const description = decodeURIComponent(descAttrMatch[1]);

    let answers = {};
    try {
      answers = JSON.parse(record.fields['Answers'] || '{}');
    } catch {
      // ignore malformed/missing Answers JSON, brandContext just falls back below
    }
    const brandContext = `Business: ${answers.projectName || record.fields['Customer Name'] || 'this business'}. Visual style: ${answers.style || 'clean and professional'}.`;
    const prompt = `${brandContext} Professional photograph for a business website: ${description}. Photorealistic, natural lighting, high quality. A single cohesive photo of one scene only - not a collage, grid, split-image, or multiple panels. No text, no watermarks, no logos baked into the image. No people's faces unless explicitly described above.`;

    const { base64, contentType } = await generateImage(prompt);
    const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
    const filename = `ai-slot${slotId}-${Date.now()}.${ext}`;
    await uploadAttachment(record.id, 'Self-Serve Photos', { contentType, file: base64, filename });

    const siteUrl = getEnv('URL') || `https://${event.headers.host}`;
    const proxyUrl = `${siteUrl}/.netlify/functions/photo-proxy?session=${encodeURIComponent(sessionId)}&filename=${encodeURIComponent(filename)}`;

    // Replace just this slot's background-image url(...), leaving any other
    // inline style rules on the element untouched.
    const newAttrs = /background-image\s*:\s*url\(['"]?[^'")]*['"]?\)/i.test(attrs)
      ? attrs.replace(/background-image\s*:\s*url\(['"]?[^'")]*['"]?\)/i, `background-image:url('${proxyUrl}')`)
      : attrs.replace(/style="([^"]*)"/i, `style="$1;background-image:url('${proxyUrl}');background-size:cover;background-position:center;"`);
    // Drop any <img> already sitting in this slot's inner content (left by
    // an earlier manual upload via visual-edit.html/visual-upload-photo.js)
    // - background-image paints behind normal child content, so a stale
    // foreground <img> would otherwise keep covering the freshly
    // regenerated photo instead of being replaced by it (found live
    // 2026-07-28: regenerating after a manual upload just hid the new AI
    // photo behind the old uploaded one).
    const cleanedInnerContent = innerContent.replace(/<img\b[^>]*>/gi, '');
    const replacement = `<${tag}${newAttrs}>${cleanedInnerContent}</${tag}>`;
    const newHtml = currentHtml.replace(fullMatch, replacement);

    await updateOrderRecord(record.id, {
      'Draft Status': 'Ready',
      'Draft HTML': newHtml,
      'Self-Serve Rounds Used': roundsUsed + 1,
    });

    try {
      await deployLiveSite(record, newHtml);
    } catch (deployErr) {
      console.error('regenerate-photo-background redeploy failed:', deployErr.message);
    }
  } catch (err) {
    console.error('regenerate-photo-background failed:', err.message);
    // Failed attempt shouldn't cost the customer a round.
    await updateOrderRecord(record.id, { 'Draft Status': 'Ready' }).catch(() => {});
  }

  return { statusCode: 200, body: 'ok' };
};
