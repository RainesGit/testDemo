// hant.js — Simplified → Traditional (Taiwan) display conversion for 《来250杯！》.
// Generated offline with OpenCC (s2tw, Apache-2.0) over every Han character used in src/*.js and index.html,
// plus the few two-character phrases where a plain character map would pick the wrong form (柜台 → 櫃檯 ...).
// On top of the characters, TW_PHRASES swaps the few words a Taiwanese reader would not say (投诉 → 客訴,
// 硬币 → 銅板 ...) and TW_PUNCT uses 「」 quotes; reasoning and the full table: docs/localization-tw.md.
// Display only: content, voice clip keys and the engine stay Simplified; ui.setScript('hant') converts the DOM.
// zh-HK / zh-MO use the same table (entries marked "TW" in docs/localization-tw.md read Taiwanese there).
// After adding text with new characters, regenerate (pip install opencc-python-reimplemented; see game/README.md)
// or add the pair by hand; test/hant.test.mjs fails when a character in content has no mapping it needs.

const S = '万业丢两个临为举么乐书买乱于从们价众会伤体党关养内写冲净准凑几凶击划刚创别剧办务动势匀单卖历压厕双发变台号叹叽后吗听员咙哔哗啧啰嘘嚣图场坏块垫声处备够头奥妈宝对币师带帮干应废开弃张强当惊战托扩扫扰抢护报拨择挂换据摇摊数无时显机杠条来柜柠标样档梦楼欢气没浏浓涂温滚满点热犹现电画疗瘫盖着码礼离称笔简类紧红约纸线细终经结绕给绝统继续绿缓编网职胁脉脚脸节荐药营补装见观计订认让讯记讲论证评识诉词试话该语说请读谁调谢负败账质贪贴贵费赞赶转轮软载较边达过运还这进远连适选递采里钞钟钱铁铺锅错键镜长门闪闭问间闻队难静页顺顾预颗题风饮饼马驱骂骑鸦麦黄齐龙审与严则团归录总挥断级纪缝规议诈诚谜轻阶骗';
const T = '萬業丟兩個臨為舉麼樂書買亂於從們價眾會傷體黨關養內寫衝淨準湊幾兇擊劃剛創別劇辦務動勢勻單賣歷壓廁雙發變臺號嘆嘰後嗎聽員嚨嗶譁嘖囉噓囂圖場壞塊墊聲處備夠頭奧媽寶對幣師帶幫幹應廢開棄張強當驚戰託擴掃擾搶護報撥擇掛換據搖攤數無時顯機槓條來櫃檸標樣檔夢樓歡氣沒瀏濃塗溫滾滿點熱猶現電畫療癱蓋著碼禮離稱筆簡類緊紅約紙線細終經結繞給絕統繼續綠緩編網職脅脈腳臉節薦藥營補裝見觀計訂認讓訊記講論證評識訴詞試話該語說請讀誰調謝負敗賬質貪貼貴費贊趕轉輪軟載較邊達過運還這進遠連適選遞採裡鈔鐘錢鐵鋪鍋錯鍵鏡長門閃閉問間聞隊難靜頁順顧預顆題風飲餅馬驅罵騎鴉麥黃齊龍審與嚴則團歸錄總揮斷級紀縫規議詐誠謎輕階騙';
const CHAR = new Map([...S].map((c, i) => [c, [...T][i]]));
/** Character-form fixes: the character map alone would pick the wrong Traditional form here. */
export const PHRASES = {"干杯": "乾杯", "饼干": "餅乾", "看表": "看錶", "柜台": "櫃檯", "对折": "對摺", "折好": "摺好", "月历": "月曆", "在念": "在唸", "关系": "關係", "哗啦": "嘩啦", "一赞": "一讚", "老板": "老闆", "喝采": "喝采", "不准": "不准",
  // keys long enough not to fire inside other words (这个赞助, 这边念头 stay 贊 / 念)
  "三个赞": "三個讚", "电线杆": "電線桿", "边打边念": "邊打邊唸"};
/**
 * Taiwan wording (台灣用語), applied in the same pass as PHRASES (longest key first, so 倒喝采 beats 喝采).
 * Keys are Simplified text exactly as it appears in content / src; values are final Traditional text. No value
 * may contain a key or a character the map would change again (toHant must stay idempotent; tests check both).
 * Only words where the Simplified source reads mainland; most lines were written in Taiwanese Mandarin already.
 */
export const TW_PHRASES = {
  '投诉': '客訴',     // 要投诉 (#88): Taiwan says 客訴 at a shop counter
  '硬币': '銅板',     // 一堆硬币 / 硬币山 (#64); TW only (HK: 硬幣)
  '扩音器': '大聲公', // 抓扩音器 (#78)
  '铁门': '鐵捲門',   // the shop shutter in the closing lines (HK would say 鐵閘)
  '铁卷门': '鐵捲門', // the shutter lines of stage 2 (8.9): 捲 for the rolling shutter, not 卷
  '惊现': '驚見',     // news ticker headline wording
  '倒喝采': '喝倒彩', // boo line: the idiom is 喝倒彩
};
/** Whole-text replacements (a text node equal to the key, ignoring spaces): too short to match inside text. */
export const TW_WHOLE = {
  '接客': '接待',     // report stat "served": 接客 reads as the sex-work verb (and 迎接客人 must not change)
};
/** Taiwan / Hong Kong quotation marks. */
export const TW_PUNCT = { '“': '「', '”': '」' };
const ALL_PHRASES = { ...PHRASES, ...TW_PHRASES };
const PHRASE_RE = new RegExp(Object.keys(ALL_PHRASES).sort((a, b) => b.length - a.length).join('|'), 'g');

/** Simplified → Traditional (idempotent: no output character is also an input key). */
export function toHant(text) {
  const s = String(text ?? '');
  if (!/[\u3400-\u9fff]/.test(s)) return s; // Latin-only text (English mode) is left alone, quotes too
  const whole = TW_WHOLE[s.trim()];
  if (whole) return s.replace(s.trim(), whole);
  let out = '';
  let i = 0;
  const chars = (seg) => { for (const ch of seg) out += CHAR.get(ch) ?? TW_PUNCT[ch] ?? ch; };
  for (const m of s.matchAll(PHRASE_RE)) { chars(s.slice(i, m.index)); out += ALL_PHRASES[m[0]]; i = m.index + m[0].length; }
  chars(s.slice(i));
  return out;
}

export const HANT_CHARS = S;
/** Characters checked when the table was generated that stay the same in Traditional. */
export const HANT_SAME = '作操㐀一丁七三上下不世中主久之九也了事二五交亮人什今他付仙以仰件任伍休但位低住何你例便信修倍倒候借值偏做停偷催像僵元充先光免入全八公六共其具典再冰冷出分切到刷刻前力加勾北十千升午半卡印卷原去又叉及友反取口句另只叫可右司各合同名向吧吵吸吼呆告呢味呼命和咬咳品哈哥哪啊啥啦啪喂喉喊喔喘喝嗎嗨嗯嘛嘴嘿器四回因困在地均坐堆塞壁外多夜大天太失奇奶好始威婆媽嫌子字存它完定宜客室害家容密小少就尾山工左差己已巴市布常平年幹底店度座弄引往待很律得微心快念怎急怨您情想意感愣慢憋懂成我所手才打扣找抄把抓投抖折抬抱抽拆拉拍拖招拜括拿指按挑捂捷掉掌掏排接控推掰提插握撕播擾支收改放故效救敢散敬整文料新方日早明星是晚暗最月有朋服朗望本朵杆杯板果根格框案桶椰概機檬次欸款歉止正此步段每比民水求池治沿法洗活派海消涉淨深清源滑漂演潮火烊然照燕燥爆爽片版牌特狂狗狠猛王玩珍珠班甘甜生用甩留痛白百的目盯直盾省看真眨眯眶眼睛瞬矛砍研硬碗磨示社神票秒稍稿究空突立站章笑符第等算管箱精糖系紫置美翠翡翻老者耐耳耶聊背胸能脆腔腰自致舞般色花若苦茶草菜落葩藏虎蛋蛤行表袋被裁要覆角豫走起超越趴距跟路跳踩身辛迎近迫追退送通速那部都配酸重量金阱陷隔集零需非靠面音預食餅餐高麼黑齁龥鿿';
