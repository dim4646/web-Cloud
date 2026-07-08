// Curated so every combination stays readable — customers pick from these
// rather than free-typing a hex/font, since generate-draft-background.js
// always emits the same --navy/--accent/--sky/--paper/--muted variable names
// and the same h1-h4/body font-family rules, so a whole preset can be swapped
// in with plain string replacement (no AI call, no risk of a bad combo).

const ROUNDS_LIMIT = 4;

const PALETTES = [
  { id: 'mint', label: 'Mint (default)', colors: { navy: '#0B1220', accent: '#3DDC97', sky: '#4C8DFF', paper: '#F6F8FB', muted: '#5A6478' } },
  { id: 'sunset', label: 'Sunset', colors: { navy: '#1A1024', accent: '#FF7A59', sky: '#FFB84C', paper: '#FFF7F0', muted: '#8A7A85' } },
  { id: 'violet', label: 'Violet', colors: { navy: '#140F23', accent: '#A78BFA', sky: '#F472B6', paper: '#F5F3FF', muted: '#6B6478' } },
  { id: 'forest', label: 'Forest', colors: { navy: '#0E1B14', accent: '#4ADE80', sky: '#38BDF8', paper: '#F3FBF6', muted: '#57685F' } },
  { id: 'crimson', label: 'Crimson', colors: { navy: '#1B0E10', accent: '#F43F5E', sky: '#FB923C', paper: '#FFF5F5', muted: '#7A6265' } },
];

const FONT_PAIRS = [
  { id: 'grotesk-inter', label: 'Space Grotesk + Inter (default)', heading: 'Space Grotesk', body: 'Inter', googleFontsHref: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap' },
  { id: 'playfair-source', label: 'Playfair Display + Source Sans 3', heading: 'Playfair Display', body: 'Source Sans 3', googleFontsHref: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Source+Sans+3:wght@400;500;600&display=swap' },
  { id: 'poppins-roboto', label: 'Poppins + Roboto', heading: 'Poppins', body: 'Roboto', googleFontsHref: 'https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Roboto:wght@400;500;600&display=swap' },
  { id: 'fraunces-work', label: 'Fraunces + Work Sans', heading: 'Fraunces', body: 'Work Sans', googleFontsHref: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Work+Sans:wght@400;500;600&display=swap' },
];

module.exports = { ROUNDS_LIMIT, PALETTES, FONT_PAIRS };
