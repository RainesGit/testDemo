// Bitmap pictures over the drawn shop art (src/shop/pics.js, art-pics.js; docs/art-ai-brief.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPics, pic, picSet, hasPic, picSrc } from '../src/shop/pics.js';
import * as P from '../src/shop/art-pics.js';
import * as S from '../src/shop/art-shop.js';
import { walkerSVG, walkerPicName } from '../src/shop/art-street.js';

const open = (s) => /^<svg\b[^>]*>/.exec(s)[0];

test('no pictures: every wrapped piece is exactly the drawing', () => {
  setPics(null);
  assert.equal(P.teaTankSVG('green', { fast: true }), S.teaTankSVG('green', { fast: true }));
  assert.equal(P.potSVG({ scoops: 4, cookingPct: 0.3 }), S.potSVG({ scoops: 4, cookingPct: 0.3 }));
  assert.equal(P.cornerSVG().length > 200, true);
  assert.ok(P.clerkSVG().includes('class="clerk"') && !P.clerkSVG().includes('data-pic'));
});

test('a picture keeps the drawing\'s own svg tag and viewBox', () => {
  setPics({ pics: { 'tea-black': 'tea-black.webp', trash: { src: 't.webp', box: [1, 2, 3, 4] } } }, 'art/x');
  const drawn = S.teaTankSVG('black');
  const out = P.teaTankSVG('black');
  assert.equal(open(out), open(drawn));
  assert.match(out, /class="pic-ao"/);
  assert.match(out, /<image class="pic" href="art\/x\/tea-black\.webp" x="0" y="0" width="100" height="155"/);
  assert.match(P.trashSVG(), /x="1" y="2" width="3" height="4"/);
  assert.equal(picSrc('trash'), 'art/x/t.webp');
  assert.equal(P.teaTankSVG('green'), S.teaTankSVG('green')); // no picture for green: drawn
});

test('variants fall back to the plain id; an empty tray never shows the full picture', () => {
  setPics({ pics: { 'tea-black': 'a.webp', 'top-pearl': 'p.webp', 'top-pearl-empty': 'pe.webp', 'top-coconut': 'c.webp' } });
  assert.match(P.teaTankSVG('black', { fast: true }), /a\.webp/);
  assert.match(P.toppingTraySVG('pearl', 0), /pe\.webp/);
  assert.match(P.toppingTraySVG('pearl', 2), /p\.webp/); // no low picture: the full one
  assert.equal(P.toppingTraySVG('coconut', 0), S.toppingTraySVG('coconut', 0)); // no empty picture: drawn
  setPics({ pics: { pot: 'pot.webp' } });
  assert.equal(P.potSVG({ scoops: 0 }), S.potSVG({ scoops: 0 }));
  const cooking = P.potSVG({ scoops: 0, cookingPct: 0.5 });
  assert.match(cooking, /pot\.webp/);
  assert.match(cooking, /class="pic-ring"/); // the cooking progress stays readable over a picture
});

test('the street picture takes the corner shop and the awning with it', () => {
  setPics(null);
  const drawn = P.cornerSVG();
  setPics({ pics: { street: 's.webp' } });
  assert.match(P.streetSVG({ neon: true }), /s\.webp/);
  assert.equal(P.cornerSVG(), open(drawn) + '</svg>');
  setPics({ pics: { street: 's.webp', corner: 'c.webp' } });
  assert.match(P.cornerSVG(), /c\.webp/);
});

test('people: 奧客 use their own picture or stay drawn, regulars spread over the reg-<n> set', () => {
  setPics({ pics: { 'reg-1': 'r1.webp', 'reg-2': 'r2.webp', 'reg-2-happy': 'r2h.webp', 'oke-c250': 'c.webp' } });
  assert.equal(walkerPicName({ cid: 47, oke: 'c250' }), 'oke-c250');
  assert.equal(walkerPicName({ cid: 41, oke: 'one' }), null);
  assert.ok(walkerSVG({ cid: 41, oke: 'one' }).includes('wk-body')); // drawn
  const names = new Set([0, 1, 2, 3, 4, 5].map((uid) => walkerPicName({ cid: 5, uid })));
  assert.deepEqual([...names].sort(), ['reg-1', 'reg-2']);
  const w = walkerSVG({ cid: 5, uid: [0, 1, 2, 3].find((u) => walkerPicName({ cid: 5, uid: u }) === 'reg-2') });
  assert.match(w, /data-pic="1"/);
  assert.match(w, /class="px px-base" href="art\/shop\/r2\.webp"/);
  assert.match(w, /class="px px-happy" href="art\/shop\/r2h\.webp"/);
  assert.match(w, /class="px px-back" href="art\/shop\/r2\.webp"/); // missing variant: the front picture
  assert.match(w, /class="wk-sil"[^>]*mask="url\(#pm-reg-2\)"/);
  assert.match(w, /class="wk-sign"/); // fans keep their drawn sign
  assert.match(P.okeHeadSVG({ type: 'c250' }, 'drawn'), /pic-head/);
  assert.equal(P.okeHeadSVG({ type: 'one' }, 'drawn'), 'drawn');
});

test('the clerk: one picture per mood', () => {
  setPics({ pics: { clerk: 'c.webp', 'clerk-hit': 'h.webp' } });
  const c = P.clerkSVG();
  assert.match(c, /^<svg class="clerk"[^>]*data-mood="idle"[^>]*data-pic="1">/);
  assert.match(c, /px-hit" href="art\/shop\/h\.webp"/);
  assert.match(c, /px-perfect" href="art\/shop\/c\.webp"/);
  setPics(null);
});

test('PIC_LIST: unique ids, each with a drawing to fit into; the default manifest is empty and valid', () => {
  const ids = P.PIC_LIST.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const x of P.PIC_LIST) assert.match(x.svg(), /^<svg\b[^>]*viewBox="[-\d. ]+"/, x.id);
  const m = JSON.parse(readFileSync(new URL('../art/shop/manifest.json', import.meta.url), 'utf8'));
  assert.equal(m.version, 1);
  for (const id of Object.keys(m.pics)) assert.ok(ids.includes(id), id);
  assert.equal(setPics(m), Object.keys(m.pics).length);
  assert.equal(hasPic('nope'), false);
  setPics(null);
});

test('picSet without its base picture is the drawing', () => {
  setPics(null);
  assert.equal(picSet('clerk', '<svg viewBox="0 0 1 1"><g/></svg>', ['hit']), '<svg viewBox="0 0 1 1"><g/></svg>');
  assert.equal(pic([], '<svg/>'), '<svg/>');
});
