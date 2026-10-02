// Cross-module checks: content shapes match what engine / ui / main.js expect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getContent } from '../src/content.js';
import { createGame, MILESTONES } from '../src/engine.js';

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
    else if (cur && cur.patienceMaxMs - cur.patienceMs > 400) game.press(rng() < 0.8 ? cur.customer.key : 'gun', rng() * 1000);
  }
  assert.ok(summary, 'game ended');
  assert.ok(summary.queue > 0);
  assert.ok(customers.some((c) => c.id === summary.bestLineId));
});
