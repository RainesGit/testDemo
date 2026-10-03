// Traditional-script display conversion (src/hant.js): Taiwan / Hong Kong builds show Traditional characters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { toHant, HANT_CHARS, HANT_SAME, PHRASES, TW_PHRASES, TW_WHOLE, TW_PUNCT } from '../src/hant.js';
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

// ---- Taiwan wording (TW_PHRASES / TW_WHOLE / TW_PUNCT; docs/localization-tw.md)

test('Taiwan wording replaces the mainland words in the lines that use them', () => {
  assert.equal(toHant('我要投诉你喔！'), '我要客訴你喔！');
  assert.equal(toHant('（递号码牌）投诉？排队。你第二百五号。'), '（遞號碼牌）客訴？排隊。你第二百五號。');
  assert.equal(toHant('（哗啦倒出一堆硬币）欸！100杯！'), '（嘩啦倒出一堆銅板）欸！100杯！');
  assert.equal(toHant('（盯着硬币山）这不是……钱，是怨念！收——！'), '（盯著銅板山）這不是……錢，是怨念！收——！');
  assert.equal(toHant('（抓扩音器）喂！'), '（抓大聲公）喂！');
  assert.equal(toHant('（铁门落地）……收摊。号码牌拿好。'), '（鐵捲門落地）……收攤。號碼牌拿好。');
  assert.equal(toHant('快讯  夜市惊现超长人龙  民众：被骂很爽  '), '快訊  夜市驚見超長人龍  民眾：被罵很爽  ');
  assert.equal(toHant('（亮杯：“两个月后来拿”）'), '（亮杯：「兩個月後來拿」）');
});

test('longest key wins: 倒喝采 becomes 喝倒彩, plain 喝采 keeps its form', () => {
  assert.equal(toHant('（全场倒喝采）嘘嘘嘘——'), '（全場喝倒彩）噓噓噓——');
  assert.equal(toHant('全场喝采'), '全場喝采');
});

test('short or ambiguous keys do not fire inside other words', () => {
  // 接客 is whole-text only (the report stat label)
  assert.equal(toHant('接客'), '接待');
  assert.equal(toHant(' 接客 '), ' 接待 ');
  assert.equal(toHant('迎接客人'), '迎接客人');
  assert.equal(toHant('直接客诉'), '直接客訴');
  // 赞 → 讚 only for the "like" count; 赞助 keeps 贊
  assert.equal(toHant('一赞一颗。你三个赞，三颗。'), '一讚一顆。你三個讚，三顆。');
  assert.equal(toHant('这个赞助'), '這個贊助');
  // 杆 → 桿 only in 电线杆; 念 → 唸 only when reading aloud
  assert.equal(toHant('第三根电线杆。'), '第三根電線桿。');
  assert.equal(toHant('杆子'), '杆子');
  assert.equal(toHant('（边打边念）二、五……零。'), '（邊打邊唸）二、五……零。');
  assert.equal(toHant('这边念头'), '這邊念頭');
  assert.equal(toHant('是怨念'), '是怨念');
  // quotes only change in Chinese text; English text is returned untouched
  assert.equal(toHant('He said “two months”.'), 'He said “two months”.');
});

test('the signature lines survive the Taiwan wording unchanged', () => {
  assert.equal(toHant('调你妈！'), '調你媽！');
  assert.equal(toHant('黄金比例最好喝！'), '黃金比例最好喝！');
  assert.equal(toHant('250杯，两个月后过来拿。'), '250杯，兩個月後過來拿。');
  assert.equal(toHant('（突然职业）二百五十杯——|什么？'), '（突然職業）二百五十杯——|什麼？');
});

test('no value re-triggers a key or the character map (idempotent by construction)', () => {
  const all = { ...PHRASES, ...TW_PHRASES, ...TW_WHOLE };
  for (const [k, v] of Object.entries(all)) {
    assert.equal(toHant(v), v, `${k} → ${v} changes again`);
    for (const k2 of Object.keys(all)) if (all[k2] !== k2) assert.ok(!v.includes(k2), `${v} contains key ${k2}`); // 喝采 → 喝采 is a no-op guard
  }
  for (const v of Object.values(TW_PUNCT)) assert.equal(toHant('字' + v), '字' + v);
});

test('every phrase entry is used by text shown on screen (no dead entries)', () => {
  // 干杯 / 饼干 guard the 干 → 幹 character mapping for future text; they are the only allowed unused keys.
  const GUARDS = new Set(['干杯', '饼干']);
  const dir = new URL('../src/', import.meta.url);
  const shown = [
    ...strings(getContent('zh')),
    ...readdirSync(dir).filter((n) => n.endsWith('.js') && !/^(hant|audio|content\.en)\.js$/.test(n)).map((f) => readFileSync(new URL(f, dir), 'utf8')),
    readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  ].join('\n');
  for (const k of [...Object.keys(PHRASES), ...Object.keys(TW_PHRASES), ...Object.keys(TW_PUNCT)]) {
    if (!GUARDS.has(k)) assert.ok(shown.includes(k), `unused entry ${k}`);
  }
  for (const k of Object.keys(TW_WHOLE)) assert.ok(shown.includes(`'${k}'`), `unused whole-text entry ${k}`);
});

test('every Taiwan entry changes at least one content or UI string', () => {
  const zh = strings(getContent('zh'));
  for (const k of [...Object.keys(TW_PHRASES), ...Object.keys(TW_PUNCT)]) {
    const s = zh.find((x) => x.includes(k));
    if (s) assert.ok(!toHant(s).includes(k), `${k} survived in ${toHant(s)}`);
  }
});
