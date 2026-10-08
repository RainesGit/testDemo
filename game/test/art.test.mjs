// art.test.mjs — pure checks for src/art.js (spec docs/first-minute-spec.md §2, §6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLERK_SVG, SHOP_SVG, COUNTER_SVG, customerSVG, customerLook, signSVG, signText, signKind, miniSign, KEY_ICONS,
  FINGER_SVG, DOOR_GATE_SVG, STAR_SVG, ticketHTML, MONITOR_SCENES, monitorScene, monitorSVG, monitorHTML,
  queueCapText, fnv1a, mulberry32, queueSilhouetteSVG, LOGO_SVG, logoSVG, cupStackSVG, cupStackCount,
  MEGAPHONE_SVG, PHONE_SVG, CALCULATOR_SVG, SLIPS_SVG, EVENT_PROP_SVG, PARTICLE_SVG,
} from '../src/art.js';
import { getContent } from '../src/content.js';

const ROOT = new URL('../', import.meta.url);
const ZH = getContent('zh').customers;
const EN = getContent('en').customers;
const byId = (list, id) => list.find((c) => c.id === id);
// Element count (opening tags), the unit of the §2.10 node budget.
const nodes = (s) => (s.match(/<(?!\/|!)[a-zA-Z][^>]*>/g) || []).length;
const EMOJI = /\p{Extended_Pictographic}/u;

test('seeded helpers are deterministic', () => {
  assert.equal(fnv1a('41:0'), fnv1a('41:0'));
  assert.notEqual(fnv1a('41:0'), fnv1a('41:1'));
  const a = mulberry32(7);
  const b = mulberry32(7);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('clerk: five expression groups, eight arm poses, mood attribute, spec hooks (art direction v2 §5.1)', () => {
  for (const m of ['m-idle', 'm-hit', 'm-calm', 'm-polite', 'm-rage']) assert.ok(CLERK_SVG.includes(`class="m ${m}"`), m);
  for (const a of ['a-rest-l', 'a-rest-r', 'a-point', 'a-sign', 'a-tidy', 'a-ticket', 'a-bow', 'a-up']) assert.ok(CLERK_SVG.includes(`class="a ${a}"`), a);
  assert.match(CLERK_SVG, /^<svg class="clerk" viewBox="-36 -52 332 382"[^>]*data-mood="idle"/);
  for (const hook of ['class="eyes"', 'class="crack"', 'class="c-head"', 'class="c-body"', 'class="c-all"', 'class="c-bangs"', 'class="vein"', 'class="steam"', 'class="brow-r"', 'class="brow-l"', 'class="c-badge"', 'class="c-tk"']) {
    assert.ok(CLERK_SVG.includes(hook), hook);
  }
  assert.ok(CLERK_SVG.includes('stroke-width="5"'), 'outer line 1.0cqw');
  // the resting hands live on the counter lip (COUNTER_SVG), so they are never hidden behind it
  for (const h of ['ch ch-l', 'ch ch-r']) assert.ok(COUNTER_SVG.includes(`class="${h}"`), h);
});

test('customers: same id + visit -> same look; looks vary', () => {
  const c = byId(ZH, 41);
  assert.equal(customerSVG(c, 0), customerSVG(c, 0));
  const looks = new Set(ZH.map((x) => customerSVG(x, 0)));
  assert.ok(looks.size > 80, `only ${looks.size} distinct looks`);
  assert.notEqual(customerSVG(c, 0), customerSVG(c, 1));
});

test('customers: combination rules and accessory rate', () => {
  let none = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const l = customerLook({ id: i }, i % 3);
    const hat = l.acc.some((a) => a === 'cap' || a === 'beanie');
    if (hat) assert.ok(['buzz', 'part', 'tail'].includes(l.hair), `hat with ${l.hair}`);
    if (l.acc.includes('shades')) assert.ok(!hat, 'shades with hat');
    assert.ok(l.acc.length <= 2);
    assert.equal(new Set(l.acc).size, l.acc.length);
    if (!l.acc.length) none++;
  }
  const rate = none / N;
  assert.ok(rate > 0.28 && rate < 0.42, `no-accessory rate ${rate}`);
});

test('customers: fixed opening looks and gray copy', () => {
  assert.deepEqual(customerLook(null, 0, 'hesitant'), { hair: 'bowl', acc: ['glasses'], skin: '#EDB98A', hairC: '#1B1311', hatC: '#EE4130', head: 'round', eyes: 'round', brows: 'worried', fixed: 'hesitant' });
  assert.equal(customerLook(null, 0, 2).hair, 'buzz');
  assert.deepEqual(customerLook(null, 0, 'fifteen').acc, ['cap']);
  assert.equal(customerLook(null, 0, 'fifteen').hatC, '#EE4130');
  assert.deepEqual(customerLook(null, 0, 'c250').acc, ['phones']);
  assert.equal(customerLook(null, 0, 'c250').skin, '#F7D7B5');
  const gray = customerSVG(null, 0, { fixed: 'c250', gray: true });
  // the expression layers (mouth, tear, ticket, pupils) keep their colours; everything else is grey
  const keep = ['#FFFFFF', '#2A1A12', '#5A1414', '#9EE3FF', '#FFD84A', '#EAF4F4', '#DFF4FF'];
  for (const [, hex] of gray.matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/g)) {
    const [r, g, b] = [1, 3, 5].map((i) => hex.slice(i, i + 2).toLowerCase());
    if (!keep.includes(hex.toUpperCase()) && hex !== '#1B1311') assert.ok(r === g && g === b, `non-gray ${hex}`);
  }
});

test('customers: expression layers, look-up eyes, backlit rim, line weight and variety (§5.2)', () => {
  const s = customerSVG(byId(ZH, 46), 0);
  for (const cls of ['f-up', 'f-mouth', 'f-nose', 'f-rim', 'x x-gun', 'x x-shut', 'x x-take', 'h-all', 'pupils', 'brows']) assert.ok(s.includes(`class="${cls}"`), cls);
  assert.match(s, /viewBox="0 0 200 200"/);
  assert.match(s, /stroke-width="5.2"/);
  const heads = new Set();
  const eyes = new Set();
  for (const c of ZH) { const l = customerLook(c, 0); heads.add(l.head); eyes.add(l.eyes); }
  assert.equal(heads.size, 3);
  assert.equal(eyes.size, 3);
});

test('customers: the day 7 boss has his own look and is drawn to the collar (§5.3)', () => {
  const s = customerSVG({ id: 900, key: 'gun', boss: true }, 0);
  assert.match(s, /^<svg class="cust boss" viewBox="0 0 200 250"/);
  assert.equal(customerLook({ id: 900, boss: true }).fixed, 'boss');
  const noId = (x) => x.replace(/ data-id="[^"]*"/, '');
  assert.equal(noId(s), noId(customerSVG({ id: 901, boss: true }, 3)), 'one boss look whatever the id / visit');
  for (const cls of ['f-up', 'x x-gun', 'x x-shut', 'x x-take']) assert.ok(s.includes(`class="${cls}"`), cls);
});

test('signText follows §6.3', () => {
  assert.equal(signText(byId(ZH, 1)), '嗯……');
  assert.equal(signText(byId(ZH, 6)), '嗯……'); // 等一下…
  assert.equal(signText(byId(ZH, 8)), '嗯……'); // 那個…
  assert.equal(signText(byId(ZH, 43)), '15杯');
  assert.equal(signText(byId(ZH, 47)), '250杯');
  assert.equal(signText(byId(ZH, 12)), '可以少冰嗎？');
  assert.equal(signText(byId(ZH, 14)), '微冰就好'); // trailing 謝謝喔～ dropped
  assert.equal(signText(byId(ZH, 33)), '我自備杯'); // stage direction dropped
  assert.equal(signText(byId(ZH, 3)), '你們推薦什麼？'); // lone 欸 skipped
  assert.equal(signText({ says: '甜度可以調嗎？可以嗎？可以嗎？可以嗎？' }), '甜度可以調嗎？');
  assert.equal(signText({ sign: '招牌翡翠檸檬' }), '招牌翡翠檸檬');
  assert.equal(signText({ says: '一二三四五六七八九十一二三四五六七' }), '一二三四五六七\n八九十一二……');
  assert.equal(signText(byId(ZH, 93)), '有Wi-Fi嗎？'); // Latin run is not split
  for (const c of ZH) {
    const lines = signText(c).split('\n');
    assert.ok(lines.length <= 2, `#${c.id}`);
    for (const l of lines) assert.ok([...l].length <= 8, `#${c.id} line "${l}"`);
  }
});

test('signText English', () => {
  assert.equal(signText(byId(EN, 41), 'en'), '1 cup');
  assert.equal(signText(byId(EN, 47), 'en'), '250 cups');
  assert.equal(signText(byId(EN, 1), 'en'), 'Ummm…');
  for (const c of EN) {
    const lines = signText(c, 'en').split('\n');
    assert.ok(lines.length <= 2, `#${c.id}`);
    for (const l of lines) assert.ok(l.length <= 18, `#${c.id} "${l}"`);
  }
});

test('sign kinds and shapes: color = key (R1), 249 trap', () => {
  assert.equal(signKind(byId(ZH, 1)), 'gun');
  assert.equal(signKind(byId(ZH, 12)), 'shut');
  assert.equal(signKind(byId(ZH, 46)), 'take');
  assert.equal(signKind(byId(ZH, 48)), 'trap');
  for (const c of ZH) {
    const s = signSVG(c, 'zh');
    const k = signKind(c);
    assert.ok(s.startsWith(`<div class="sign sign-${k}`), `#${c.id}`);
    assert.ok(s.includes('data-state="down"'));
    assert.ok(s.includes(`ki-${k === 'trap' ? 'gun' : k}`), `badge #${c.id}`);
    assert.ok(nodes(s) <= 22, `sign #${c.id} has ${nodes(s)} nodes`);
  }
  assert.ok(signSVG(byId(ZH, 47)).includes('sign-burst'), '250 gets the burst');
  assert.ok(!signSVG(byId(ZH, 46)).includes('sign-burst'));
  assert.ok(signSVG(byId(ZH, 12)).includes('<span class="sign-circle">少冰'), 'first request word circled');
  assert.ok(signSVG(null, 'zh', { kind: 'take', text: '招牌翡翠檸檬' }).includes('<span class="jade">翡翠檸檬</span>'));
  assert.ok(!signSVG(byId(ZH, 1)).includes('sign-timer'), 'no timer until t0 (A2)');
  assert.ok(signSVG({ id: 1, key: 'gun', says: '<b>&' }).includes('&lt;b&gt;&amp;'), 'text is escaped');
  assert.match(miniSign('shut', '少甜少冰'), /^<div class="sign sign-shut mini"/);
});

test('key icons, props and tickets', () => {
  for (const k of ['gun', 'shut', 'take']) assert.match(KEY_ICONS[k], new RegExp(`^<svg class="key-icon ki-${k}"`));
  assert.match(FINGER_SVG, /^<svg class="finger-svg"/);
  assert.match(DOOR_GATE_SVG, /viewBox="0 0 360 640"/);
  assert.match(STAR_SVG, /^<svg class="star-svg"/);
  const t = ticketHTML();
  for (const s of ['No.001', '250杯', '兩個月後取餐']) assert.ok(t.includes(s));
});

test('shop, counter and monitor hooks', () => {
  for (const s of ['viewBox="0 0 360 640"', 'preserveAspectRatio="xMidYMid slice"', 'id="callnum"', 'id="goldsign"', 'class="lb-text lb-1"', 'class="lb-text lb-2"',
    'class="wall-hi"', 'radialGradient id="wallGrad"', 'class="lamp lamp-l"', 'class="gs-cell"', '翡翠檸檬', '珍珠奶茶', '黃金比例', '不能調', '取餐號碼']) {
    assert.ok(SHOP_SVG.includes(s), s);
  }
  for (const s of ['q-p1', 'q-p2', 'q-p3', 'q-c1', 'q-c2', 'q-c3', 'class="q-num"', '現點現做', 'id="ctrSteel"', 'id="ctrFront"']) assert.ok(COUNTER_SVG.includes(s), s);
  // the queue outside is cool silhouettes without outlines (§5.4): no ink strokes in the queue group
  const q = COUNTER_SVG.slice(COUNTER_SVG.indexOf('<g class="q-crowd">'), COUNTER_SVG.indexOf('<g class="q-cap">'));
  assert.ok(q.length > 100 && !q.includes('#1B1311'), 'queue silhouettes have no ink outline');
  for (const i of [0, 1, 2]) assert.match(queueSilhouetteSVG(i), /^<svg class="pin-svg" viewBox="0 0 360 640"/);
  assert.equal(queueCapText(3), '');
  assert.equal(queueCapText(1284), '+1,281');
  assert.deepEqual(MONITOR_SCENES.map((s) => s.id), ['door', 'arcade', 'metro', 'news', 'aerial']);
  assert.deepEqual([0, 49, 50, 199, 200, 799, 800, 2499, 2500, 99999].map(monitorScene), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  for (const q of [0, 10, 60, 300, 1000, 5000]) {
    const s = monitorSVG(q, 'zh');
    for (const L of ['L0', 'L1', 'L2', 'L3']) assert.ok(s.includes(`class="${L}"`), `${q} ${L}`);
    assert.ok((s.match(/<use /g) || []).length <= 40);
    assert.ok(monitorSVG(q, 'en').length > 0);
  }
  assert.ok(monitorHTML(0).startsWith('<div class="monitor" data-scene="door">'));
});

test('shared art for packages B / C (§11): logo, cup tower, event props, particles', () => {
  assert.match(LOGO_SVG, /^<svg class="logo-svg"/);
  for (const s of ['class="lg-sign"', 'class="lg-250"', 'class="lg-shine"', 'class="lg-halo"']) assert.ok(LOGO_SVG.includes(s), s);
  assert.ok(!/<text/.test(LOGO_SVG), 'logo letters are outlines (no web font needed)');
  assert.notEqual(logoSVG('en'), LOGO_SVG);
  const ids = (s) => [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids(LOGO_SVG + logoSVG('en')).length, new Set(ids(LOGO_SVG + logoSVG('en'))).size, 'zh and en logos can share a page');
  assert.deepEqual([0, 4, 5, 9, 10, 19, 20, 99].map(cupStackCount), [0, 0, 3, 3, 5, 5, 7, 7]);
  for (const n of [0, 3, 5, 7]) {
    const s = cupStackSVG(n);
    assert.match(s, new RegExp(`^<svg class="cup-stack-svg" data-n="${n}"`));
    assert.ok(s.includes('class="cs-steam"'));
  }
  assert.ok(nodes(cupStackSVG(7)) < 20);
  assert.equal((MEGAPHONE_SVG.match(/class="mg-bar"/g) || []).length, 5);
  assert.ok(PHONE_SVG.includes('class="ph-name"') && PHONE_SVG.includes('前主管'));
  assert.ok(CALCULATOR_SVG.includes('class="calc-num"'));
  assert.equal((SLIPS_SVG.match(/class="slip"/g) || []).length, 6);
  assert.deepEqual(Object.keys(EVENT_PROP_SVG), ['megaphone', 'phone', 'calculator', 'stamp']);
  assert.deepEqual(Object.keys(PARTICLE_SVG), ['ice', 'pearl', 'ink', 'paper', 'cup']);
  for (const [k, v] of Object.entries(PARTICLE_SVG)) assert.match(v, new RegExp(`^<svg class="pt-svg pt-${k}"`));
});

test('performance budget (§2.10, A13): on-screen SVG nodes ≤ 400', () => {
  const clerk = nodes(CLERK_SVG);
  const shop = nodes(SHOP_SVG);
  const counter = nodes(COUNTER_SVG);
  const custMax = Math.max(...ZH.map((c) => nodes(customerSVG(c, 0))));
  const monMax = Math.max(...[0, 30, 49, 120, 199, 500, 799, 2000, 2499, 9000].map((q) => nodes(monitorSVG(q))));
  const signMax = Math.max(...ZH.map((c) => nodes(signSVG(c))));
  assert.ok(clerk <= 100, `clerk ${clerk}`);
  assert.ok(shop <= 120, `shop ${shop}`);
  assert.ok(custMax <= 40, `customer ${custMax}`);
  assert.ok(monMax <= 80, `monitor ${monMax}`);
  const total = clerk + shop + counter + custMax + monMax + signMax;
  assert.ok(total <= 360, `total ${total} leaves < 40 nodes for huazi / finger`);
});

test('symbol ids are unique across all art', () => {
  const all = [CLERK_SVG, SHOP_SVG, COUNTER_SVG, DOOR_GATE_SVG, FINGER_SVG, STAR_SVG, customerSVG(byId(ZH, 1), 0), monitorSVG(0), signSVG(byId(ZH, 47))].join('');
  const ids = [...all.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, ids.join(','));
});

test('hard rules: no emoji, no filters/blur in art.js and style.css (A11, §2.1)', () => {
  const art = readFileSync(new URL('src/art.js', ROOT), 'utf8');
  const css = readFileSync(new URL('style.css', ROOT), 'utf8');
  for (const [name, src] of [['art.js', art], ['style.css', css]]) {
    assert.ok(!EMOJI.test(src), `${name} has an emoji`);
    assert.ok(!/<filter/i.test(src), `${name} uses an SVG filter`);
    assert.ok(!/drop-shadow|blur\(|backdrop-filter/i.test(src), `${name} uses a filter effect`);
  }
  assert.ok(!/(^|[\s;{])filter\s*:/m.test(css), 'style.css uses filter:');
  const rendered = [CLERK_SVG, SHOP_SVG, COUNTER_SVG, ...ZH.map((c) => customerSVG(c, 0) + signSVG(c)), ...EN.map((c) => signSVG(c, 'en')), monitorSVG(5000, 'en')].join('');
  assert.ok(!EMOJI.test(rendered), 'rendered art has an emoji');
});

test('style.css: palette and fonts from art-direction-v2 2.1/3; old classes removed', () => {
  const css = readFileSync(new URL('style.css', ROOT), 'utf8');
  for (const v of ['--ink:#1B1311', '--take:#FFC21A', '--gun:#EE4130', '--shut:#7658F2', '--mint:#3CC98E', '--lemon:#FFD84A', '--paper:#FFF7E6', '--night-900:#0E1120']) {
    assert.ok(css.replace(/\s/g, '').includes(v), v);
  }
  for (const v of ['--font-zh:', '--font-sign:', '--font-en:']) assert.ok(css.includes(v), v);
  for (const gone of ['.queue-strip', '.door-icon', '.fan', '.clerk-head', '.clerk-cup', '.cust-tag', '.cust-bubble', '.flyer', '.ms-crowd', '--emoji', '--brass']) {
    assert.ok(!css.includes(gone), `${gone} still in style.css`);
  }
  for (const need of ['.cam', '.flash', '.letterbox', '.clerk', '.cust-clip', '.cust-wrap[data-face', '.sign', '.sign-timer', '.hz-layer', '.hz', '.finger',
    '.guide-line', '.btn[data-dim]', '.btn[data-glow]', '.btn-shut[data-covered]', '.btn .key-icon', '.monitor[data-zoom]', '.day-card', '.recap',
    'prefers-reduced-motion', 'pointer: fine']) {
    assert.ok(css.includes(need), `${need} missing`);
  }
  // A9: every font-size in cqw ≥ 3.4cqw (12.2px at 360px wide)
  for (const m of css.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)cqw/g)) {
    assert.ok(Number(m[1]) >= 3.4, `font size ${m[1]}cqw in "${m[0]}"`);
  }
});

test('index.html self-hosts the fonts (no Google Fonts, no Simplified fonts) and sets the theme color', () => {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  const css = readFileSync(new URL('style.css', ROOT), 'utf8');
  assert.ok(!/googleapis|gstatic/.test(html + css), 'Google Fonts still referenced');
  assert.ok(!/Sans SC|Serif SC|PingFang SC|Microsoft YaHei/.test(html + css), 'a Simplified font in a fallback chain');
  assert.ok(html.includes('<link rel="preload" as="font" type="font/woff2" crossorigin href="fonts/huninn.woff2">'));
  for (const f of ['huninn', 'baloo2-800', 'noto-sans-tc-500', 'noto-sans-tc-700', 'noto-sans-tc-900', 'wenkai-tc-700', 'dseg7-bold']) {
    assert.ok(css.includes(`url("fonts/${f}.woff2")`), `@font-face for ${f}`);
  }
  assert.ok(html.includes('<meta name="theme-color" content="#0E1120">'));
});
