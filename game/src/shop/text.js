// text.js — gameplay v3 shop UI strings: Traditional Chinese (Taiwan wording, docs/localization-tw.md) and English.
// Only cards, the receipt, the upgrade shop and the pause sheet carry words; the play screen shows icons
// (docs/art-direction-v2.md 9). Customer and clerk lines come from src/content.*.js (voiced), not from here.
//   shopText(lang) → strings; fmt('第 {n} 天', { n: 2 }) → '第 2 天'

export const TEXT = {
  zh: {
    title: '來250杯！',
    start: '點一下 開店',
    cont: '繼續（第 {n} 天）',
    fresh: '從第一天重來',
    day: '第 {n} 天',
    goal: '今天要賺',
    open: '開店',
    newToday: '今天新來的',
    receiptTitle: '打烊',
    rows: { sales: '營業額', tips: '小費', prepay: '預收（號碼牌）', served: '出杯', wrong: '做錯', walkouts: '等到跑掉', oke: '罵走奧客', fans: '罵來的新客人', fame: '名氣' },
    met: '達成', missed: '還差 {n}',
    toShop: '去升級',
    retry: '再開一次（第 {n} 天）',
    next: '開店（第 {n} 天）',
    shopTitle: '升級',
    wallet: '錢包',
    owned: '已買',
    upgrades: {
      slot3: ['第三個工作位', '一次做三杯'],
      fastSeal: ['快速封口機', '封口快一倍'],
      bigPot: ['大珍珠鍋', '珍珠加倍，煮得更快'],
      coconut: ['椰果', '新配料，賣得更貴'],
      neon: ['霓虹招牌', '名氣漲得更快'],
      ticket: ['號碼牌機', '收大單，預收加倍'],
      megaphone: ['大聲公', '罵一個，全部奧客一起滾'],
      seat4: ['第四個顧客位', '櫃台多站一個人'],
    },
    pause: { resume: '繼續', lang: '中文 / EN', mute: '消音', unmute: '開聲音', restart: '從第一天重來', close: '提早打烊' },
    complaints: ['這不是我點的啦！', '蛤？我點的不是這杯。', '你是不是聽錯了……', '算了，給你一半。'],
    ticket: ['No.250', '250杯', '兩個月後過來拿'],
    fanSign: '被罵好爽',
    voice: { ask: '這家店要你親口罵。', privacy: '聲音只在手機裡處理，不會上傳。', allow: '允許，開罵', no: '算了，用手勢' },
    end: '五天營業完成！店已經紅到排到街角。',
  },
  en: {
    title: '250 Cups!',
    start: 'Tap to open',
    cont: 'Continue (day {n})',
    fresh: 'Start over from day 1',
    day: 'Day {n}',
    goal: 'Earn today',
    open: 'Open',
    newToday: 'New today',
    receiptTitle: 'Closed',
    rows: { sales: 'Sales', tips: 'Tips', prepay: 'Prepaid (tickets)', served: 'Cups served', wrong: 'Wrong cups', walkouts: 'Walked out', oke: 'Pests cursed out', fans: 'New fans from cursing', fame: 'Fame' },
    met: 'Made it', missed: '{n} short',
    toShop: 'Upgrades',
    retry: 'Try again (day {n})',
    next: 'Open (day {n})',
    shopTitle: 'Upgrades',
    wallet: 'Wallet',
    owned: 'Owned',
    upgrades: {
      slot3: ['Third work spot', 'Make three cups at once'],
      fastSeal: ['Fast sealer', 'Seals twice as fast'],
      bigPot: ['Big pearl pot', 'Twice the pearls, cooks faster'],
      coconut: ['Coconut jelly', 'New topping, sells for more'],
      neon: ['Neon sign', 'Fame grows faster'],
      ticket: ['Ticket machine', 'Big orders prepay double'],
      megaphone: ['Megaphone', 'Curse one, every pest flies'],
      seat4: ['Fourth counter spot', 'One more customer at the counter'],
    },
    pause: { resume: 'Resume', lang: '中文 / EN', mute: 'Mute', unmute: 'Sound on', restart: 'Start over from day 1', close: 'Close early' },
    complaints: ["That's not what I ordered!", 'Huh? This is the wrong cup.', 'Did you even listen…', 'Fine. Half price.'],
    ticket: ['No.250', '250 cups', 'Pick up in two months'],
    fanSign: 'Curse me too!',
    voice: { ask: 'This shop wants you to do the yelling.', privacy: 'Your voice stays on this phone. Nothing is uploaded.', allow: 'Allow and yell', no: 'Never mind, use gestures' },
    end: 'Five days done! The line now reaches the corner.',
  },
};

export function shopText(lang = 'zh') {
  return TEXT[lang === 'en' ? 'en' : 'zh'];
}

export function fmt(s, vars = {}) {
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
