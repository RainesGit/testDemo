// check-killlist.mjs — docs/art-direction-v2.md section 9: "show, don't tell". Plays the day 1 opening and free play
// (keys), then days 2 and 3 (fast mouth, rage; an in-page player answers every sign), and samples the play screen
// every 100 ms (tools/killlist.mjs): no mechanic word (反差, 快嘴, ×2, 全倒, STRIKE, 爆氣, 小聲客氣 …) in the FX layers,
// at most one 花字 on screen, only allowed 花字 (X你媽 / 250 / 黃金比例最好喝 / day cards; S4 symbols only; no S3), no
// stage directions in the subtitles. It also checks what replaces the words: the subtitle punch (.sub-punch) popping
// on the beat, the cup stack and the edge speed lines in fast mouth, the red edge vignette in rage. Last it calls the
// old caption APIs directly (bowl(3), setSignMult('×2'), setQuick, effect('rageStart'), voiceToast, a 快嘴 / S3 花字,
// kick with a word, stampSlam with a caption, karaoke) and checks none of them puts words on screen.
// UI chrome words owned by package B (後面, 評級, 分貝級, HUD labels …) are reported as WARN (fatal with --strict).
// Usage: (serve game/ first) node tools/check-killlist.mjs [baseUrl] [--days=2,3] [--no-opening] [--strict]
import { installKillProbe, readKillProbe } from './killlist.mjs';
const pw = (await import('./pw.mjs')).default;

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const base = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765').replace(/\/$/, '');
const days = String(arg('days', '2,3')).split(',').filter(Boolean).map(Number);
const strict = process.argv.includes('--strict');
const withOpening = !process.argv.includes('--no-opening');
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`); };
const warnings = [];

async function newPage(url) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (r) => r.abort());
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__250);
  return { page, errors };
}

// a player that answers every sign 700 ms after it is ready, holds the boss's last step and mashes rage / events
const PLAYER = () => {
  const W = window.__250; const g = W.game;
  const KEY = { gun: 'j', shut: 'k', take: 'l' };
  const tap = (k, hold = 40) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: KEY[k] })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: KEY[k] })), hold); };
  g.on('ready', ({ customer, step }) => setTimeout(() => {
    const c = g.state.current;
    if (c && c.customer === customer) tap(c.key, customer.boss && step === 7 ? 900 : 40);
  }, 700));
  g.on('groupHit', ({ key }) => setTimeout(() => tap(key), 220));
  const mash = () => {
    const st = g.state;
    if (st.phase === 'over') return;
    if (st.phase === 'rage' || (st.event && st.event.type !== 'calculator')) tap(st.event?.type === 'stamp' ? 'take' : 'gun');
    if (st.event && st.event.type === 'calculator' && !st.event.holding) tap('take', 380);
    setTimeout(mash, 200);
  };
  mash();
};

function judge(label, k, { expectQuick = false, expectRage = false, punch = true } = {}) {
  if (!k) { check(`${label}: probe`, false, 'no samples'); return; }
  check(`${label}: no kill words in the FX layers`, k.hits.length === 0, k.hits.length ? k.hits.slice(0, 5).map((h) => `"${h.word}" in .${h.zone}: "${h.text}"`).join(' | ') : `${k.samples} samples clean`);
  check(`${label}: at most one 花字 on screen`, k.hzMax <= 1, `max ${k.hzMax} at once`);
  check(`${label}: only allowed 花字 (no S3, S4 symbols only)`, k.hzBad.length === 0, k.hzBad.slice(0, 4).map((h) => `${h.zone}:"${h.text}"`).join(' | ') || 'ok');
  check(`${label}: no stage directions in subtitles`, k.dirs.length === 0, k.dirs.slice(0, 2).map((d) => `"${d.text}"`).join(' | ') || 'ok');
  if (punch) check(`${label}: the punch is performed (.sub-punch pops on the beat)`, k.punchSeen && k.punchHitSeen, `punch ${k.punchSeen}, popped ${k.punchHitSeen}`);
  if (expectQuick) check(`${label}: fast mouth shown by the cup stack + edge lines`, k.quickSeen && k.cupsSeen >= 3, `stage.quick ${k.quickSeen}, cups ${k.cupsSeen}`);
  if (expectRage) check(`${label}: rage shown by the red edge vignette`, k.rageEdgeSeen, `vignette ${k.rageEdgeSeen}`);
  for (const w of k.warn) warnings.push(`${label}: "${w.word}" in .${w.zone}: "${w.text}"`);
}

// ---- 1: the opening and day 1 by keys (fresh storage)
if (withOpening) {
  const { page, errors } = await newPage(`${base}/index.html?debug&lang=zh&seed=7`);
  await page.waitForSelector('.start-screen:not(.hidden) .start-btn');
  await page.waitForTimeout(800);
  await installKillProbe(page);
  await page.click('.start-screen .start-btn', { force: true });
  const KEYMAP = { gun: 'j', shut: 'k', take: 'l' };
  const t0 = Date.now();
  let waitKey = null, since = 0, readyAt = null, cur = null;
  while (Date.now() - t0 < 160000) {
    const p = await page.evaluate(() => {
      const w = window.__250; const op = w.opening; const g = w.game; const s = g && g.state;
      return { opening: !!(op && (typeof op.active === 'function' ? op.active() : op.active)), waiting: op ? op.waiting : null,
        phase: s ? s.phase : null, closing: !!document.querySelector('.day-card'),
        cur: s && s.current ? { id: s.current.customer.id + ':' + (s.current.step || 0), key: s.current.customer.steps ? s.current.customer.steps[s.current.step || 0] : s.current.customer.key, speaking: !!s.current.speaking } : null };
    });
    if (p.closing || (!p.opening && p.phase === 'over')) break;
    if (p.waiting !== waitKey) { waitKey = p.waiting; since = Date.now(); }
    let key = null;
    if (p.opening && p.waiting && Date.now() - since > 800) { key = p.waiting; since = Date.now() + 400; }
    if (!p.opening && p.cur) {
      if (p.cur.id !== cur) { cur = p.cur.id; readyAt = null; }
      if (!p.cur.speaking && readyAt == null) readyAt = Date.now();
      if (readyAt && readyAt !== Infinity && Date.now() - readyAt > 300) { key = p.cur.key; readyAt = Infinity; }
    }
    if (key) { await page.keyboard.down(KEYMAP[key]); await page.waitForTimeout(30); await page.keyboard.up(KEYMAP[key]); }
    await page.waitForTimeout(60);
  }
  judge('opening + day 1', await readKillProbe(page));
  check('opening + day 1: no page errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  await page.close();
}

// ---- 2: days 2+ (fast mouth on day 2, rage on day 3)
await Promise.all(days.map(async (day) => {
  const { page, errors } = await newPage(`${base}/index.html?debug&skipOpening=1&day=${day}&lite=1&seed=2&lang=zh`);
  await page.evaluate(() => { try { localStorage.setItem('250cups.openingDone', '1'); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => window.__250);
  await page.waitForTimeout(1000);
  await installKillProbe(page);
  await page.click('.start-screen .start-btn', { force: true });
  await page.waitForFunction(() => window.__250?.game?.state.phase === 'playing');
  await page.evaluate(PLAYER);
  const t0 = Date.now();
  while (Date.now() - t0 < 110000) {
    const ph = await page.evaluate(() => window.__250.game.state.phase);
    if (ph === 'over') break;
    await page.waitForTimeout(500);
  }
  judge(`day ${day}`, await readKillProbe(page), { expectQuick: day === 2, expectRage: day === 3 });
  check(`day ${day}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  await page.close();
}));

// ---- 3: the old caption APIs, called directly during play, put no words on screen
{
  const { page, errors } = await newPage(`${base}/index.html?debug&skipOpening=1&day=2&lite=0&seed=3&lang=zh`);
  await page.evaluate(() => { try { localStorage.setItem('250cups.openingDone', '1'); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => window.__250);
  await page.waitForTimeout(800);
  await installKillProbe(page);
  await page.click('.start-screen .start-btn', { force: true });
  await page.waitForFunction(() => window.__250?.game?.state.phase === 'playing');
  await page.waitForTimeout(600);
  const api = await page.evaluate(async () => {
    const ui = window.__250.ui;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    ui.bowl(3, '全倒！');
    ui.setSignMult('×2');
    ui.setQuick(true, 7);
    ui.voiceToast('反差 +24dB', 'small');
    ui.huazi([{ text: '快嘴！', style: 'S1' }, { text: '一把掃過去！', style: 'S3' }, { text: '（呆住）', style: 'S4' }, { text: '狠罵！', style: 1 }]);
    ui.kick('gun', { word: '滾！', n: 1 });
    ui.stampSlam('啪！兩個月');
    ui.karaoke({ setup: '好的', punch: '滾！', key: 'gun' });
    ui.voiceStatus('安靜一秒……');
    await sleep(400);
    const sample = () => [...document.querySelectorAll('.stage .fx-layer, .stage .hz-layer, .stage .vmeter, .stage .sign-slot .sign-mult, .stage .hud-quick, .stage .karaoke .kk-tag')]
      .map((n) => (n.matches('.hz-layer') ? [...n.querySelectorAll('.hz.placed text')].map((t) => t.textContent).join(' ') : n.innerText || '')).join(' ');
    const a = sample();
    await sleep(500);
    ui.effect('rageStart', {});
    await sleep(300);
    const b = sample();
    ui.effect('rageEnd', {});
    ui.karaoke(null);
    const hz = [...document.querySelectorAll('.hz.placed')].map((h) => h.dataset.style + ':' + h.textContent);
    return { text: a + ' ' + b, hz };
  });
  const words = ['全倒', '×2', '快嘴', '反差', 'dB', '一把掃過去', '狠罵', '呆住', '啪！兩個月', '小聲客氣', '大聲罵', '安靜一秒', '爆氣'];
  const found = words.filter((w) => api.text.includes(w));
  check('old caption APIs show no words', found.length === 0, found.length ? `found ${found.join(', ')} in "${api.text.slice(0, 80)}"` : `fx text "${api.text.replace(/\s+/g, ' ').trim().slice(0, 60)}"; 花字 ${api.hz.join(', ') || 'none'}`);
  judge('API probe', await readKillProbe(page), { punch: false });
  check('API probe: no page errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  await page.close();
}

await browser.close();
for (const w of warnings) console.log(`WARN (package B chrome) ${w}`);
const failed = results.filter((r) => !r.ok).length + (strict ? warnings.length : 0);
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} checks passed${warnings.length ? `, ${warnings.length} B-chrome warnings` : ''}`);
process.exit(failed ? 1 : 0);
