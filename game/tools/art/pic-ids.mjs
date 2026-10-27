// pic-ids.mjs — writes art/shop/ids.json: every picture id the shop can use (src/shop/art-pics.js PIC_LIST) with the
// frame it is fitted into (the drawing's viewBox), the suggested pixel size and how the importer treats it
// (fit: 'object' = cut out, trimmed, bottom-centred | 'scene' = opaque, cropped to fill). Run from game/:
//   node tools/art/pic-ids.mjs
import { writeFileSync } from 'node:fs';
import { PIC_LIST } from '../../src/shop/art-pics.js';

const SCENE = new Set(['street', 'street-neon', 'street-rail', 'street-neon-rail', 'table']);
const LONG = { people: 960, street: 1024, table: 1024, station: 512, decor: 512 };
const out = PIC_LIST.map(({ id, group, svg, note }) => {
  const m = /viewBox="([^"]+)"/.exec(svg());
  const vb = m[1].trim().split(/[\s,]+/).map(Number);
  const long = SCENE.has(id) ? 2560 : LONG[group] || 512;
  const k = long / Math.max(vb[2], vb[3]);
  return { id, group, note, viewBox: vb, px: [Math.round(vb[2] * k), Math.round(vb[3] * k)], fit: SCENE.has(id) ? 'scene' : 'object' };
});
writeFileSync(new URL('../../art/shop/ids.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${out.length} ids → art/shop/ids.json`);
