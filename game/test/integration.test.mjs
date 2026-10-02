// Cross-module checks: content shapes match what engine / ui / main.js expect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getContent } from '../src/content.js';
import { createGame, MILESTONES } from '../src/engine.js';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clipKey } from '../src/audio.js';

const STYLES = ['real', 'curse', 'disdain', 'cold', 'deadpan', 'chuuni', 'math', '250', 'twist'];
const KEYS = ['gun', 'shut', 'take'];

for (const lang of ['zh', 'en']) {
  test(`content ${lang}: 100 customers with all fields`, () => {
    const { customers, system } = getContent(lang);
    assert.equal(customers.length, 100);
    assert.equal(new Set(customers.map((c) => c.id)).size, 100);
    for (const c of customers) {
      for (const f of ['name', 'says', 'reply']) assert.ok(c[f], `${lang} #${c.id} missing ${f}`);
      assert.ok(STYLES.includes(c.style), `#${c.id} style ${c.style}`);
      assert.ok(KEYS.includes(c.key), `#${c.id} key ${c.key}`);
    }
    for (const f of ['next', 'polite', 'boo', 'rageStart', 'rageLines', 'closing', 'signature250']) {
      assert.ok(Array.isArray(system[f]) && system[f].length, `${lang} SYSTEM.${f}`);
    }
    for (const lv of MILESTONES) assert.ok(system.milestones[lv], `${lang} milestone ${lv}`);
    for (const k of ['gun', 'shut', 'take', 'queue', 'aura', 'fury', 'start', 'again', 'bleep']) assert.ok(system.ui[k], `${lang} ui.${k}`);
  });
}

test('zh and en share the gameplay fields (engine runs on zh, text is looked up by id)', () => {
  const zh = getContent('zh').customers;
  const en = new Map(getContent('en').customers.map((c) => [c.id, c]));
  for (const c of zh) {
    const e = en.get(c.id);
    assert.deepEqual([e.style, e.key, e.cups], [c.style, c.key, c.cups], `#${c.id}`);
  }
});

test('a full 90s round with real content ends with a summary whose bestLineId resolves', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const { customers } = getContent('zh');
  const game = createGame({ customers, rng });
  let summary = null;
  game.on('over', (e) => { summary = e.summary; });
  game.start();
  let t = 0;
  while (game.state.phase !== 'over' && t < 120000) {
    game.tick(50); t += 50;
    const cur = game.state.current;
    if (game.state.phase === 'rage' && rng() < 0.3) game.press('gun');
    else if (cur && cur.patienceMaxMs - cur.patienceMs > 400) {
      // UI model: resolve on key-down, then upgrade while the key stays held
      const r = game.press(rng() < 0.8 ? cur.customer.key : 'gun', 0);
      const held = rng() * 1000;
      if (r && r.correct && held >= 300) { game.tick(300); game.charge(held >= 800 ? 2 : 1); }
    }
  }
  assert.ok(summary, 'game ended');
  assert.ok(summary.queue > 0);
  assert.ok(customers.some((c) => c.id === summary.bestLineId));
});

test('the 250 signature scene can trigger: a cups===250 customer answered with take', () => {
  for (const lang of ['zh', 'en']) {
    const { customers, system } = getContent(lang);
    assert.ok(customers.some((c) => c.cups === 250 && c.key === 'take'), lang);
    assert.ok(system.signature250.every((l) => (l.who === 'clerk' || l.who === 'cust') && l.text), lang);
  }
  // main.js flow: resolve → pause → (scene) → resume + bonus(25)
  const { customers } = getContent('zh');
  const c250 = customers.find((c) => c.cups === 250 && c.key === 'take');
  const other = customers.find((c) => c.style !== c250.style);
  const game = createGame({ customers: [c250, other], rng: () => 0, config: { gapMs: 250 } });
  game.on('resolve', (e) => { if (e.customer.cups === 250 && e.correct && e.key === 'take') game.pause(); });
  game.start();
  while (game.state.current.customer !== c250) {
    game.press(game.state.current.customer.key);
    game.tick(300);
  }
  const t0 = game.state.timeLeftMs;
  game.press('take');
  assert.equal(game.state.paused, true);
  game.tick(20000);
  assert.equal(game.state.timeLeftMs, t0);
  const q = game.state.queue;
  game.resume();
  game.bonus(25);
  assert.equal(game.state.queue, q + 25);
});

test('export-lines includes every signature250 line (clerk deadpan, customer first pool voice)', () => {
  const out = execFileSync(process.execPath, ['tools/voice/export-lines.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), maxBuffer: 16 * 1024 * 1024,
  });
  const jobs = new Map(JSON.parse(out).map((j) => [j.key, j]));
  for (const lang of ['zh', 'en']) {
    for (const { who, text } of getContent(lang).system.signature250) {
      const job = jobs.get(clipKey(lang, text));
      assert.ok(job, `${lang}: ${text}`);
      // a line shared with a customer/clerk line elsewhere keeps that job's casting (deduped by key)
      if (job.role === (who === 'cust' ? 'customer' : 'clerk') && job.voice) {
        assert.ok(who === 'cust' ? job.style === 'cust' : typeof job.style === 'string', text);
      }
    }
  }
});
