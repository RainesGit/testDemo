// Traditional-script display conversion (src/hant.js): Taiwan / Hong Kong builds show Traditional characters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { toHant, HANT_CHARS, HANT_SAME } from '../src/hant.js';
import { getContent } from '../src/content.js';

const strings = (o) => (typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(strings) : o && typeof o === 'object' ? Object.values(o).flatMap(strings) : []);

test('toHant converts the signature lines and UI words', () => {
  assert.equal(toHant('调你妈！黄金比例最好喝！'), '調你媽！黃金比例最好喝！');
  assert.equal(toHant('我们都是现点现做，250杯，两个月后过来拿。'), '我們都是現點現做，250杯，兩個月後過來拿。');
  assert.equal(toHant('取餐号码 门口 翡翠柠檬 第一天 打烊'), '取餐號碼 門口 翡翠檸檬 第一天 打烊');
  assert.equal(toHant('（拍柜台）'), '（拍櫃檯）');
  assert.equal(toHant('250 Cups! abc'), '250 Cups! abc');
});

test('toHant is idempotent on every content string (the DOM observer re-reads what it wrote)', () => {
  for (const s of strings(getContent('zh'))) {
    const once = toHant(s);
    assert.equal(toHant(once), once, s);
  }
});

test('every Han character used in src/ was checked when the table was generated (regenerate hant.js otherwise)', () => {
  const known = new Set([...HANT_CHARS, ...HANT_SAME]);
  const dir = new URL('../src/', import.meta.url);
  const unknown = new Set();
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js') && n !== 'hant.js')) {
    for (const ch of readFileSync(new URL(f, dir), 'utf8').match(/[㐀-鿿]/g) || []) if (!known.has(ch)) unknown.add(ch);
  }
  assert.deepEqual([...unknown], [], 'new characters: add them to src/hant.js (see its header)');
});
