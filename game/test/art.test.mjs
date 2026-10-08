// art.test.mjs — pure checks for src/art.js (spec docs/first-minute-spec.md §2, §6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLERK_SVG, SHOP_SVG, COUNTER_SVG, customerSVG, customerLook, signSVG, signText, signKind, miniSign, KEY_ICONS,
  FINGER_SVG, DOOR_GATE_SVG, STAR_SVG, ticketHTML, MONITOR_SCENES, monitorScene, monitorSVG, monitorHTML,
  queueCapText, fnv1a, mulberry32,
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

test('clerk: five expression groups, four arm poses, mood attribute, spec hooks', () => {
  for (const m of ['m-idle', 'm-hit', 'm-calm', 'm-polite', 'm-rage']) assert.ok(CLERK_SVG.includes(`class="m ${m}"`), m);
  for (const a of ['a-rest', 'a-point', 'a-ticket', 'a-up']) assert.ok(CLERK_SVG.includes(`class="a ${a}"`), a);
  assert.match(CLERK_SVG, /^<svg class="clerk" viewBox="0 0 240 300"[^>]*data-mood="idle"/);
  for (const hook of ['class="eyes"', 'class="crack"', 'class="c-head"', 'class="c-body"', 'class="c-all"', 'class="c-bangs"', 'class="vein"', 'class="steam"', 'class="brow-r"', 'class="pt-arm"']) {
    assert.ok(CLERK_SVG.includes(hook), hook);
  }
  assert.ok(CLERK_SVG.includes('stroke-width="4.5"'));
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
  assert.deepEqual(customerLook(null, 0, 'hesitant'), { hair: 'bowl', acc: ['glasses'], skin: '#EDB98A', hairC: '#1B1311', hatC: '#E8402F', fixed: 'hesitant' });
  assert.equal(customerLook(null, 0, 2).hair, 'buzz');
  assert.deepEqual(customerLook(null, 0, 'fifteen').acc, ['cap']);
  assert.equal(customerLook(null, 0, 'fifteen').hatC, '#E8402F');
  assert.deepEqual(customerLook(null, 0, 'c250').acc, ['phones']);
  assert.equal(customerLook(null, 0, 'c250').skin, '#F7D7B5');
  const gray = customerSVG(null, 0, { fixed: 'c250', gray: true });
  for (const [, hex] of gray.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)) {
    const [r, g, b] = [1, 3, 5].map((i) => hex.slice(i, i + 2).toLowerCase());
    if (hex.toUpperCase() !== '#FFFFFF' && hex !== '#2A1A12' && hex !== '#5A1414' && hex !== '#9ED8FF' && hex !== '#FFD23F' && hex !== '#2F2557' && hex !== '#EAF4F4' && hex !== '#FFF4DC') {
      assert.ok(r === g && g === b, `non-gray ${hex}`);
    }
  }
});

test('customers: expression layers and the shared look-up eyes are present', () => {
  const s = customerSVG(byId(ZH, 46), 0);
  for (const cls of ['f-up', 'f-mouth', 'x x-gun', 'x x-shut', 'x x-take', 'h-all', 'pupils', 'brows']) assert.ok(s.includes(`class="${cls}"`), cls);
  assert.match(s, /viewBox="0 0 200 200"/);
  assert.match(s, /stroke-width="7"/);
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
  for (const s of ['viewBox="0 0 360 640"', 'preserveAspectRatio="xMidYMid slice"', 'id="callnum"', 'id="goldsign"', '<symbol id="cup"', '<symbol id="q-p"']) {
    assert.ok(SHOP_SVG.includes(s), s);
  }
  for (const s of ['q-p1', 'q-p2', 'q-p3', 'class="q-num"', '現點現做']) assert.ok(COUNTER_SVG.includes(s), s);
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

test('style.css: palette and fonts from §2.2/§2.4; old classes removed', () => {
  const css = readFileSync(new URL('style.css', ROOT), 'utf8');
  for (const v of ['--ink:#1B1311', '--take:#FFC21A', '--gun:#E8402F', '--shut:#6A4EE8', '--jade:#1FB57A', '--lemon:#FFD23F']) {
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

test('index.html loads the three font families and sets the theme color', () => {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  assert.ok(html.includes('family=Noto+Sans+TC:wght@700;900'));
  assert.ok(html.includes('LXGW+WenKai+TC'));
  assert.ok(html.includes('family=Bangers'));
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'));
  assert.ok(html.includes('<meta name="theme-color" content="#1B1311">'));
});
