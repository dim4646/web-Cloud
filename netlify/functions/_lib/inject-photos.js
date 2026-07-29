const { uploadAttachment } = require('./airtable');
const { generateImage } = require('./image-gen');
const { getEnv } = require('./env');

const SLOT_REGEX = /<([a-z][a-z0-9]*)\b([^>]*\bdata-wc-photo="(\d+)"[^>]*)>([\s\S]*?)<\/\1>/gi;
// <img> is a void element and never has a real closing tag, so it can never
// match SLOT_REGEX above (which requires one). The generation prompt now
// explicitly forbids <img> for photo slots, but this is a safety net in
// case that slips - confirmed live 2026-07-29: a Portfolio variation used
// <img data-wc-photo="N" ... alt="[PLACEHOLDER: ...]"> slots despite the
// div-only instruction, and every one of them silently never got a real
// photo, forever, with no error anywhere (SLOT_REGEX just found zero
// matches). Placeholder text lives in `alt` for these, not inner content.
const IMG_SLOT_REGEX = /<img\b([^>]*\bdata-wc-photo="(\d+)"[^>]*)\/?>/gi;
const PLACEHOLDER_TEXT_REGEX = /\[PLACEHOLDER:\s*([^\]]+)\]/i;

async function generateSlotPhoto(description, brandContext) {
  const prompt = `${brandContext} Professional photograph for a business website: ${description}. Photorealistic, natural lighting, high quality. A single cohesive photo of one scene only - not a collage, grid, split-image, or multiple panels. No text, no watermarks, no logos baked into the image. No people's faces unless explicitly described above.`;
  return generateImage(prompt);
}

// Finds every data-wc-photo="N" slot left by the AI draft prompt, generates
// a real image for each via Imagen, uploads it to the order's existing
// "Self-Serve Photos" attachment field (same field the camera-icon and
// visual-editor uploads already use), and splices the result into the slot
// element in place of the [PLACEHOLDER: ...] label.
//
// Best-effort by design: any single slot that fails to generate/upload just
// keeps its original placeholder text rather than failing the whole draft -
// same "never break the customer-facing flow" approach as deployLiveSite.
async function injectGeneratedPhotos(html, record, brandContext) {
  const divMatches = [...html.matchAll(SLOT_REGEX)];
  const imgMatches = [...html.matchAll(IMG_SLOT_REGEX)];
  if (divMatches.length === 0 && imgMatches.length === 0) return html;

  const siteUrl = getEnv('URL') || 'https://webcloudsolutions.com.au';
  const sessionId = record.fields['Stripe Session ID'];

  // Generate + upload all slots in parallel - same wall-clock time as one
  // slot, since each is an independent API call (mirrors the 3-variations
  // Promise.all in generate-draft-background.js). We're already inside a
  // background function so there's headroom, but no reason to serialize.
  const divReplacements = await Promise.all(
    divMatches.map(async (match) => {
      const [fullMatch, tag, attrs, slotNum, innerContent] = match;
      const descMatch = innerContent.match(PLACEHOLDER_TEXT_REGEX);
      if (!descMatch) return null; // no placeholder text in this slot - leave as-is

      const description = descMatch[1].trim();
      try {
        const { base64, contentType } = await generateSlotPhoto(description, brandContext);
        const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
        const filename = `ai-slot${slotNum}-${Date.now()}.${ext}`;

        await uploadAttachment(record.id, 'Self-Serve Photos', { contentType, file: base64, filename });

        const proxyUrl = `${siteUrl}/.netlify/functions/photo-proxy?session=${encodeURIComponent(sessionId)}&filename=${encodeURIComponent(filename)}`;
        const bgStyle = `background-image:url('${proxyUrl}');background-size:cover;background-position:center;`;

        // Keep the original description in a data attribute (not visible,
        // unlike the [PLACEHOLDER] text it replaces) so a later "regenerate
        // this photo" request can re-run the same prompt without needing the
        // placeholder text back - see regenerate-photo-background.js.
        let newAttrs = attrs.includes('data-wc-photo-desc=')
          ? attrs
          : `${attrs} data-wc-photo-desc="${encodeURIComponent(description)}"`;
        const styleMatch = newAttrs.match(/style="([^"]*)"/i);
        newAttrs = styleMatch
          ? newAttrs.replace(/style="([^"]*)"/i, `style="$1;${bgStyle}"`)
          : `${newAttrs} style="${bgStyle}"`;

        const newInner = innerContent.replace(PLACEHOLDER_TEXT_REGEX, '');
        return { fullMatch, replacement: `<${tag}${newAttrs}>${newInner}</${tag}>` };
      } catch (err) {
        console.error(`Image generation failed for data-wc-photo="${slotNum}":`, err.message);
        return null;
      }
    })
  );

  const imgReplacements = await Promise.all(
    imgMatches.map(async (match) => {
      const [fullMatch, attrs, slotNum] = match;
      const altMatch = attrs.match(/\balt="([^"]*)"/i);
      const descMatch = altMatch && altMatch[1].match(PLACEHOLDER_TEXT_REGEX);
      if (!descMatch) return null; // no placeholder text in alt - leave as-is

      const description = descMatch[1].trim();
      try {
        const { base64, contentType } = await generateSlotPhoto(description, brandContext);
        const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
        const filename = `ai-slot${slotNum}-${Date.now()}.${ext}`;

        await uploadAttachment(record.id, 'Self-Serve Photos', { contentType, file: base64, filename });

        const proxyUrl = `${siteUrl}/.netlify/functions/photo-proxy?session=${encodeURIComponent(sessionId)}&filename=${encodeURIComponent(filename)}`;

        let newAttrs = attrs.includes('data-wc-photo-desc=')
          ? attrs
          : `${attrs} data-wc-photo-desc="${encodeURIComponent(description)}"`;
        newAttrs = /\bsrc="[^"]*"/i.test(newAttrs)
          ? newAttrs.replace(/\bsrc="[^"]*"/i, `src="${proxyUrl}"`)
          : `${newAttrs} src="${proxyUrl}"`;
        // Clean the [PLACEHOLDER: ...] wrapper out of the visible alt text
        // once a real photo is in place, leaving just the description.
        newAttrs = newAttrs.replace(/\balt="([^"]*)"/i, (m, altText) => `alt="${altText.replace(PLACEHOLDER_TEXT_REGEX, description)}"`);

        return { fullMatch, replacement: `<img${newAttrs}>` };
      } catch (err) {
        console.error(`Image generation failed for data-wc-photo="${slotNum}" (img slot):`, err.message);
        return null;
      }
    })
  );

  let result = html;
  for (const item of [...divReplacements, ...imgReplacements]) {
    if (item) result = result.replace(item.fullMatch, item.replacement);
  }
  return result;
}

module.exports = { injectGeneratedPhotos };
