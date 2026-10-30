// art-pics.js — the shop's art with optional bitmap pictures (pics.js, docs/art-ai-brief.md). Same names and arguments
// as the drawn art in art-shop.js / art-bar.js / art-street.js / ../art.js; each one returns the picture for its id
// (state variants first, then the plain id) when the manifest has it, else the drawing. ui.js imports from here.
// Things that only make sense drawn stay drawn: cups (built from tea / toppings / ice / sugar), order bubbles, locks.
//
//   PIC_LIST: [{ id, group, svg: () => drawn svg, note }]   every picture id the shop can use, with the drawing it
//     replaces (its viewBox is the frame the picture is fitted into); tools/art/pic-ids.mjs writes it out for the
//     importer and the brief
//   okeHeadSVG(o, drawn)   a 奧客's head for cards: the top of its picture, else the drawn head

import * as S from './art-shop.js';
import * as B from './art-bar.js';
import * as W from './art-street.js';
import { shopClerkSVG } from './art-clerk.js';
import { pic as picture, picSet, hasPic, picSrc } from './pics.js';
import { TEA_KINDS, TOPPING_KINDS } from './art-shop.js';

// equipment and props stand on the table: a contact shadow under the picture (scenes, the coin, people: none)
const pic = (ids, svg, o = {}) => picture(ids, svg, { shadow: true, ...o });
const flat = (ids, svg) => picture(ids, svg);
const v = (base, ...mods) => [...mods.filter(Boolean).map((m) => `${base}-${m}`), base];

// ─── the work table ──────────────────────────────────────────────────────────────────────────────────────
export const tableSVG = () => flat('table', S.tableSVG());
export { counterLipSVG } from './art-shop.js'; // a 16 px strip: stays drawn
export const cupRackSVG = () => pic('rack', S.cupRackSVG());
export const teaTankSVG = (k = 'black', o = {}) => pic(v(`tea-${k}`, o.fast && 'fast'), S.teaTankSVG(k, o));
export const teaManifoldSVG = (n = 3) => pic(`manifold-${n}`, S.teaManifoldSVG(n));
// a tray / bin that runs out: its own empty and low pictures, never the full one when it is empty
const tray = (id, left, max) => (left <= 0 ? [`${id}-empty`] : left <= Math.ceil(max * 0.35) ? [`${id}-low`, id] : [id]);
export const toppingTraySVG = (k = 'pearl', n = 10) => pic(tray(`top-${k}`, n, 10), S.toppingTraySVG(k, n));
export const lemonTraySVG = (n = 6, max = 6) => pic(tray('lemon', n, max), S.lemonTraySVG(n, max));
export const iceBinSVG = () => pic('ice', S.iceBinSVG());
export const iceDispenserSVG = () => pic('ice-smart', S.iceDispenserSVG());
export const syrupSVG = () => pic('syrup', S.syrupSVG());
export const sealerSVG = (state = 'idle', o = {}) => pic(state === 'busy' ? v('sealer-busy', o.turbo && 'turbo') : v('sealer', o.turbo && 'turbo'), S.sealerSVG(state, o));
export const potSVG = (o = {}) => {
  const cooking = o.cookingPct > 0 && o.cookingPct < 1;
  const ids = cooking ? ['pot-cooking', 'pot'] : (o.scoops || 0) <= 0 ? ['pot-empty'] : ['pot'];
  return pic(ids, S.potSVG(o), { ring: cooking ? o.cookingPct : null });
};
export const potRigSVG = (lv = 1) => pic('pot-rig', S.potRigSVG(lv));
export const trashSVG = () => pic('trash', S.trashSVG());
export const workSlotSVG = () => flat('slot', S.workSlotSVG());
export const shelfSVG = (n = 4, o = {}) => pic(v(`shelf-${n}`, o.autoSeal && 'auto'), S.shelfSVG(n, o));
export const goldenCardSVG = () => flat('golden-card', S.goldenCardSVG());
export const coinSVG = () => flat('coin', S.coinSVG());
export const milkPumpSVG = (o = {}) => pic(v('milk', o.fast && 'fast'), B.milkPumpSVG(o));
export const foamSVG = (o = {}) => pic(v('foam', o.fast && 'fast'), B.foamSVG(o));
export const shakerSVG = (state = 'idle', o = {}) => pic(state === 'busy' ? ['shaker-busy', 'shaker'] : v('shaker', o.auto && 'auto'), B.shakerSVG(state, o));
export const boardSVG = (o = {}) => pic(o.slicing ? ['board-slicing', 'board'] : ['board'], B.boardSVG(o));
export const waffleSVG = (o = {}) => {
  const pct = o.cookingPct == null ? 1 : o.cookingPct;
  const cooking = pct > 0 && pct < 1;
  return pic(cooking ? ['waffle-cooking', 'waffle'] : ['waffle'], B.waffleSVG(o), { ring: cooking ? pct : null });
};
export const snackBagSVG = () => flat('snack-bag', B.snackBagSVG());
export const snackSpotSVG = (n = 0) => pic(n > 0 ? [`snack-spot-${Math.min(3, n)}`] : ['snack-spot-0'], B.snackSpotSVG(n));
export const carryBagSVG = (n = 0) => pic(n > 0 ? [`bag-${Math.min(4, n)}`, 'bag-full'] : ['bag-0'], B.carryBagSVG(n));
export const fridgeSVG = () => pic('fridge', B.fridgeSVG());
export const lightBoxSVG = () => pic('lightbox', B.lightBoxSVG());
export const fanSVG = () => pic('fan', B.fanSVG());
export const registerSVG = () => pic('register', B.registerSVG());
export const cashTraySVG = () => pic('cash-tray', B.cashTraySVG());
export const tipJarSVG = () => pic('tip-jar', B.tipJarSVG());
export const towerStandSVG = () => pic('tower-stand', B.towerStandSVG());

// ─── the street and the shop front ─────────────────────────────────────────────────────────────────────────
export const streetSVG = (o = {}) => flat([`street${o.neon ? '-neon' : ''}${o.rail ? '-rail' : ''}`, o.neon && o.rail && 'street-neon', 'street'].filter(Boolean), W.streetSVG(o));
// the corner shop and our awning are painted into the street picture; drawn over a painting they would clash
const inStreet = (id, drawn) => (hasPic(id) ? flat(id, drawn) : hasPic('street') ? drawn.replace(/^(\s*<svg\b[^>]*>)[\s\S]*$/, '$1</svg>') : drawn);
export const cornerSVG = () => inStreet('corner', W.cornerSVG());
export const awningSVG = () => inStreet('awning', W.awningSVG());
export const helperSVG = (lv = 1) => flat(v('helper', lv >= 2 && '2'), W.helperSVG(lv));
export const acSVG = () => flat('ac', W.acSVG());
export const speakerSVG = () => flat('speaker', W.speakerSVG());
export const ticketMachineSVG = () => flat('ticket-machine', W.ticketMachineSVG());
// passing cars / scooters: car-1.., scooter-1.. picked by seed
export const vehicleSVG = (kind = 'car', seed = 1) => {
  let n = 0;
  while (hasPic(`${kind}-${n + 1}`)) n++;
  return n ? flat(`${kind}-${(seed % n) + 1}`, W.vehicleSVG(kind, seed)) : W.vehicleSVG(kind, seed);
};

// ─── the clerk (the cut-in panel) ──────────────────────────────────────────────────────────────────────────
// clerk = idle; clerk-hit (cursing), clerk-perfect (instantly polite again), clerk-polite; CSS shows the one for data-mood
export const clerkSVG = () => picSet('clerk', shopClerkSVG(), ['hit', 'perfect', 'polite']);

/** A 奧客's head for the day card: the top of its picture (the importer puts the head at the top), else `drawn`. */
export function okeHeadSVG(o, drawn) {
  const id = o && `oke-${o.type}`;
  if (!id || !hasPic(id)) return drawn;
  const href = picSrc(id).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<svg class="cust pic-head" viewBox="20 0 160 160" overflow="hidden" aria-hidden="true"><image href="${href}" x="0" y="0" width="200" height="480" preserveAspectRatio="xMidYMax meet"/></svg>`;
}

// ─── the list (tools/art/pic-ids.mjs, the brief) ───────────────────────────────────────────────────────────
const L = [];
const add = (group, id, svg, note = '') => L.push({ id, group, svg, note });
add('table', 'table', S.tableSVG, 'the whole work table, empty (stations stand on it)');
add('table', 'slot', S.workSlotSVG, 'a cup holder on the prep mat');
add('table', 'rack', S.cupRackSVG, 'stack of empty cups');
TEA_KINDS.forEach((k) => { add('station', `tea-${k}`, () => S.teaTankSVG(k), `${k} tea tank`); add('station', `tea-${k}-fast`, () => S.teaTankSVG(k, { fast: true }), `${k} tea tank, Lv2`); });
[1, 2, 3].forEach((n) => add('station', `manifold-${n}`, () => S.teaManifoldSVG(n), `Lv3 pipe over ${n} tea tanks`));
TOPPING_KINDS.forEach((k) => { add('station', `top-${k}`, () => S.toppingTraySVG(k, 10), `${k} tray, full`); add('station', `top-${k}-low`, () => S.toppingTraySVG(k, 3), `${k} tray, low`); add('station', `top-${k}-empty`, () => S.toppingTraySVG(k, 0), `${k} tray, empty`); });
add('station', 'lemon', () => S.lemonTraySVG(6, 6), 'lemon slices tray, full');
add('station', 'lemon-low', () => S.lemonTraySVG(2, 6), 'lemon tray, low');
add('station', 'lemon-empty', () => S.lemonTraySVG(0, 6), 'lemon tray, empty');
add('station', 'ice', S.iceBinSVG, 'ice bin');
add('station', 'ice-smart', S.iceDispenserSVG, 'ice dispenser (upgrade)');
add('station', 'syrup', S.syrupSVG, 'syrup pump bottle');
add('station', 'sealer', () => S.sealerSVG('idle'), 'cup sealer, idle');
add('station', 'sealer-busy', () => S.sealerSVG('busy'), 'cup sealer, pressing');
add('station', 'sealer-turbo', () => S.sealerSVG('idle', { turbo: true }), 'cup sealer Lv2, idle');
add('station', 'sealer-busy-turbo', () => S.sealerSVG('busy', { turbo: true }), 'cup sealer Lv2, pressing');
add('station', 'pot', () => S.potSVG({ scoops: 10 }), 'pearl pot, full');
add('station', 'pot-empty', () => S.potSVG({ scoops: 0 }), 'pearl pot, empty');
add('station', 'pot-cooking', () => S.potSVG({ scoops: 0, cookingPct: 0.5 }), 'pearl pot, cooking (steam)');
add('station', 'pot-rig', () => S.potRigSVG(3), 'auto-cook rig over the pot (upgrade)');
add('station', 'trash', S.trashSVG, 'trash bin');
[3, 4, 5, 6].forEach((n) => add('station', `shelf-${n}`, () => S.shelfSVG(n), `pickup shelf with ${n} spots (cups are drawn on it)`));
add('station', 'milk', () => B.milkPumpSVG(), 'milk pump');
add('station', 'milk-fast', () => B.milkPumpSVG({ fast: true }), 'milk pump Lv2');
add('station', 'foam', () => B.foamSVG(), 'cheese foam machine');
add('station', 'foam-fast', () => B.foamSVG({ fast: true }), 'cheese foam machine Lv2');
add('station', 'shaker', () => B.shakerSVG('idle'), 'shaker machine, idle');
add('station', 'shaker-busy', () => B.shakerSVG('busy'), 'shaker machine, shaking');
add('station', 'shaker-auto', () => B.shakerSVG('idle', { auto: true }), 'shaker machine Lv3');
add('station', 'board', () => B.boardSVG(), 'lemon cutting board + knife');
add('station', 'board-slicing', () => B.boardSVG({ slicing: true }), 'cutting board, knife down');
add('station', 'waffle', () => B.waffleSVG(), 'egg-waffle iron');
add('station', 'waffle-cooking', () => B.waffleSVG({ cookingPct: 0.5 }), 'egg-waffle iron, cooking');
[0, 1, 2, 3].forEach((n) => add('station', `snack-spot-${n}`, () => B.snackSpotSVG(n), `warmer with ${n} snack bags`));
add('station', 'snack-bag', B.snackBagSVG, 'one snack paper bag (dragged)');
[0, 1, 2, 3, 4].forEach((n) => add('station', `bag-${n}`, () => B.carryBagSVG(n), `carry bag with ${n} cups`));
add('decor', 'fridge', B.fridgeSVG, 'glass-door drinks fridge');
add('decor', 'lightbox', B.lightBoxSVG, 'menu light box (pictures, no words)');
add('decor', 'fan', B.fanSVG, 'desk fan');
add('decor', 'register', B.registerSVG, 'cash register');
add('decor', 'cash-tray', B.cashTraySVG, 'coin tray');
add('decor', 'tip-jar', B.tipJarSVG, 'tip jar');
add('decor', 'tower-stand', B.towerStandSVG, 'wooden stand for the cup tower');
add('decor', 'golden-card', S.goldenCardSVG, 'framed golden-ratio card');
add('decor', 'coin', S.coinSVG, 'coin (HUD, flying coins)');
add('street', 'street', () => W.streetSVG(), 'the night street band behind the counter, with the lit corner shop and our awning edge painted in');
add('street', 'street-neon', () => W.streetSVG({ neon: true }), 'street with the neon sign upgrade');
add('street', 'street-rail', () => W.streetSVG({ rail: true }), 'street with the queue stanchions');
add('street', 'street-neon-rail', () => W.streetSVG({ neon: true, rail: true }), 'both upgrades');
add('street', 'ac', W.acSVG, 'air conditioner (upgrade)');
add('street', 'speaker', W.speakerSVG, 'speaker (upgrade)');
add('street', 'ticket-machine', W.ticketMachineSVG, 'ticket machine (upgrade)');
[1, 2, 3].forEach((n) => { add('street', `car-${n}`, () => W.vehicleSVG('car', n), 'a passing car, side view'); add('street', `scooter-${n}`, () => W.vehicleSVG('scooter', n), 'a parked / passing scooter, no rider'); });
add('people', 'helper', () => W.helperSVG(1), 'the part-timer, bust');
add('people', 'helper-2', () => W.helperSVG(2), 'the part-timer Lv2 (gold star cap)');
const PERSON = () => '<svg class="walker-svg" viewBox="0 0 200 480"></svg>';
['', '-happy', '-mad', '-back'].forEach((m) => {
  ['one', 'c250', 'taste', 'lessIce', 'cutIn', 'bucket', 'phone', 'live'].forEach((t) => add('people', `oke-${t}${m}`, PERSON, `奧客 ${t}`));
  for (let n = 1; n <= 12; n++) add('people', `reg-${n}${m}`, PERSON, `regular customer ${n}`);
});
['', '-hit', '-perfect', '-polite'].forEach((m) => add('people', `clerk${m}`, shopClerkSVG, 'the clerk, cut-in panel'));
export const PIC_LIST = L;
