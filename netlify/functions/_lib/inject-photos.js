const { uploadAttachment } = require('./airtable');
const { generateImage } = require('./image-gen');
const { getEnv } = require('./env');

const SLOT_REGEX = /<([a-z][a-z0-9]*)\b([^>]*\bdata-wc-photo="(\d+)"[^>]*)>([\s\S]*?)<\/\1>/gi;
const PLACEHOLDER_TEXT_REGEX = /\[PLACEHOLDER:\s*([^\]]+)\]/i;

// Finds every data-wc-photo="N" slot left by the AI draft prompt, generates
// a real image for each via Imagen, uploads it to the order's existing
// "Self-Serve Photos" attachment field (same field the camera-icon and
// visual-editor uploads already use), and splices a background-image into
// the slot element in place of the [PLACEHOLDER: ...] label.
//
// Best-effort by design: any single slot that fails to generate/upload just
// keeps its original placeholder text rather than failing the whole draft -
// same "never break the customer-facing flow" approach as deployLiveSite.
async function injectGeneratedPhotos(html, record, brandContext) {
  const matches = [...html.matchAll(SLOT_REGEX)];
  if (matches.length === 0) return html;

  const siteUrl = getEnv('URL') || 'https://webcloudsolutions.com.au';
  const sessionId = record.fields['Stripe Session ID'];

  // Generate + upload all slots in parallel - same wall-clock time as one
  // slot, since each is an independent API call (mirrors the 3-variations
  // Promise.all in generate-draft-background.js). We're already inside a
  // background function so there's headroom, but no reason to serialize.
  const replacements = await Promise.all(
    matches.map(async (match) => {
      const [fullMatch, tag, attrs, slotNum, innerContent] = match;
      const descMatch = innerContent.match(PLACEHOLDER_TEXT_REGEX);
      if (!descMatch) return null; // no placeholder text in this slot - leave as-is

      const description = descMatch[1].trim();
      try {
        const prompt = `${brandContext} Professional photograph for a business website: ${description}. Photorealistic, natural lighting, high quality, no text or watermarks, no people's faces unless explicitly described above.`;
        const { base64, contentType } = await generateImage(prompt);
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

  let result = html;
  for (const item of replacements) {
    if (item) result = result.replace(item.fullMatch, item.replacement);
  }
  return result;
}

module.exports = { injectGeneratedPhotos };
