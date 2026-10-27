// pics.js — optional bitmap art over the drawn SVG (docs/art-ai-brief.md). game/art/shop/manifest.json lists the
// pictures that exist; every drawn piece the shop asks for has a picture id (art-pics.js), and when that picture is
// there it replaces the drawing, inside the drawing's own <svg ...> tag (class, viewBox, size and data attributes stay),
// so the layout and every CSS hook stay the same. No pictures (the default manifest is empty) = the drawn art, unchanged.
// Pure apart from loadPics (fetch + Image preload).
//
//   manifest = { version: 1, pics: { id: 'file.webp' | { src: 'file.webp', box: [x, y, w, h] } } }
//     box: where the picture sits in the drawing's viewBox (default: the whole viewBox); pictures are fitted
//     bottom-centre (xMidYMax meet), like things standing on the table
//   setPics(manifest, dir = 'art/shop/')   use these pictures (tests, tools); setPics(null) = none
//   loadPics(url) → Promise<number>        fetch the manifest (missing / broken = none), preload the files
//   hasPic(id), picIds() → [id]
//   pic(ids, svg, { ring, shadow })        svg with the first id found as a picture (ids: string or array, tried in
//                                          order); ring 0..1 = a progress ring over the picture (cooking); shadow = a soft
//                                          contact shadow under it (equipment: the pictures come without one)
//   picSrc(id) → url | null
//   picSet(name, svg, variants, { before, after })   several pictures of one thing in one svg, CSS picks the one shown:
//                                          <image class="px px-base"> + <image class="px px-<v>"> per variant (a missing
//                                          variant uses the base picture); before / after: drawn parts kept under / over
//                                          them (a contact shadow, a held sign)

const have = new Map();
let dir = 'art/shop/';

export function setPics(manifest, base = 'art/shop/') {
  have.clear();
  dir = base.endsWith('/') ? base : base + '/';
  const list = (manifest && manifest.pics) || {};
  for (const [id, v] of Object.entries(list)) {
    const p = typeof v === 'string' ? { src: v } : v;
    if (p && typeof p.src === 'string' && p.src) have.set(id, { src: p.src, box: Array.isArray(p.box) && p.box.length === 4 ? p.box.map(Number) : null });
  }
  return have.size;
}

export async function loadPics(url = 'art/shop/manifest.json') {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return setPics(null);
    setPics(await r.json(), url.replace(/[^/]*$/, ''));
  } catch { return setPics(null); }
  // warm the cache so a picture swapped in mid-day (a busy sealer) does not blink
  if (typeof Image === 'function') for (const id of have.keys()) { const im = new Image(); im.src = picSrc(id); }
  return have.size;
}

export const hasPic = (id) => have.has(id);
export const picIds = () => [...have.keys()];
export const picSrc = (id) => (have.has(id) ? dir + have.get(id).src : null);

const first = (ids) => (Array.isArray(ids) ? ids : [ids]).find((k) => k && have.has(k)) || null;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function viewBox(open) {
  const m = /viewBox="([^"]+)"/.exec(open);
  const v = m ? m[1].trim().split(/[\s,]+/).map(Number) : [];
  return v.length === 4 && v.every(Number.isFinite) ? v : [0, 0, 100, 100];
}

function image(id, vb, cls = 'pic') {
  const p = have.get(id);
  const [x, y, w, h] = p.box || vb;
  return `<image class="${cls}" href="${esc(dir + p.src)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMax meet"/>`;
}

function ring(vb, pct) {
  const [x, y, w, h] = vb;
  const r = Math.min(w, h) * 0.13;
  const cx = x + w - r * 1.4;
  const cy = y + r * 1.4;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return `<g class="pic-ring"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#1B2040" fill-opacity=".72"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.7}" fill="none" stroke="#FFC21A" stroke-width="${r * 0.36}" stroke-linecap="round" ` +
    `stroke-dasharray="${(c * 0.7 * p).toFixed(1)} ${c}" transform="rotate(-90 ${cx} ${cy})"/></g>`;
}

export function pic(ids, svg, { ring: pct = null, shadow = false } = {}) {
  const id = first(ids);
  if (!id) return svg;
  const open = /^\s*<svg\b[^>]*>/.exec(svg);
  if (!open) return svg;
  const vb = viewBox(open[0]);
  const [x, y, w, h] = have.get(id).box || vb;
  const ao = shadow ? `<ellipse class="pic-ao" cx="${x + w / 2}" cy="${y + h * 0.975}" rx="${w * 0.47}" ry="${Math.max(h * 0.045, w * 0.07)}" fill="url(#gkAO)"/>` : '';
  return `${open[0].trim()}${ao}${image(id, vb)}${pct == null ? '' : ring(vb, pct)}</svg>`;
}

export function picSet(name, svg, variants = [], { before = '', after = '' } = {}) {
  if (!have.has(name)) return svg;
  const open = /^\s*<svg\b[^>]*>/.exec(svg);
  if (!open) return svg;
  const vb = viewBox(open[0]);
  const imgs = [image(name, vb, 'px px-base')].concat(variants.map((v) => image(have.has(`${name}-${v}`) ? `${name}-${v}` : name, vb, `px px-${v}`)));
  return `${open[0].trim().replace(/>$/, ' data-pic="1">')}${before}${imgs.join('')}${after}</svg>`;
}
