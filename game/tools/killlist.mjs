// killlist.mjs — the docs/art-direction-v2.md section 9 kill list as a page probe, shared by tools/check-killlist.mjs
// and tools/check-voice.mjs. "Show, don't tell": no mechanic names or explanations on the play screen.
//
// installKillProbe(page) adds window.__kill (sampling every 100 ms while a round or the opening runs) and returns
// readKillProbe(page) → { samples, hits: [{ word, zone, text, t }], warn: [...], hzMax, hzBad: [...], dirs: [...],
//   punchSeen, punchHitSeen, quickSeen, cupsSeen, rageEdgeSeen, karaokeTags }.
//
// Zones: subtitles, the karaoke line, signs and props (lightbox, counter, monitor, number ticket) are spoken lines or
// content and are only checked for stage directions; the play-screen FX layers (花字, floating text, particles, meter,
// cup stack …) must not show any kill word (package C, `hits`); the UI chrome (HUD, cards, day banner, event panel,
// preview, gesture chips) belongs to package B and its kill words are reported as `warn` (fatal with --strict).

// package C: never anywhere outside spoken lines
export const KILL_C = ['反差', '快嘴', '×2', '×1.5', '×1.2', '全倒', 'STRIKE', '小聲客氣', '大聲罵', '爆氣', '一把掃過去', '亂按都對', '狠罵',
  '安靜一秒', '開罵！', '回放中', 'CONTRAST', 'Contrast', 'Fast Mouth', 'RAGE!', 'Sweep them all', 'Mash anything', 'HARDER!', '連擊', 'Combo',
  '自信', '呆住', '還在調', '手停住', '被迫營業', '氣勢沒了', 'SLAM!', '啪！兩個月', '他又砍了一次'];
// package B (UI chrome): reported, fatal only with --strict
export const KILL_B = ['後面', '分貝級', '評級', '距離 ★3', '距離★3', '狂拍！', '排隊', '氣勢', '火氣', '甩 ', '連拍 ', '按住 ', 'dB-ish'];

/** The in-page sampler (serialised into the page). */
function probe(KILL_C, KILL_B) {
  const SPOKEN = '.subs, .karaoke, .sign-slot, .sign, .plate-layer, .shop, .counter, .monitor-slot, .monitor, .rage-row, .group-row, .cust-wrap';
  const CHROME = '.hud, .overlay, .day-banner, .event-panel, .milestone, .tip-layer, .gchips, .skip, .recap, .day-card, .voice-prompt, .preview, .meter, .pad, .gate, .shutter-fx';
  const K = window.__kill = {
    samples: 0, hits: [], warn: [], hzMax: 0, hzBad: [], dirs: [], punchSeen: false, punchHitSeen: false,
    quickSeen: false, cupsSeen: 0, rageEdgeSeen: false, karaokeTags: 0, seen: new Set(),
  };
  const ALLOWED_HZ = /[一-龥]你媽|你嗶|your mom|250|二百五|251|520|黃金比例最好喝|golden ratio/i;
  const visible = (e) => {
    for (let x = e; x && x !== document.documentElement; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
      if (x.hidden) return false;
    }
    const r = e.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  };
  const cls = (e) => (typeof e.className === 'string' ? e.className : e.className?.baseVal || '');
  const note = (list, word, zone, text) => {
    const key = word + '|' + zone + '|' + text.slice(0, 30);
    if (K.seen.has(key)) return;
    K.seen.add(key);
    list.push({ word, zone, text: text.slice(0, 40), t: Math.round(performance.now()) });
  };
  K.sample = () => {
    const w = window.__250 || {};
    const g = w.game;
    const op = w.opening;
    const opening = !!(op && (typeof op.active === 'function' ? op.active() : op.active));
    const phase = g ? g.state.phase : 'none';
    if (!opening && phase !== 'playing' && phase !== 'rage') return;
    K.samples++;
    const stage = document.querySelector('.stage');
    const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const s = n.nodeValue.trim();
      const e = n.parentElement;
      if (!s || !e || !visible(e)) continue;
      if (e.closest(SPOKEN)) continue;
      const chrome = e.closest(CHROME);
      if (chrome) { for (const word of [...KILL_B, ...KILL_C]) if (s.includes(word)) note(K.warn, word, cls(chrome).split(' ')[0], s); continue; }
      for (const word of KILL_C) if (s.includes(word)) note(K.hits, word, cls(e).split(' ')[0] || e.tagName, s);
    }
    // 花字: one at a time, allowed words only, S3 never, S4 symbols only
    const hz = [...document.querySelectorAll('.hz.placed')].filter((x) => x.isConnected);
    K.hzMax = Math.max(K.hzMax, hz.length);
    for (const h of hz) {
      const st = h.dataset.style;
      const text = [...h.querySelectorAll('text')].map((t) => t.textContent).at(-1) || '';
      const ok = st === 'S5' || (st === 'S4' && /^[？！…?!.]+$/.test(text)) || ((st === 'S1' || st === 'S2') && ALLOWED_HZ.test(text));
      if (!ok) note(K.hzBad, text, st, text);
    }
    // subtitles: no stage directions
    const sub = document.querySelector('.subs');
    const st = sub ? sub.textContent : '';
    if (/[（(][^）)]*[）)]/.test(st)) note(K.dirs, st, 'subs', st);
    if (sub && sub.querySelector('.sub-punch')) K.punchSeen = true;
    if (sub && sub.querySelector('.sub-punch.hit')) K.punchHitSeen = true;
    // what replaces the words
    if (stage.classList.contains('quick')) K.quickSeen = true;
    const cups = document.querySelector('.cup-stack:not([hidden])');
    if (cups) K.cupsSeen = Math.max(K.cupsSeen, Number(cups.dataset.cups) || 0);
    // the rage edge vignette (package A's .tint-rage, or .fx-edge)
    const edge = [...document.querySelectorAll('.tint-rage, .fx-edge')].some((n) => +getComputedStyle(n).opacity > 0.3);
    if (stage.classList.contains('rage') && edge) K.rageEdgeSeen = true;
    K.karaokeTags = Math.max(K.karaokeTags, document.querySelectorAll('.karaoke .kk-tag').length);
  };
  setInterval(() => { try { K.sample(); } catch { /* page changing */ } }, 100);
}

export async function installKillProbe(page) {
  await page.evaluate(`(${probe.toString()})(${JSON.stringify(KILL_C)}, ${JSON.stringify(KILL_B)})`);
}

export async function readKillProbe(page) {
  return page.evaluate(() => {
    const K = window.__kill;
    if (!K) return null;
    const { seen, sample, ...rest } = K;
    return rest;
  });
}
