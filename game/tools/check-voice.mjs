// Voice mode check (吼罵模式, docs/gameplay-v2.md 10): Chromium with a fake microphone that plays a synthesized voice loop
// (tools/voice-wav.mjs: room noise → soft setup → pause → loud shout → room → long shout), empty storage, ?input=voice.
// Start card → the microphone card (allow) → the day 1 opening answered by shouts → day 1 free play (shortened) by voice
// → day 3 until rage, swept by sustained shouting → the summary card's "今日最大聲" and its replay button.
// Fails on any console / page error, when the mic never got ready, on fewer than 3 voice answers, no 反差 bonus, no rage
// head swept by voice, no self-replay, no loudest-shout row, or the button pad on screen. Show, don't tell
// (docs/art-direction-v2.md 9–10): the line to say sits in the subtitle slot without labels (setup small, punch big),
// the meter has no words, and no kill word (反差, dB, 小聲客氣, 大聲罵, 開罵 …) shows in play (tools/killlist.mjs).
// Screenshots (390x844): voice-prompt, voice-karaoke, voice-karaoke-lit, voice-contrast, voice-meter, voice-rage,
// voice-summary in --out=<dir> (default tools/shots/).
// Usage: (serve game/ first) node tools/check-voice.mjs [baseUrl] [--out=dir]
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeVoiceWav } from './voice-wav.mjs';
import { installKillProbe, readKillProbe } from './killlist.mjs';
const pw = (await import('./pw.mjs')).default;

const base = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765';
const outArg = process.argv.find((a) => a.startsWith('--out='));
const out = outArg ? outArg.slice(6).replace(/\/?$/, '/') : new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const wav = writeVoiceWav(join(tmpdir(), '250cups-voice-test.wav'));

const browser = await pw.chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await context.grantPermissions(['microphone']).catch(() => {});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
let fontFails = 0;
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/Failed to load resource/.test(m.text()) && fontFails > 0) { fontFails--; return; }
  errors.push('console: ' + m.text());
});
page.on('requestfailed', (r) => {
  if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) { fontFails++; return; }
  // the self-hosted font subsets still loading when the page navigates away are aborted, not broken
  if (/\/fonts\/[\w-]+\.woff2$/.test(r.url()) && /ABORTED/.test(r.failure()?.errorText || '')) return;
  errors.push('requestfailed: ' + r.url());
});

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const shot = (name) => page.screenshot({ path: `${out}voice-${name}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const probe = () => page.evaluate(() => {
  const w = window.__250 || {};
  const op = w.opening;
  const s = w.game && w.game.state;
  const v = w.voice || {};
  const kara = document.querySelector('.karaoke');
  return {
    opening: !!(op && (typeof op.active === 'function' ? op.active() : op.active)),
    waiting: op ? op.waiting : null,
    phase: s ? s.phase : null, day: w.day, queue: s ? s.queue : 0, furyFull: s ? s.furyFull : false,
    current: !!(s && s.current),
    voice: v, inputs: w.inputs,
    karaoke: !!(kara && !kara.hidden && kara.textContent), karaokeLit: !!(kara && kara.classList.contains('lit')),
    // the line to say: plain (no tag labels), in the subtitle slot (its bottom at the subtitle band's bottom ± 4%),
    // setup smaller than the punch
    karaokeForm: (() => {
      if (!kara || kara.hidden || !kara.textContent) return null;
      const subs = document.querySelector('.subs').getBoundingClientRect();
      const k = kara.getBoundingClientRect();
      const stage = document.querySelector('.stage').getBoundingClientRect();
      const fs = (sel) => { const n = kara.querySelector(sel); return n ? parseFloat(getComputedStyle(n).fontSize) : null; };
      return { tags: kara.querySelectorAll('.kk-tag').length, inSlot: Math.abs(k.bottom - subs.bottom) <= stage.height * 0.04,
        setup: fs('.kk-setup .kk-text'), punch: fs('.kk-punch .kk-text') };
    })(),
    meterWords: (document.querySelector('.vmeter')?.innerText || '').trim(),
    summary: !!document.querySelector('.summary:not(.hidden) .report'),
    closing: !!document.querySelector('.day-card .dc-btn'),
    loudest: document.querySelector('.loudest-text')?.textContent || '',
    pad: (() => { const b = document.querySelector('.btn-gun'); return !!(b && b.getBoundingClientRect().width && getComputedStyle(b).display !== 'none'); })(),
  };
});

await page.goto(`${base}/index.html?debug&lang=zh`);
await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
await page.goto(`${base}/index.html?debug&lang=zh&input=voice`);
await page.evaluate(() => { window.__250.durationMs = 30000; });
await wait(1400);
await page.click('.start-btn', { force: true });
await page.waitForSelector('.voice-prompt', { timeout: 5000 }).catch(() => {});
const prompted = !!(await page.$('.voice-prompt'));
await shot('prompt');
await page.click('.vp-yes', { force: true }).catch(() => {});
await installKillProbe(page);
await wait(1500);
let p = await probe();
check('mic-ready', prompted && p.voice.ready, `prompt card ${prompted}; mic ready ${p.voice.ready}; floor ${p.voice.floor?.toFixed?.(1)} dBFS; recorder ${p.voice.canRecord}`);

// ---- the opening: every wait point answered by a shout
const shots = { karaoke: false, lit: false, contrast: false, meter: false, rage: false };
const forms = [];
const meterWords = new Set();
const t0 = Date.now();
let keyHelp = 0;
while (Date.now() - t0 < 80000) {
  p = await probe();
  if (!p.opening && p.phase === 'playing') break;
  if (Date.now() - t0 > 70000 && p.waiting) { await page.keyboard.press({ gun: 'j', shut: 'k', take: 'l' }[p.waiting]); keyHelp += 1; }
  await wait(150);
}
check('opening-by-voice', !p.opening && p.voice.stats.opening >= 3, `opening done ${!p.opening}; ${p.voice.stats.opening} wait points answered by shouting; ${keyHelp} key presses needed`);

// ---- watch a round: screenshots of the karaoke line (lit), the meter, the 反差 moment (no caption: the +N and the meter)
async function watch(until, ms) {
  const end = Date.now() + ms;
  let last = await probe();
  while (Date.now() < end) {
    const q = await probe();
    if (q.karaokeForm && forms.length < 50) forms.push(q.karaokeForm);
    if (q.meterWords) meterWords.add(q.meterWords);
    if (q.karaoke && !q.karaokeLit && !shots.karaoke) { shots.karaoke = true; await shot('karaoke'); }
    if (q.karaokeLit && !shots.lit) { shots.lit = true; await shot('karaoke-lit'); }
    if (q.voice.level >= 1 && !shots.meter && q.current) { shots.meter = true; await shot('meter'); }
    if (q.voice.stats.contrast > last.voice.stats.contrast && !shots.contrast) { shots.contrast = true; await wait(120); await shot('contrast'); }
    if (q.phase === 'rage' && q.voice.stats.rage > 1 && !shots.rage) { shots.rage = true; await shot('rage'); }
    last = q;
    if (until(q)) return q;
    await wait(60);
  }
  return last;
}
p = await watch((q) => q.phase === 'over' || q.closing, 45000);
const d1 = p.voice.stats;
check('voice-answers', d1.answers >= 3, `day 1: ${d1.answers} answers by voice (${d1.charge2} at 吼), ${d1.jab} jabs / next by voice; inputs ${JSON.stringify(p.inputs)}`);
check('karaoke', shots.karaoke && shots.lit, `karaoke line shown ${shots.karaoke}, lit by the voice ${shots.lit}`);
const badForm = forms.filter((f) => f.tags > 0 || !f.inSlot || (f.setup && f.punch && f.setup >= f.punch));
check('karaoke-plain', forms.length > 0 && badForm.length === 0,
  `${forms.length} samples; labels / out of the subtitle slot / setup not smaller: ${badForm.length}${badForm[0] ? ' ' + JSON.stringify(badForm[0]) : ''}`);
check('no-pad', !p.pad, 'button pad hidden in voice mode');

// ---- day 3 until rage; sustained shouting sweeps the heads (the day 1 closing card's button opens day 2 first)
await page.waitForSelector('.day-card .dc-btn.ready', { timeout: 8000 }).catch(() => {});
await page.click('.day-card .dc-btn', { force: true }).catch(() => {});
await wait(800);
await page.evaluate(() => { window.__250.durationMs = 60000; window.__250.startDay(3); });
const rageBefore = (await probe()).voice.stats.rage;
p = await watch((q) => q.phase === 'rage' || q.furyFull, 50000);
let rageStarted = p.phase === 'rage';
if (!rageStarted && p.furyFull) {
  p = await watch((q) => q.phase === 'rage', 6000); // the next shout starts rage
  rageStarted = p.phase === 'rage';
}
if (rageStarted) p = await watch((q) => q.phase !== 'rage', 9000);
const rageHits = p.voice.stats.rage - rageBefore;
check('rage-by-voice', rageStarted && rageHits >= 2, `rage ${rageStarted}; ${rageHits} heads swept by sustained shouting`);
p = await watch((q) => q.phase === 'over', 65000);
const st = p.voice.stats;
check('contrast', st.contrast >= 1, `${st.contrast} contrast bonuses (soft setup ≥ 300 ms, then 吼), contrast ${st.contrastDb.join(' / ')} dB; ${st.peaks} peaks`);
check('self-replay', st.replays >= 1, `${st.replays} shouts replayed through the megaphone chain`);
const kill = await readKillProbe(page);
check('meter-no-words', meterWords.size === 0, meterWords.size ? `meter text: ${[...meterWords].join(' / ')}` : 'notches, mic and megaphone icons only');
check('kill-list', kill && kill.hits.length === 0 && kill.hzBad.length === 0 && kill.hzMax <= 1,
  kill ? `${kill.samples} samples; ${kill.hits.slice(0, 4).map((h) => `"${h.word}" in .${h.zone}`).join(', ') || 'no kill words'}; 花字 bad ${kill.hzBad.length}, max at once ${kill.hzMax}` : 'no probe');

// ---- summary: the loudest shout and its replay
await page.waitForSelector('.summary:not(.hidden) .report', { timeout: 8000 }).catch(() => {});
await wait(600);
p = await probe();
await shot('summary');
const before = p.voice.stats.replays;
await page.click('.loudest-btn', { force: true }).catch(() => {});
await wait(300);
const after = (await probe()).voice.stats.replays;
check('loudest', /\d+/.test(p.loudest) && after > before, `"${p.loudest}"; replay button ${after > before ? 'played it' : 'did nothing'}`);
check('no-errors', errors.length === 0, errors.slice(0, 5).join(' | ') || 'none');

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed; shots in ${out}`);
process.exit(failed.length ? 1 : 0);
