const Anthropic = require('@anthropic-ai/sdk');
const { findOrderBySessionId, updateOrderRecord } = require('./_lib/airtable');
const { getEnv } = require('./_lib/env');

const DESIGN_TOKENS = `
Brand: WebCloud (Gold Coast web design / hosting / private cloud company)
Colors: --navy:#0B1220 (dark bg/text), --accent:#3DDC97 (mint green), --sky:#4C8DFF (blue), --paper:#F6F8FB (light bg), --muted:#5A6478
Fonts: 'Space Grotesk' for headings, 'Inter' for body text (both on Google Fonts)
Style: clean, modern, generous whitespace, rounded corners (14-22px), subtle 1px borders, mobile-first
`;

// Three deliberately different design directions, generated in parallel, so
// the customer picks a favorite starting point instead of getting stuck with
// whatever the AI happened to produce on its first (only) attempt.
const VARIATIONS = [
  {
    field: 'Draft Variation 1',
    label: 'Minimal & Clean',
    guidance: 'Design direction: MINIMAL & CLEAN. Lots of whitespace, restrained use of color (mostly neutral with the accent color used sparingly for emphasis only), simple understated typography, plenty of breathing room between sections.',
  },
  {
    field: 'Draft Variation 2',
    label: 'Bold & Colorful',
    guidance: 'Design direction: BOLD & COLORFUL. Confident use of the full color palette, larger and more expressive typography, higher visual energy (e.g. gradient or color-block sections), still professional but more eye-catching.',
  },
  {
    field: 'Draft Variation 3',
    label: 'Classic & Professional',
    guidance: 'Design direction: CLASSIC & PROFESSIONAL. Conservative, trustworthy, traditional business layout (clear header/hero/sections in a straightforward top-to-bottom structure), muted color use, emphasis on readability and credibility over visual flair.',
  },
];

exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    console.error('Invalid JSON payload to generate-draft-background');
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { sessionId, answers, package: packageName } = payload;
  if (!sessionId) {
    console.error('Missing sessionId in generate-draft-background');
    return { statusCode: 400, body: 'Missing sessionId' };
  }

  try {
    const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') });

    const portfolioGuidance = packageName === 'Portfolio' ? `

This is a PERSONAL PORTFOLIO site for an individual, not a business. Treat it accordingly:
- Use "About Me" framing, not "About Us"/"Our story".
- Use the client's "role" answer (their headline/profession) prominently in the hero.
- Replace any business-style sections (services/menu, opening hours, physical address) with a "Work" or "Projects" section, and turn each entry in "portfolioLinks" into a linked item there (or in the contact/footer area) rather than inventing project descriptions.
- Skip opening hours and physical address entirely — they don't apply here.` : '';

    function buildPrompt(variationGuidance) {
      return `You are a web designer building a FIRST-DRAFT single-page website for a client of a web design agency called WebCloud.

Client's package: ${packageName || 'Basic'}
Client's answers to our project questionnaire (JSON):
${JSON.stringify(answers, null, 2)}
${portfolioGuidance}

Design system to loosely draw from (this is WebCloud's own brand, not necessarily the client's — use it as a starting point and adapt colors/tone to fit the client's business if their answers suggest a different vibe):
${DESIGN_TOKENS}

${variationGuidance}

Produce a single, complete, self-contained HTML file (inline <style>, no external JS frameworks, a Google Fonts <link> is fine) implementing a draft website for this client based on their answers. Include a header/nav, hero section, a section for their content/services, and a contact section. In the contact section, include whichever of email/phone/address/opening hours/social links the client actually provided (skip any that are blank rather than inventing placeholders for them), plus placeholders for any core content that's still missing. Make it mobile-responsive. Where the client's answers don't give enough detail, use placeholder text clearly marked like [PLACEHOLDER: short description of what's needed] so the human designer knows what to fill in before it ships.

For every element that is meant to hold a client-supplied photo (profile photo, hero image, project thumbnail, etc.), add a data-wc-photo="N" attribute to that specific element (N starting at 1 and incrementing for each photo slot on the page — e.g. data-wc-photo="1", data-wc-photo="2", ...). This applies whether or not the client provided a photo link. These attributes are used later to let the client drop in real photos themselves, so every distinct photo-shaped placeholder on the page needs its own number, in the order it appears.

Respond with ONLY the raw HTML, starting with <!DOCTYPE html> — no markdown code fences, no explanation before or after.`;
    }

    function extractHtml(message) {
      if (message.stop_reason === 'max_tokens') {
        throw new Error('Model output was truncated by the max_tokens limit - the generated HTML is incomplete.');
      }
      let html = (message.content || [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();
      html = html.replace(/```html\s*/gi, '').replace(/```\s*/g, '').trim();

      const docStart = html.search(/<!doctype html/i);
      const htmlStart = html.search(/<html[ >]/i);
      const start = docStart !== -1 ? docStart : htmlStart;
      if (start === -1) {
        throw new Error(
          `Model did not return an HTML document. stop_reason=${message.stop_reason}, ` +
          `blockTypes=${(message.content || []).map((b) => b.type).join(',')}, ` +
          `raw=${html.slice(0, 300)}`
        );
      }
      return html.slice(start);
    }

    // Three variations generated in parallel rather than sequentially - same
    // wall-clock time as generating one, since each is an independent API call.
    const results = await Promise.all(
      VARIATIONS.map(async (variation) => {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 16000,
          messages: [{ role: 'user', content: buildPrompt(variation.guidance) }],
        });
        return { field: variation.field, html: extractHtml(message) };
      })
    );

    const record = await findOrderBySessionId(sessionId);
    if (record) {
      const fields = { 'Draft Status': 'Choosing' };
      for (const result of results) fields[result.field] = result.html;
      await updateOrderRecord(record.id, fields);
    }
  } catch (err) {
    console.error('Draft generation failed:', err.message);
    try {
      const record = await findOrderBySessionId(sessionId);
      if (record) {
        await updateOrderRecord(record.id, { 'Draft Status': 'Failed', 'Revision Request': `DEBUG: ${err.message}\n${err.stack || ''}`.slice(0, 9000) });
      }
    } catch (innerErr) {
      console.error('Failed to record draft failure:', innerErr.message);
    }
  }

  return { statusCode: 200, body: 'ok' };
};
