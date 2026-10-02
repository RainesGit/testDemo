// art.js — all character, prop and scene art for 《来250杯！》 as SVG / HTML strings.
// Pure string templates: no DOM access, no randomness except seeded (same input -> same output),
// safe to import from node for unit tests. Styling lives in style.css (spec docs/first-minute-spec.md §2).
//
// ─── Export contract (consumed by ui.js / opening.js) ──────────────────────────────────────────
//   CLERK_SVG : string
//       <svg class="clerk" data-mood="idle">. Set data-mood = idle|hit|perfect|polite|rage|over.
//       Overlay classes on the <svg>: squint, crack, brow (right brow up), look-down (head tilts to
//       the sign), sigh (shoulders sink), tidy (apron tug 80ms), point-sign (pointing arm aims at
//       the menu box #goldsign; use with mood hit), reach (half-raised ticket arm), stand (rage
//       climb). Badge/ticket text: text.c-badge, text.c-tk.
//   SHOP_SVG : string
//       Full-stage background, viewBox 0 0 360 640 (1:1 with the 9:16 stage), wrap it in
//       <div class="shop">. Holds the global <symbol>s #cup and #q-p and gradient #takeGrad, so it
//       must be in the document before COUNTER_SVG / monitor art. Live hooks:
//         text#callnum (number caller, write '000'..'999'), text#goldsign (menu box; set
//         data-gold on .shop to make it glow).
//   COUNTER_SVG : string
//       Counter lip + front + in-store queue silhouettes, same 360x640 frame; wrap it in
//       <div class="counter">. Set data-q="0".."3" on .counter for visible silhouettes
//       (min(queue,3)) and write queueCapText(queue) into text.q-num (capsule shows when data-q=3
//       and the text is non-empty; add class "cap" on .counter to show it).
//   queueCapText(queue) -> string            '+1,281' style capsule text ('' when queue <= 3)
//   customerSVG(customer, visitIndex = 0, { fixed, gray } = {}) -> string
//       <svg class="cust">, viewBox 0 0 200 200. Same id+visit -> same look. fixed: 'hesitant' |
//       'fifteen' | 'c250' (the three opening customers, also accepts 1|2|3). gray: true renders
//       the E12 desaturated copy (no CSS filter). Mount as
//       <div class="cust-wrap" data-face=""><div class="cust-clip">SVG</div></div>.
//       Faces (.cust-wrap[data-face]): gun | shut | take | gun2 (charged, flies to the monitor).
//       Other .cust-wrap classes: enter (220ms pop), rise (400ms hero rise), talk, drift (eyes
//       wander), proud (chin up), suck (pulled under the counter, mouth stays hidden), sink (600ms).
//   signText(customer, lang = 'zh') -> string    display text, lines joined by '\n'
//   signKind(customer) -> 'gun' | 'shut' | 'take' | 'trap'
//   signSVG(customer, lang = 'zh', { kind, text, scribble, mini, back } = {}) -> string
//       <div class="sign sign-KIND" data-kind data-state="down">: card, face, back, corner badge.
//       data-state: down (hidden) | rise (160ms rise, then set up) | up | out-gun | out-shut |
//       out-take | out (generic 150ms exit). Classes: flip-in (rotateY 180->0, 200ms), page
//       (rotateX page turn, 180ms), hint (corner badge pulses, §4.4). Timer: append
//       <i class="sign-timer"></i> to .sign-card at t0, drive style.transform = scaleX(left/total),
//       add class blink for the last 600ms. Shards for E4: <i class="sign-shard"> with --dx --dy --r.
//   miniSign(kind, text, lang = 'zh') -> string  small static sign for the recap / closing card
//   KEY_ICONS : { gun, shut, take }              corner badge SVGs (class key-icon), also for keys
//   FINGER_SVG : string                          comic pointing hand, fingertip at the top-left
//   DOOR_GATE_SVG : string                       roll-up iron shutter for beat A1 (<div class="gate">)
//   STAR_SVG : string                            4-point lemon star (charged gun landing)
//   ticketHTML(lines?) -> string                 E11/E12 lemon number ticket (No.001 / 250杯 / …)
//   MONITOR_SCENES : [{ id, min, name: {zh,en}, svg(queue, lang) }]   five door-monitor scenes
//   monitorScene(queue) -> index 0..4
//   monitorSVG(queue, lang = 'zh') -> string     inner <svg class="mon-svg"> for the right scene
//   monitorHTML(queue, lang = 'zh') -> string    <div class="monitor" data-scene>…</div>
//       Set data-zoom on .monitor for the milestone zoom (260ms in, 900ms parallax).
//   fnv1a(str), mulberry32(seed)                 seeded helpers (exported for tests)

// ─── Palette (mirrors :root in style.css) ──────────────────────────────────────────────────────
const INK = '#1B1311';
const CREAM = '#FFF4DC';
const GUN = '#E8402F';
const SHUT = '#6A4EE8';
const TAKE = '#FFC21A';
const LEMON = '#FFD23F';
const JADE = '#1FB57A';
const UNIFORM = '#2F2557';
const SKY = '#9ED8FF';
const MOUTH = '#5A1414';

// ─── Seeded helpers ────────────────────────────────────────────────────────────────────────────
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Shadow color rule (§2.1): color-mix(in srgb, c 78%, #1B1311), precomputed for SVG attributes.
function shade(hex, keep = 0.78) {
  const n = parseInt(hex.slice(1, 7), 16);
  const k = [16, 8, 0].map((s) => (n >> s) & 255);
  const d = [0x1b, 0x13, 0x11];
  return '#' + k.map((v, i) => Math.round(v * keep + d[i] * (1 - keep)).toString(16).padStart(2, '0')).join('');
}

function grayOf(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const y = Math.round(0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
  const h = y.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

// ─── Key icons (corner badges; 40-unit box, 0.8cqw ring at 9cqw) ───────────────────────────────
const icon = (key, ring, body) =>
  `<svg class="key-icon ki-${key}" viewBox="0 0 40 40" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round">` +
  `<circle cx="20" cy="20" r="17.5" fill="#fff" stroke="${ring}" stroke-width="3.6"/>${body}</g></svg>`;

export const KEY_ICONS = {
  // door + outward arrow
  gun: icon('gun', GUN,
    `<path fill="none" stroke="${INK}" stroke-width="2.6" d="M11 10 H21 V30 H11 Z"/>` +
    `<path fill="none" stroke="${GUN}" stroke-width="3.6" d="M17 20 H32 M26.5 14.5 L32 20 L26.5 25.5"/>`),
  // mouth crossed out
  shut: icon('shut', SHUT,
    `<path fill="${SHUT}" stroke="${INK}" stroke-width="2.4" d="M8.5 20 Q20 11 31.5 20 Q20 29 8.5 20 Z"/>` +
    `<path fill="none" stroke="${INK}" stroke-width="3.6" d="M12.5 12.5 L27.5 27.5 M27.5 12.5 L12.5 27.5"/>`),
  // number ticket
  take: icon('take', '#E0A100',
    `<path fill="${TAKE}" stroke="${INK}" stroke-width="2.6" d="M9 13 Q9 11 11 11 H29 Q31 11 31 13 V28 Q31 30 29 30 H11 Q9 30 9 28 Z"/>` +
    `<path fill="none" stroke="${INK}" stroke-width="2.6" d="M14 20 H26 M14 25 H22"/><circle cx="20" cy="15" r="1.8" fill="${INK}"/>`),
};

// ─── Clerk (§2.6) ──────────────────────────────────────────────────────────────────────────────
export const CLERK_SVG = `<svg class="clerk" viewBox="0 0 240 300" overflow="visible" data-mood="idle" aria-hidden="true">
<g class="c-all" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round">
<g class="c-body">
<path fill="${UNIFORM}" d="M36 300 L60 178 Q120 152 180 178 L204 300 Z"/>
<path fill="#221A40" stroke="none" d="M150 168 Q172 172 180 178 L204 300 H174 Z"/>
<path fill="${GUN}" d="M74 214 H166 L178 300 H62 Z"/>
<path fill="none" stroke-width="4" d="M84 214 L98 166 M156 214 L142 166"/>
<rect fill="${CREAM}" stroke-width="3" x="90" y="238" width="60" height="26" rx="6"/>
<text class="c-badge" x="120" y="258">250</text>
</g>
<path class="c-skin" d="M102 132 V170 Q120 180 138 170 V132 Z"/>
<path class="c-skin-sh" stroke="none" d="M104 140 H136 V158 Q120 164 104 158 Z"/>
<g class="c-head">
<path fill="${INK}" d="M60 108 Q52 30 120 28 Q188 30 180 108 Z"/>
<circle class="c-skin" cx="68" cy="100" r="12"/>
<circle class="c-skin" cx="172" cy="100" r="12"/>
<path class="c-skin" d="M68 84 Q68 40 120 40 Q172 40 172 84 L168 118 Q160 156 120 158 Q80 156 72 118 Z"/>
<path class="c-skin-sh" stroke="none" d="M76 128 Q120 150 164 128 Q156 154 120 156 Q84 154 76 128 Z"/>
<g fill="${INK}" stroke="none"><ellipse cx="113" cy="112" rx="3.5" ry="2.5"/><ellipse cx="127" cy="112" rx="3.5" ry="2.5"/></g>
<path class="c-bangs" fill="${INK}" d="M62 96 L72 58 L86 78 L98 50 L112 74 L126 46 L138 72 L152 52 L160 76 L178 96 Q188 26 120 24 Q52 26 62 96 Z"/>
<path fill="none" stroke="#4A3A34" stroke-width="4" d="M90 38 Q104 31 120 32"/>
<g class="m m-idle">
<path fill="none" d="M84 78 L108 80"/><path class="brow-r" fill="none" d="M132 74 Q146 64 158 72"/>
<g class="eyes"><path fill="#fff" d="M87 90 H109 Q109 101 98 101 Q87 101 87 90 Z M131 90 H153 Q153 101 142 101 Q131 101 131 90 Z"/>
<g class="pupils" fill="${INK}" stroke="none"><circle cx="99" cy="96" r="4"/><circle cx="143" cy="96" r="4"/></g></g>
<path fill="none" d="M108 134 Q124 138 136 126"/>
</g>
<g class="m m-hit">
<path fill="none" stroke-width="7" d="M82 70 L110 82 M158 70 L130 82"/>
<circle fill="#fff" cx="98" cy="94" r="11"/><circle fill="#fff" cx="142" cy="94" r="11"/>
<g fill="${INK}" stroke="none"><circle cx="98" cy="95" r="2.5"/><circle cx="142" cy="95" r="2.5"/></g>
<path fill="${MOUTH}" d="M96 122 Q120 114 144 122 Q146 156 120 160 Q94 156 96 122 Z"/>
<path fill="#fff" stroke-width="3" d="M100 123 Q120 117 140 123 L139 130 Q120 125 101 130 Z"/>
<ellipse fill="${GUN}" stroke="none" cx="120" cy="150" rx="13" ry="6"/>
<path class="vein" fill="none" stroke="${GUN}" stroke-width="4" d="M146 50 q4 6 10 4 M164 50 q-6 4 -4 10 M164 68 q-4 -6 -10 -4 M146 68 q6 -4 4 -10"/>
</g>
<g class="m m-calm">
<path fill="none" d="M84 76 H110 M130 76 H156"/>
<g stroke="none"><ellipse fill="${INK}" cx="98" cy="94" rx="5" ry="7"/><ellipse fill="${INK}" cx="142" cy="94" rx="5" ry="7"/>
<circle fill="#fff" cx="100" cy="91" r="2"/><circle fill="#fff" cx="144" cy="91" r="2"/></g>
<path fill="none" d="M110 134 H130"/>
</g>
<g class="m m-polite">
<path fill="none" d="M84 76 L108 68 M156 76 L132 68"/>
<path fill="none" d="M88 96 Q98 86 108 96 M132 96 Q142 86 152 96"/>
<rect fill="#fff" x="98" y="124" width="44" height="16" rx="5"/>
<path fill="none" stroke-width="3" d="M109 125 V139 M120 125 V139 M131 125 V139 M99 132 H141"/>
<path fill="${SKY}" stroke-width="3" d="M178 64 Q188 80 184 88 Q178 94 172 88 Q168 80 178 64 Z"/>
<path class="crack" fill="none" stroke-width="3" d="M96 118 L104 126 L99 134 L108 142 M144 118 L136 127 L142 135"/>
</g>
<g class="m m-rage">
<path fill="none" stroke-width="9" d="M80 66 L112 84 M160 66 L128 84"/>
<circle fill="#fff" cx="98" cy="96" r="13"/><circle fill="#fff" cx="142" cy="96" r="13"/>
<path fill="${MOUTH}" d="M90 120 Q120 110 150 120 Q154 166 120 170 Q86 166 90 120 Z"/>
<path fill="#fff" stroke-width="3" d="M93 122 L100 132 L107 122 L114 132 L120 121 L126 132 L133 122 L140 132 L147 122 Q120 113 93 122 Z"/>
<path class="vein" fill="none" stroke="${GUN}" stroke-width="5" d="M140 46 q5 8 13 5 M163 46 q-8 5 -5 13 M163 70 q-5 -8 -13 -5 M140 70 q8 -5 5 -13"/>
<g class="steam" fill="${CREAM}" stroke-width="3"><circle cx="48" cy="94" r="9"/><circle cx="38" cy="80" r="7"/><circle cx="32" cy="66" r="5"/>
<circle cx="192" cy="94" r="9"/><circle cx="202" cy="80" r="7"/><circle cx="208" cy="66" r="5"/></g>
</g>
</g>
<g class="a a-rest">
<path fill="${UNIFORM}" d="M62 200 Q44 250 54 300 H96 Q90 262 96 228 Z M178 200 Q196 250 186 300 H144 Q150 262 144 228 Z"/>
<ellipse class="c-skin" cx="76" cy="296" rx="24" ry="13"/><ellipse class="c-skin" cx="164" cy="296" rx="24" ry="13"/>
</g>
<g class="a a-point">
<g class="pt-rest"><path fill="${UNIFORM}" d="M178 200 Q196 250 186 300 H144 Q150 262 144 228 Z"/>
<ellipse class="c-skin" cx="164" cy="296" rx="24" ry="13"/></g>
<g class="pt-arm"><path fill="${UNIFORM}" d="M76 182 Q40 196 26 236 L56 252 Q66 222 96 206 Z"/>
<circle class="c-skin" cx="38" cy="252" r="24"/>
<path class="c-skin" d="M24 258 L-8 292 Q-12 302 -2 302 Q6 300 36 270 Z"/>
<path fill="none" stroke-width="3" d="M46 236 q8 6 4 14 M52 252 q6 6 0 12"/></g>
</g>
<g class="a a-ticket">
<path fill="${UNIFORM}" d="M62 200 Q44 250 54 300 H96 Q90 262 96 228 Z"/>
<ellipse class="c-skin" cx="76" cy="296" rx="24" ry="13"/>
<g class="tk-arm"><path fill="${UNIFORM}" d="M168 186 Q196 196 198 226 L174 232 Q172 212 150 204 Z"/>
<g transform="rotate(8 198 182)"><rect fill="${LEMON}" x="168" y="160" width="60" height="44" rx="6"/>
<text class="c-tk" x="198" y="191">250</text></g>
<circle class="c-skin" cx="186" cy="214" r="14"/></g>
</g>
<g class="a a-up">
<path fill="${UNIFORM}" d="M70 186 L24 124 L46 108 L94 176 Z M170 186 L216 124 L194 108 L146 176 Z"/>
<circle class="c-skin" cx="32" cy="110" r="20"/><circle class="c-skin" cx="208" cy="110" r="20"/>
</g>
</g>
</svg>`;

// ─── Customers (§2.7) ──────────────────────────────────────────────────────────────────────────
const SKIN = ['#F7D7B5', '#EDB98A', '#C98E62', '#8D5A3B']; // looks only; never tied to lines or keys
const HAIRC = [INK, '#4A2E1E', '#8A5A2B', '#BDB6AC'];
const HATC = [GUN, JADE, SHUT, LEMON];

const HAIR = {
  buzz: (c) => `<path fill="${c}" d="M38 112 Q36 44 100 42 Q164 44 162 112 Q150 70 100 66 Q50 70 38 112 Z"/>`,
  bowl: (c) => `<path fill="${c}" d="M30 104 Q28 30 100 28 Q172 30 170 104 L162 86 H38 Z"/>`,
  part: (c) => `<path fill="${c}" d="M34 130 Q26 36 100 32 Q174 36 166 130 L150 128 Q150 70 104 52 L100 60 L96 52 Q50 70 50 128 Z"/>`,
  bun: (c) => HAIR.buzz(c) + `<circle fill="${c}" cx="100" cy="26" r="20"/>`,
  // one path of overlapping circles (budget: one node instead of eight)
  curly: (c) => `<path fill="${c}" d="${[[40, 98], [44, 66], [64, 42], [92, 30], [122, 32], [148, 44], [160, 70], [162, 100]]
    .map(([x, y]) => `M${x - 19} ${y} a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0`).join(' ')}"/>`,
  tail: (c) => HAIR.part(c) + `<path fill="${c}" d="M160 70 Q198 82 190 132 Q180 112 164 104 Z"/>`,
};
const HAIR_KEYS = Object.keys(HAIR);
const HAT_OK = ['buzz', 'part', 'tail'];

const ACC = {
  glasses: () => `<g fill="#fff6" stroke-width="5"><circle cx="74" cy="104" r="18"/><circle cx="126" cy="104" r="18"/></g><path fill="none" stroke-width="5" d="M92 102 Q100 96 108 102"/>`,
  cap: (h) => `<path fill="${h}" d="M32 96 Q34 30 100 28 Q166 30 168 96 Z"/><path fill="${h}" d="M26 92 Q100 64 174 92 Q100 104 26 92 Z"/><path fill="${shade(h)}" stroke="none" d="M34 94 Q100 100 166 94 Q100 108 34 94 Z"/>`,
  phones: () => `<path fill="none" stroke-width="10" d="M30 110 Q30 18 100 18 Q170 18 170 110"/><rect fill="${UNIFORM}" x="16" y="96" width="24" height="36" rx="9"/><rect fill="${UNIFORM}" x="160" y="96" width="24" height="36" rx="9"/>`,
  mask: () => `<path fill="#EAF4F4" d="M36 126 Q100 114 164 126 L160 190 Q100 204 40 190 Z"/>`,
  shades: () => `<g fill="${INK}"><rect x="52" y="44" width="40" height="18" rx="8"/><rect x="108" y="44" width="40" height="18" rx="8"/></g>`,
  beanie: (h) => `<path fill="${h}" d="M30 96 Q30 20 100 20 Q170 20 170 96 Z"/><rect fill="${h}" x="28" y="80" width="144" height="20" rx="6"/><circle fill="${CREAM}" cx="100" cy="16" r="12"/>`,
};
const ACC_KEYS = Object.keys(ACC);
const HATS = ['cap', 'beanie'];
const HEADWEAR = ['cap', 'beanie', 'phones', 'shades']; // at most one thing on top of the head

const FIXED = {
  hesitant: { hair: 'bowl', acc: ['glasses'], skin: 1, hairC: 0, hatC: 0 },
  fifteen: { hair: 'buzz', acc: ['cap'], skin: 2, hairC: 1, hatC: 0 },
  c250: { hair: 'tail', acc: ['phones'], skin: 0, hairC: 2, hatC: 0 },
};
const FIXED_ALIAS = { 1: 'hesitant', 2: 'fifteen', 3: 'c250' };

/** Pick a customer's look. Pure; exported for tests. */
export function customerLook(customer, visitIndex = 0, fixed) {
  const fk = FIXED[fixed] ? fixed : FIXED_ALIAS[fixed];
  if (fk) {
    const f = FIXED[fk];
    return { hair: f.hair, acc: [...f.acc], skin: SKIN[f.skin], hairC: HAIRC[f.hairC], hatC: HATC[f.hatC], fixed: fk };
  }
  const id = customer && customer.id != null ? customer.id : String(customer ?? '');
  const rnd = mulberry32(fnv1a(`${id}:${visitIndex}`));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const skin = pick(SKIN);
  const hairC = pick(HAIRC);
  const hatC = pick(HATC);
  let hair = pick(HAIR_KEYS);
  const r = rnd();
  const count = r < 0.35 ? 0 : r < 0.8 ? 1 : 2;
  const acc = [];
  let guard = 0;
  while (acc.length < count && guard++ < 20) {
    const a = pick(ACC_KEYS);
    if (acc.includes(a)) continue;
    if (HEADWEAR.includes(a) && acc.some((x) => HEADWEAR.includes(x))) continue;
    acc.push(a);
  }
  if (acc.some((a) => HATS.includes(a)) && !HAT_OK.includes(hair)) hair = pick(HAT_OK); // re-draw the hair
  return { hair, acc, skin, hairC, hatC };
}

const EYES_UP =
  `<g class="f-up"><path class="brows" fill="none" stroke-width="5" d="M58 82 Q74 72 90 80 M110 80 Q126 72 142 82"/>` +
  `<path fill="#fff" stroke-width="4" d="M62 104 a12 14 0 1 0 24 0 a12 14 0 1 0 -24 0 M114 104 a12 14 0 1 0 24 0 a12 14 0 1 0 -24 0"/>` +
  `<g class="pupils" stroke="none"><path fill="#2A1A12" d="M69 97 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M121 97 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0"/>` +
  `<path fill="#fff" d="M69.8 94 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 M121.8 94 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0"/></g></g>`;

const FACES =
  // gun: swirl eyes + O mouth
  `<g class="x x-gun"><path fill="#fff" stroke-width="4" d="M60 104 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 M112 104 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0"/>` +
  `<path fill="none" stroke-width="4" d="M66 104 a8 8 0 1 1 8 8 a5 5 0 1 1 -5 -5 M118 104 a8 8 0 1 1 8 8 a5 5 0 1 1 -5 -5"/>` +
  `<ellipse fill="${MOUTH}" stroke-width="4" cx="100" cy="160" rx="12" ry="16"/></g>` +
  // shut: >< eyes + zipped mouth
  `<g class="x x-shut"><path fill="none" stroke-width="6" d="M62 94 L82 104 L62 114 M138 94 L118 104 L138 114"/>` +
  `<path fill="none" stroke-width="4" d="M80 164 H120 M88 158 V170 M100 158 V170 M112 158 V170"/></g>` +
  // take: big shine + tear + D grin + the yellow ticket in hand
  `<g class="x x-take"><path fill="#fff" stroke="none" d="M68 94 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M120 94 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0"/>` +
  `<path fill="${SKY}" stroke-width="3" d="M86 116 Q92 128 86 132 Q80 128 86 116 Z"/>` +
  `<path fill="${MOUTH}" stroke-width="4" d="M78 154 H122 Q122 184 100 184 Q78 184 78 154 Z"/>` +
  `<rect class="x-ticket" fill="${LEMON}" stroke-width="4" x="136" y="146" width="46" height="32" rx="5" transform="rotate(10 159 162)"/></g>`;

export function customerSVG(customer, visitIndex = 0, { fixed, gray = false } = {}) {
  const look = customerLook(customer, visitIndex, fixed);
  const g = gray ? grayOf : (c) => c;
  const skin = g(look.skin);
  const skinSh = g(shade(look.skin));
  const hairC = g(look.hairC);
  const hatC = g(look.hatC);
  const hair = HAIR[look.hair](hairC);
  const acc = look.acc.map((a) => ACC[a](hatC)).join('');
  const id = esc(customer && customer.id != null ? customer.id : '');
  return `<svg class="cust${gray ? ' gray' : ''}" viewBox="0 0 200 200" overflow="visible" aria-hidden="true" data-id="${id}" data-look="${look.hair}${look.acc.map((a) => '+' + a).join('')}">` +
    `<g class="h-all" stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">` +
    `<path fill="${skin}" d="M24 122 a12 13 0 1 0 24 0 a12 13 0 1 0 -24 0 M152 122 a12 13 0 1 0 24 0 a12 13 0 1 0 -24 0"/>` +
    `<ellipse fill="${skin}" cx="100" cy="120" rx="64" ry="74"/>` +
    `<path fill="${skinSh}" stroke="none" d="M46 150 Q100 196 154 150 Q146 190 100 194 Q54 190 46 150 Z M90 146 a5 3.4 0 1 0 10 0 a5 3.4 0 1 0 -10 0 M102 146 a5 3.4 0 1 0 10 0 a5 3.4 0 1 0 -10 0"/>` +
    `<path class="f-mouth" fill="none" stroke-width="4" d="M86 170 Q100 176 114 170"/>` +
    EYES_UP + hair + acc + FACES +
    `</g></svg>`;
}

// ─── Order signs (§6) ──────────────────────────────────────────────────────────────────────────
const STAGE_RE = /[（(][^）)]*[）)]/g;
const stripStage = (s) => String(s ?? '').replace(STAGE_RE, '').replace(/\|/g, '').trim();
const ZH_PARTICLE = /(喔|啦|齁|欸|啊|吧|谢谢|～|~)+$/;
const ZH_PUNCT_TAIL = /[。！!？?…~～\s]+$/;
const ZH_HESITANT = /^(嗯|那个|等一下)/;
const EN_HESITANT = /^(u+m+|uh+|hmm+|hold on|wait|oh,? you go)/i;

const ZH_INTERJ = /^[欸啊喔齁蛤嘿]+[～~？?！!\s]+/;
const ZH_FILLER = /^([欸啊喔齁蛤嘿嗯～~\s]+|那个|等一下|请问)[？?！!…]*$/;
const ZH_LEAD_PUNCT = /^[，,。！!？?…～~\s]+/;

function zhClause(text) {
  // Clauses end at ，。！ or at a ？ that has more text after it (the ？ stays on its clause).
  const clauses = text.replace(/([？?])(?=.)/g, '$1\u0000').split(/[，,。！!\u0000]/);
  for (const raw of clauses) {
    let c = raw.trim();
    if (ZH_FILLER.test(c)) continue;
    const q = /[？?]\s*$/.test(c);
    let prev;
    do {
      prev = c;
      c = c.replace(ZH_PUNCT_TAIL, '').replace(ZH_PARTICLE, '');
    } while (c !== prev && c);
    c = c.replace(ZH_INTERJ, '').replace(ZH_LEAD_PUNCT, '');
    if (c) return q ? c + '？' : c;
  }
  return '……';
}

const ZH_NO_LINE_START = /^[，,。！!？?…～~、）)]/;
// Latin/digit runs stay whole and count as ~0.55 of a CJK cell.
const zhTokens = (s) => s.match(/[A-Za-z0-9][A-Za-z0-9\-.%']*|./gsu) || [];
const tokW = (t) => (/^[A-Za-z0-9]/.test(t) ? t.length * 0.55 : 1);

function zhWrap(s) {
  const toks = zhTokens(s);
  const w = toks.map(tokW);
  const total = w.reduce((x, y) => x + y, 0);
  if (total <= 7) return s;
  const cut = (limit) => { // index of first token past `limit` cells
    let acc = 0;
    for (let i = 0; i < toks.length; i++) { acc += w[i]; if (acc > limit + 1e-9) return i; }
    return toks.length;
  };
  if (total <= 14) {
    // balanced two lines (max 7 cells each); never start line 2 with punctuation
    let b = cut(Math.ceil(total / 2));
    const max1 = cut(7);
    while (b < max1 && ZH_NO_LINE_START.test(toks[b])) b++;
    while (b > 1 && ZH_NO_LINE_START.test(toks[b] || '')) b--;
    return toks.slice(0, b).join('') + '\n' + toks.slice(b).join('');
  }
  const b1 = cut(7);
  let acc = 0;
  let l2 = '';
  for (let i = b1; i < toks.length && acc + w[i] <= 5; i++) { acc += w[i]; l2 += toks[i]; }
  l2 = l2.replace(/[，,。！!？?…～~\s]+$/, '');
  return toks.slice(0, b1).join('') + '\n' + l2 + '……';
}

function enWrap(s, max = 18) {
  const words = s.split(/\s+/).filter(Boolean);
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w;
    else if ((cur + ' ' + w).length <= max) lines[lines.length - 1] = cur + ' ' + w;
    else lines.push(w);
  }
  if (lines.length > 2) {
    let l2 = lines[1];
    while (l2.length > max - 1) l2 = l2.slice(0, -1);
    return lines[0] + '\n' + l2.replace(/[\s,.;:!?]+$/, '') + '…';
  }
  return lines.map((l) => (l.length > max ? l.slice(0, max - 1) + '…' : l)).join('\n');
}

/** Text shown on a customer's order sign (§6.3). */
export function signText(customer, lang = 'zh') {
  if (!customer) return '';
  if (customer.sign) return String(customer.sign);
  const en = lang === 'en';
  if (customer.cups != null) return en ? `${customer.cups} ${customer.cups === 1 ? 'cup' : 'cups'}` : `${customer.cups}杯`;
  const says = stripStage(customer.says);
  if (en) {
    if (customer.key !== 'shut' && EN_HESITANT.test(says)) return 'Ummm…';
    const first = (says.match(/^[^,.;!…—]*[?]?/) || [says])[0].trim() || says;
    return first ? enWrap(first) : '…';
  }
  if (customer.key !== 'shut' && ZH_HESITANT.test(says)) return '嗯……';
  return zhWrap(zhClause(says));
}

export function signKind(customer) {
  if (!customer) return 'gun';
  if (customer.cups === 249) return 'trap';
  return customer.key === 'shut' || customer.key === 'take' ? customer.key : 'gun';
}

const REQ_ZH = ['不要太冰', '正常冰', '去冰', '少冰', '微冰', '多冰', '无糖', '半糖', '微糖', '少糖', '少甜', '全糖', '去糖', '甜度', '冰块', '常温', '热的', '温的', '加珍珠', '去珍珠'];
const REQ_EN = /\b(no ice|less ice|light ice|extra ice|no sugar|half sugar|less sugar|sugar|ice|extra|swap|without|warm|hot)\b/i;

function circleFirst(line, lang, done) {
  if (done.v) return esc(line);
  let idx = -1;
  let len = 0;
  if (lang === 'en') {
    const m = REQ_EN.exec(line);
    if (m) { idx = m.index; len = m[0].length; }
  } else {
    for (const w of REQ_ZH) {
      const i = line.indexOf(w);
      if (i >= 0 && (idx < 0 || i < idx || (i === idx && w.length > len))) { idx = i; len = w.length; }
    }
  }
  if (idx < 0) return esc(line);
  done.v = true;
  return esc(line.slice(0, idx)) +
    `<span class="sign-circle">${esc(line.slice(idx, idx + len))}<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="50" cy="20" rx="47" ry="17"/></svg></span>` +
    esc(line.slice(idx + len));
}

const jade = (html) => html.replace(/翡翠柠檬/g, '<span class="jade">翡翠柠檬</span>');

// Text cells: CJK = 1, Latin/digits ≈ 0.55. Used to fit sign text (font size in cqw via --fs).
const cellsOf = (line) => [...line].reduce((a, c) => a + (/[\u2e80-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.55), 0);
const FIT = { gun: [31, 15, 9], take: [38, 19, 8], trap: [38, 19, 8], shut: [44, 99, 7.5] }; // [width, height, max]
function fitSize(kind, lines, hesitant) {
  const [w, h, max] = FIT[kind] || FIT.gun;
  const cells = Math.max(1, ...lines.map(cellsOf));
  const fs = Math.min(hesitant ? 10 : max, w / cells, h / (lines.length * 1.12));
  return Math.max(3.6, Math.round(fs * 10) / 10);
}

function signBody(kind, text, lang, scribble) {
  const lines = String(text).split('\n');
  const num = /^(\d{1,4})\s*(杯|cups?)$/i.exec(lines[0]);
  if (num && lines.length === 1 && kind !== 'shut') {
    return `<div class="sign-text is-num"><span class="sign-num">${num[1]}</span><span class="sign-unit">${esc(num[2])}</span></div>`;
  }
  if (kind === 'shut') {
    const done = { v: false };
    const body = lines.map((l) => `<span class="sign-line">${circleFirst(l, lang, done)}</span>`).join('');
    const scr = scribble
      ? `<span class="sign-scribble">${[...String(scribble)].map((c, i) => `<i style="--i:${i}">${esc(c)}</i>`).join('')}</span>`
      : '';
    return `<div class="sign-text" style="--fs:${fitSize(kind, lines)}cqw">${body}${scr}</div>`;
  }
  const hes = /^(嗯|Um)/.test(lines[0]) && lines.length === 1;
  return `<div class="sign-text${hes ? ' is-hesitant' : ''}" style="--fs:${fitSize(kind, lines, hes)}cqw">` +
    `${lines.map((l) => `<span class="sign-line">${jade(esc(l))}</span>`).join('')}</div>`;
}

/** Order sign markup (§6.1). Mount inside .cam at the sign anchor; see the contract above. */
export function signSVG(customer, lang = 'zh', { kind, text, scribble, mini = false, back = false } = {}) {
  const k = kind || signKind(customer);
  const t = text != null ? String(text) : signText(customer, lang);
  const badge = k === 'trap' ? 'gun' : k;
  const big = customer && customer.cups === 250 && k === 'take' && !mini;
  const deco =
    k === 'gun' ? '<i class="sign-tape t1"></i><i class="sign-tape t2"></i>'
      : k === 'take' || k === 'trap' ? '<i class="sign-hole"></i>' : '';
  const extra =
    k === 'shut' ? '<i class="sign-strike"></i>'
      : k === 'take' ? `<i class="sign-stamp">${lang === 'en' ? 'DEAL' : '收'}</i>`
        : k === 'trap' ? '<svg class="sign-crack" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M58 0 L50 18 L60 30 L46 46 L52 60"/></svg>' : '';
  const cls = `sign sign-${k}${mini ? ' mini' : ''}${big ? ' is-250' : ''}${back ? ' show-back' : ''}`;
  return `<div class="${cls}" data-kind="${k}" data-state="${mini ? 'up' : 'down'}" lang="${lang === 'en' ? 'en' : 'zh'}">` +
    (big ? '<div class="sign-burst"></div>' : '') +
    `<div class="sign-card"><div class="sign-face">${deco}${signBody(k, t, lang, scribble)}${extra}</div>` +
    `<div class="sign-back"></div><span class="sign-badge">${KEY_ICONS[badge]}</span></div></div>`;
}

export function miniSign(kind, text, lang = 'zh') {
  return signSVG(null, lang, { kind, text, mini: true });
}

// ─── Props ─────────────────────────────────────────────────────────────────────────────────────
export const FINGER_SVG = `<svg class="finger-svg" viewBox="0 0 60 80" overflow="visible" aria-hidden="true">
<g stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">
<path fill="${GUN}" d="M34 62 L58 50 L66 74 L44 84 Z"/>
<path fill="#F4C9A0" d="M8 6 Q3 10 6 15 L24 40 Q16 44 20 52 L34 66 Q46 74 56 60 Q62 50 56 40 L48 30 Q44 25 38 28 Q36 22 30 24 Q27 19 21 22 L13 8 Q11 4 8 6 Z"/>
<path fill="none" stroke-width="2.4" d="M30 24 L36 33 M38 28 L43 36 M21 22 L28 32"/>
</g>
</svg>`;

export const STAR_SVG = `<svg class="star-svg" viewBox="0 0 40 40" aria-hidden="true"><path fill="${LEMON}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" d="M20 2 L24 16 L38 20 L24 24 L20 38 L16 24 L2 20 L16 16 Z"/></svg>`;

export const DOOR_GATE_SVG = `<svg class="gate-svg" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<rect width="360" height="640" fill="#5E6266"/>
<path stroke="#3E4246" stroke-width="3" d="${Array.from({ length: 39 }, (_, i) => `M0 ${16 + i * 16} H360`).join(' ')}"/>
<path stroke="#7E8388" stroke-width="1.5" d="${Array.from({ length: 39 }, (_, i) => `M0 ${19 + i * 16} H360`).join(' ')}"/>
<text class="gate-tag" x="180" y="300" transform="rotate(-8 180 300)">来250杯</text>
<rect x="-10" y="610" width="380" height="40" fill="${INK}"/>
<rect x="150" y="594" width="60" height="16" rx="5" fill="#2A2D30" stroke="${INK}" stroke-width="3"/>
</svg>`;

export function ticketHTML(lines = ['No.001', '250杯', '两个月后取餐']) {
  const [a, b, c] = lines;
  return `<div class="ticket"><i class="ticket-hole"></i><b class="ticket-no">${esc(a ?? '')}</b>` +
    `<span class="ticket-cups">${esc(b ?? '')}</span><span class="ticket-when">${esc(c ?? '')}</span></div>`;
}

// ─── Shop background (§2.8) ────────────────────────────────────────────────────────────────────
// Vertical vanishing point VP = (180, -896) (-140% of 640).
const VPY = -896;
const toVP = (xb, yb, y) => 180 + (xb - 180) * (y - VPY) / (yb - VPY);
const r1 = (n) => Math.round(n * 10) / 10;

function brickPaths() {
  const v = [];
  for (let k = -5; k <= 5; k++) v.push(`M${180 + 36 * k} 304 L${180 + 33 * k} 22`);
  const h = [];
  let y = 304;
  let gap = 32;
  while (y - gap > 22) {
    y -= gap;
    h.push(`M-80 ${r1(y)} H440`);
    gap *= 0.94;
  }
  return { v: v.join(' '), h: h.join(' ') };
}

const BRICKS = brickPaths();
const CUP = `<symbol id="cup" viewBox="0 0 14 24"><path d="M1 3 H13 L11 23 H3 Z" fill="${CREAM}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 10 H12 L11 23 H3 Z" fill="#B8865A" stroke="none"/><path d="M8 3 L10 -3" stroke="${INK}" stroke-width="1.6" fill="none"/></symbol>`;
const QP = `<symbol id="q-p" viewBox="0 0 20 40"><circle cx="10" cy="8" r="7"/><path d="M0 40 Q0 18 10 17 Q20 18 20 40 Z"/></symbol>`;
const shelfCups = (x0) => Array.from({ length: 5 }, (_, i) => `<use href="#cup" x="${x0 + i * 16}" y="174" width="14" height="24"/>`).join('');

export const SHOP_SVG = `<svg class="shop-svg" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" overflow="visible" aria-hidden="true">
<defs>${CUP}${QP}<linearGradient id="takeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${TAKE}"/><stop offset="1" stop-color="#E0A100"/></linearGradient></defs>
<rect x="-120" y="-120" width="600" height="900" fill="${INK}"/>
<rect x="-120" y="22" width="600" height="290" fill="#F4C77E"/>
<g fill="none" stroke="#DDAE66" stroke-width="1.6"><path d="${BRICKS.v}"/><path d="${BRICKS.h}"/></g>
<rect x="-120" y="-120" width="600" height="142" fill="#6B3A1E"/>
<path fill="#4A2814" d="M-120 22 H480 V28 H-120 Z"/>
<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">
<path d="M100 22 V34 M260 22 V34" fill="none"/>
<path fill="${UNIFORM}" d="M88 34 H112 L118 46 H82 Z M248 34 H272 L278 46 H242 Z"/>
<path fill="${CREAM}" d="M92 46 a8 6 0 0 0 16 0 Z M252 46 a8 6 0 0 0 16 0 Z"/>
</g>
<g class="lightbox" stroke-linejoin="round">
<polygon points="58,52 302,52 306,92 54,92" fill="${INK}" stroke="${INK}" stroke-width="4"/>
<polygon points="63,56 297,56 300,88 60,88" fill="${CREAM}"/>
<path d="M180 56 V88" stroke="#DDAE66" stroke-width="1.6"/>
<text class="lb-text" x="92" y="69"><tspan x="92" y="69">翡翠柠檬</tspan><tspan x="92" y="85">75</tspan></text>
<g class="gs-glow"><text class="lb-text gs-g3" x="268" y="69"><tspan x="268" y="69">黄金比例</tspan><tspan x="268" y="85">不能调</tspan></text><text class="lb-text gs-g2" x="268" y="69"><tspan x="268" y="69">黄金比例</tspan><tspan x="268" y="85">不能调</tspan></text><text class="lb-text gs-g1" x="268" y="69"><tspan x="268" y="69">黄金比例</tspan><tspan x="268" y="85">不能调</tspan></text></g>
<text class="lb-text goldsign" id="goldsign" x="268" y="69"><tspan x="268" y="69">黄金比例</tspan><tspan x="268" y="85">不能调</tspan></text>
</g>
<g class="caller">
<rect x="14" y="104" width="84" height="42" rx="6" fill="${INK}" stroke="#3A2C27" stroke-width="1.6"/>
<text class="caller-label" x="94" y="117">取餐号码</text>
<text class="caller-num ghost" x="56" y="142">888</text>
<text id="callnum" class="caller-num" x="56" y="142">000</text>
</g>
<g stroke="${INK}" stroke-width="1.6">
<rect x="-40" y="198" width="124" height="6" fill="#6B3A1E"/><rect x="276" y="198" width="124" height="6" fill="#6B3A1E"/>
<path fill="#4A2814" stroke="none" d="M-40 204 H84 V208 H-40 Z M276 204 H400 V208 H276 Z"/>
</g>
${shelfCups(2)}${shelfCups(278)}
</svg>`;

// ─── Counter (front layer; above the clerk) ────────────────────────────────────────────────────
function woodLines() {
  const out = [];
  for (let i = 1; i <= 9; i++) {
    const xb = -40 + (440 / 10) * i;
    out.push(`M${r1(toVP(xb, 474, 314))} 314 L${r1(xb)} 474 L${r1(xb + (xb - 180) * 0.12)} 700`);
  }
  return out.join(' ');
}

export const COUNTER_SVG = `<svg class="counter-svg" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" overflow="visible" aria-hidden="true">
<g stroke-linejoin="round">
<path fill="#6B3A1E" stroke="${INK}" stroke-width="1.6" d="M10.8 314 H349.2 L400 474 L430 700 H-70 L-40 474 Z"/>
<path fill="none" stroke="#5A3018" stroke-width="2.4" d="${woodLines()}"/>
<path fill="#4A2814" d="M10.8 314 H349.2 L351 322 H9 Z"/>
<path fill="#4A2814" d="M0 306 H360 V314 H0 Z"/>
<path fill="#8A4B24" stroke="${INK}" stroke-width="1.6" d="M-8 294 H368 V306 H-8 Z"/>
<path fill="none" stroke="#A7602F" stroke-width="1.6" d="M-8 297 H368"/>
<rect x="222" y="326" width="110" height="32" rx="4" fill="#FFD23F" stroke="${INK}" stroke-width="2"/>
<path fill="${shade(LEMON)}" d="M224 352 H330 V356 H224 Z"/>
<text class="plaque-text" x="277" y="348">现点现做</text>
</g>
<g class="q-in" fill="#2F2557">
<use class="q-p1" href="#q-p" x="188" y="402" width="36" height="72" opacity=".85"/>
<use class="q-p2" href="#q-p" x="238" y="418" width="29" height="58" opacity=".7"/>
<use class="q-p3" href="#q-p" x="285" y="430" width="23" height="46" opacity=".55"/>
</g>
<g class="q-cap"><rect x="262" y="446" width="76" height="24" rx="12" fill="${INK}" stroke="#FFD23F" stroke-width="2"/><text class="q-num" x="300" y="463"></text></g>
</svg>`;

export function queueCapText(queue) {
  const n = Math.floor(Number(queue) || 0);
  return n > 3 ? '+' + (n - 3).toLocaleString('en-US') : '';
}

// ─── Door monitor: five scenes (§2.8; design doc 7.1). Generic shapes only. ─────────────────────
// viewBox 86x64 = the monitor at 1:1 on a 360px stage. Layers L0 (far) .. L3 (near) drive the
// milestone parallax. Crowds use <use href="#q-p"> (≤ 40 per scene): every 3rd figure is 1.1x
// taller, every 4th checks a sky-blue phone.
const MW = 86;
const MH = 64;
function crowd(pts, h, color = UNIFORM) {
  const people = [];
  const phones = [];
  pts.slice(0, 40).forEach(([x, y], i) => {
    const hh = i % 3 === 2 ? h * 1.1 : h;
    const w = hh / 2;
    people.push(`<use href="#q-p" x="${r1(x - w / 2)}" y="${r1(y - hh)}" width="${r1(w)}" height="${r1(hh)}"/>`);
    if (i % 4 === 3) phones.push(`M${r1(x + w * 0.3)} ${r1(y - hh * 0.86)} h${r1(w * 0.18)} v${r1(hh * 0.15)} h-${r1(w * 0.18)} Z`);
  });
  return `<g fill="${color}">${people.join('')}</g>` + (phones.length ? `<path fill="${SKY}" d="${phones.join(' ')}"/>` : '');
}
const along = (n, x0, y0, x1, y1) =>
  Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  });
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

const LABEL = {
  door: { zh: '门口', en: 'DOOR' },
  arcade: { zh: '骑楼', en: 'ARCADE' },
  metro: { zh: '捷运出口', en: 'METRO' },
  news: { zh: '新闻快报', en: 'NEWS' },
  aerial: { zh: '空拍', en: 'SKY CAM' },
};
const LIVE_IDS = []; // the blinking red dot reads as LIVE; the word does not fit at ≥12px
function monLabel(id, lang) {
  const text = LABEL[id][lang === 'en' ? 'en' : 'zh'] + (LIVE_IDS.includes(id) ? ' LIVE' : '');
  const w = 20 + [...text].reduce((a, c) => a + (/[\u2e80-\u9fff]/.test(c) ? 14 : 8.6), 0);
  return `<g class="mon-tag"><rect x="1.5" y="1.5" width="${r1(w)}" height="17" rx="2" fill="#000a"/>` +
    `<circle class="mon-dot" cx="8" cy="10" r="3" fill="#FF3B30"/><text class="mon-label" x="14" y="15">${esc(text)}</text></g>`;
}

export const MONITOR_SCENES = [
  {
    id: 'door', min: 0, name: LABEL.door,
    svg: (q) => {
      const n = clampN(2 + q / 3, 2, 18);
      return `<g class="L0"><rect x="-20" y="-20" width="126" height="104" fill="#26312C"/><path fill="#33403A" d="M-20 38 H106 V84 H-20 Z"/></g>` +
        `<g class="L1"><path fill="${GUN}" stroke="${INK}" stroke-width="1" d="M-4 14 H44 L46 22 H-6 Z"/><path fill="${CREAM}" d="M4 14 H10 L11 22 H4 Z M18 14 H24 L25 22 H18 Z M32 14 H38 L39 22 H32 Z"/>` +
        `<rect x="6" y="22" width="30" height="24" fill="#8A6A3A" stroke="${INK}" stroke-width="1"/><rect x="14" y="28" width="14" height="18" fill="#F4C77E"/></g>` +
        `<g class="L2">${crowd(along(n, 26, 50, 92, 58), 14)}</g>` +
        `<g class="L3"><path fill="none" stroke="#5B6B62" stroke-width="1.5" d="M-20 60 H106"/></g>`;
    },
  },
  {
    id: 'arcade', min: 50, name: LABEL.arcade,
    svg: (q) => {
      const n = clampN(12 + (q - 50) / 8, 12, 30);
      const cols = [8, 30, 52, 74].map((x) => `M${x} 14 V60 H${x + 6} V14 Z`).join(' ');
      const scooters = [6, 24, 42, 60, 78].map((x) => `M${x} 56 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M${x + 10} 56 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M${x + 2} 53 H${x + 14} L${x + 12} 49 H${x + 6} Z`).join(' ');
      return `<g class="L0"><rect x="-20" y="-20" width="126" height="104" fill="#3A3F48"/><path fill="#525866" d="M-20 4 H106 V14 H-20 Z"/><path fill="#F4C77E" opacity=".5" d="M2 20 h8 v6 h-8 Z M40 20 h8 v6 h-8 Z M64 20 h8 v6 h-8 Z"/></g>` +
        `<g class="L1">${crowd([...along(Math.ceil(n / 2), 2, 44, 84, 44), ...along(Math.floor(n / 2), 6, 49, 88, 49)], 11)}</g>` +
        `<g class="L2"><path fill="#C8B79A" stroke="${INK}" stroke-width="1" d="${cols}"/></g>` +
        `<g class="L3"><path fill="#7E8794" stroke="${INK}" stroke-width=".8" d="${scooters}"/></g>`;
    },
  },
  {
    id: 'metro', min: 200, name: LABEL.metro,
    svg: (q) => {
      const n = clampN(14 + (q - 200) / 30, 14, 34);
      return `<g class="L0"><rect x="-20" y="-20" width="126" height="104" fill="#1F2733"/><path fill="#2C3646" d="M-20 50 H106 V84 H-20 Z"/></g>` +
        `<g class="L1"><path fill="#9AA4B2" stroke="${INK}" stroke-width="1" d="M30 10 H84 V50 H30 Z"/><path fill="#1F2733" d="M36 22 H78 V50 H36 Z"/>` +
        `<rect x="40" y="12" width="22" height="8" rx="1.5" fill="${CREAM}" stroke="${INK}" stroke-width=".8"/><rect x="64" y="12" width="8" height="8" rx="1.5" fill="${LEMON}" stroke="${INK}" stroke-width=".8"/>` +
        `<path fill="none" stroke="${INK}" stroke-width="1.2" d="M43 16 H57 M53 13.5 L57 16 L53 18.5"/></g>` +
        `<g class="L2"><path fill="#5C6676" d="M40 50 L76 24 H80 L44 50 Z"/>${crowd([...along(Math.ceil(n * 0.4), 44, 49, 76, 26), ...along(Math.floor(n * 0.6), 2, 58, 40, 52)], 10)}</g>` +
        `<g class="L3"><use href="#q-p" x="4" y="30" width="12" height="24" fill="#2F6FA8"/><rect x="0" y="22" width="20" height="9" rx="1.5" fill="${LEMON}" stroke="${INK}" stroke-width=".8"/><path fill="none" stroke="${INK}" stroke-width="1.2" d="M4 26.5 H16 M12 24 L16 26.5 L12 29"/></g>`;
    },
  },
  {
    id: 'news', min: 800, name: LABEL.news,
    svg: (q, lang) => {
      const n = clampN(22 + (q - 800) / 80, 22, 38);
      const loop = [];
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const a = t * Math.PI * 2;
        loop.push([43 + Math.cos(a) * 30, 46 + Math.sin(a) * 7]);
      }
      const ticker = lang === 'en' ? 'BREAKING  ENDLESS LINE AT TEA STAND  ' : '快讯  夜市惊现超长人龙  民众：被骂很爽  ';
      return `<g class="L0"><rect x="-20" y="-20" width="126" height="104" fill="#2E3B55"/><path fill="#3F4E6C" d="M-4 40 V18 H8 V40 Z M66 40 V12 H76 V40 Z M78 40 V22 H90 V40 Z"/></g>` +
        `<g class="L1"><path fill="#8C9BB4" stroke="${INK}" stroke-width="1" d="M36 44 V8 L43 2 L50 8 V44 Z"/><path fill="none" stroke="#5E6E8A" stroke-width="1" d="M36 16 H50 M36 24 H50 M36 32 H50"/></g>` +
        `<g class="L2">${crowd(loop, 7)}</g>` +
        `<g class="L3"><rect x="-2" y="48" width="90" height="17" fill="${GUN}"/><text class="mon-ticker" x="25" y="60.5">${esc(ticker)}</text>` +
        `<rect x="-2" y="48" width="24" height="17" fill="${INK}"/><text class="mon-flash" x="10" y="60.5">LIVE</text></g>`;
    },
  },
  {
    id: 'aerial', min: 2500, name: LABEL.aerial,
    svg: () => {
      const blocks = [];
      for (let y = -2; y < 66; y += 17) for (let x = -2; x < 88; x += 21) blocks.push(`M${x} ${y} h16 v12 h-16 Z`);
      return `<g class="L0"><rect x="-20" y="-20" width="126" height="104" fill="#4E5A4C"/></g>` +
        `<g class="L1"><path fill="#7A8576" stroke="#3F4A3D" stroke-width=".8" d="${blocks.join(' ')}"/></g>` +
        `<g class="L2"><path class="snake" fill="none" stroke="${UNIFORM}" stroke-width="2.6" stroke-dasharray="0.1 3" stroke-linecap="round" pathLength="600" d="M-4 15.5 H82 V32 H2 V49 H84 V66"/></g>` +
        `<g class="L3" fill="none" stroke="${CREAM}" stroke-width="1.2"><path d="M4 22 V18 H8 M78 18 H82 V22 M82 56 V60 H78 M8 60 H4 V56"/><path d="M43 34 V44 M38 39 H48"/></g>`;
    },
  },
];

export function monitorScene(queue) {
  const q = Number(queue) || 0;
  let i = 0;
  MONITOR_SCENES.forEach((s, k) => { if (q >= s.min) i = k; });
  return i;
}

export function monitorSVG(queue, lang = 'zh') {
  const s = MONITOR_SCENES[monitorScene(queue)];
  return `<svg class="mon-svg" data-scene="${s.id}" viewBox="0 0 ${MW} ${MH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
    s.svg(Number(queue) || 0, lang) + monLabel(s.id, lang) + '</svg>';
}

export function monitorHTML(queue, lang = 'zh') {
  const s = MONITOR_SCENES[monitorScene(queue)];
  return `<div class="monitor" data-scene="${s.id}"><div class="mon-screen">${monitorSVG(queue, lang)}</div></div>`;
}
