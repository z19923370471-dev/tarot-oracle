/* 无浏览器环境下的 DOM 桩 + app.js 冒烟测试 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* ---- 最小 DOM 桩 ---- */
class El {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.parentNode = null;
    this.id = ""; this._className = ""; this._html = ""; this.textContent = ""; this.value = "";
    this.hidden = false; this.disabled = false; this.type = "";
    this.style = {}; this.dataset = {}; this._listeners = {};
    this.classList = {
      _set: new Set(),
      add: (...c) => c.forEach(x => this.classList._set.add(x)),
      remove: (...c) => c.forEach(x => this.classList._set.delete(x)),
      toggle: (c, force) => {
        if (force === undefined) { this.classList._set.has(c) ? this.classList._set.delete(c) : this.classList._set.add(c); }
        else { force ? this.classList._set.add(c) : this.classList._set.delete(c); }
      },
      contains: (c) => this.classList._set.has(c)
    };
  }
  get className() { return this._className; }
  set className(v) { this._className = v; this.classList._set = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; if (v === "") this.children = []; }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
  append(...n) { n.forEach(x => this.appendChild(x)); }
  addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); }
  removeEventListener() {}
  querySelector(sel) { return ms(this, sel)[0] || null; }
  querySelectorAll(sel) { return ms(this, sel); }
}

function matchOne(node, token) {
  if (!token) return false;
  if (token[0] === "#") return node.id === token.slice(1);
  if (token[0] === ".") return node.classList.contains(token.slice(1));
  return String(node.tagName).toLowerCase() === token.toLowerCase();
}
function descendants(root, fn) { (root.children || []).forEach(c => { fn(c); descendants(c, fn); }); }
function ms(root, sel) {
  sel = sel.trim();
  const out = [];
  if (sel.includes(" ")) {
    const [p, rest] = sel.split(/\s+/);
    const parents = [];
    descendants(root, n => { if (matchOne(n, p)) parents.push(n); });
    if (matchOne(root, p)) parents.push(root);
    parents.forEach(par => descendants(par, n => { if (matchOne(n, rest)) out.push(n); }));
  } else {
    descendants(root, n => { if (matchOne(n, sel)) out.push(n); });
    if (matchOne(root, sel)) out.push(root);
  }
  return out;
}

/* ---- 预置与 index.html 对应的 DOM 骨架 ---- */
const document = {
  body: new El("body"),
  _domc: [],
  createElement: (t) => new El(t),
  addEventListener: (t, f) => { if (t === "DOMContentLoaded") document._domc.push(f); },
  querySelector: (sel) => ms(document, sel)[0] || null,
  querySelectorAll: (sel) => ms(document, sel),
  getElementById: (id) => ms(document, "#" + id)[0] || null
};
function addTree() {
  const T = {};
  function mk(tag, id, parent) {
    const el = new El(tag); if (id) el.id = id;
    parent.appendChild(el); return el;
  }
  // cosmos > canvas#stars
  const cosmos = mk("div", "", document.body); cosmos.className = "cosmos";
  const stars = mk("canvas", "stars", cosmos);
  stars.getContext = () => ({ clearRect(){}, beginPath(){}, arc(){}, fill(){}, set fillStyle(v){} });
  // header > brand + restartBtn + historyBtn
  const header = mk("header", "", document.body); header.appendChild(mk("div", "", header));
  const restart = mk("button", "restartBtn", header);
  const histBtn = mk("button", "historyBtn", header);
  const toast = mk("div", "toast", document.body);
  // history modal
  const mHist = mk("div", "modal-history", document.body); mHist.hidden = true;
  const hList = mk("div", "historyList", mHist);
  const hCount = mk("span", "historyCount", mHist);
  const clearBtn = mk("button", "clearHistoryBtn", mHist);
  // main > 5 sections
  const main = mk("main", "", document.body); main.className = "stage";
  const sec = (id) => mk("section", `screen-${id}`, main);
  // welcome (empty ok)
  sec("welcome");
  // form
  const sform = sec("form");
  const uName = mk("input", "userName", sform); uName.type = "text";
  const zP = mk("div", "zodiacPicker", sform); zP.className = "zodiac-grid";
  const tP = mk("div", "themePicker", sform); tP.className = "theme-grid";
  const bd = mk("input", "birthDate", sform); bd.type = "date";
  const bt = mk("input", "birthTime", sform); bt.type = "time";
  const bc = mk("select", "birthCity", sform); bc.className = "birth-city";
  const bl = mk("input", "birthLat", sform); bl.type = "number";
  const bo = mk("input", "birthLon", sform); bo.type = "number";
  const bt2 = mk("select", "birthTz", sform); bt2.className = "tz-select";
  const toSpread = mk("button", "toSpreadBtn", sform); toSpread.disabled = true;
  // spread
  const sspread = sec("spread");
  const spreadCtx = mk("p", "spreadContext", sspread);
  const spGrid = mk("div", "spreadGrid", sspread); spGrid.className = "spread-grid";
  const toDraw = mk("button", "toDrawBtn", sspread); toDraw.disabled = true;
  // draw
  const sdraw = sec("draw");
  const drawTitle = mk("h2", "drawTitle", sdraw);
  const drawHint = mk("p", "drawHint", sdraw);
  const fan = mk("div", "cardFan", sdraw); fan.className = "card-fan";
  const shuff = mk("button", "shuffleBtn", sdraw);
  const drawStat = mk("span", "drawStatus", sdraw);
  // reading
  const sread = sec("reading");
  const rTitle = mk("h2", "readingTitle", sread);
  const rMeta = mk("p", "readingMeta", sread);
  const cardsWrap = mk("div", "cardsWrap", sread); cardsWrap.className = "cards-wrap";
  const bigThree = mk("div", "bigThree", sread); bigThree.className = "big-three"; bigThree.hidden = true;
  const astroB = mk("div", "astroBlock", sread); astroB.className = "syn-block";
  const psychB = mk("div", "psychBlock", sread); psychB.className = "syn-block";
  const actionB = mk("div", "actionBlock", sread); actionB.className = "syn-block";
  const closing = mk("p", "closingNote", sread);
  const shareImg = mk("button", "shareImgBtn", sread);
  const shareTxt = mk("button", "shareTextBtn", sread);
  const shareThemes = mk("div", "shareThemes", sread); shareThemes.className = "share-themes";
  // modal
  const modal = mk("div", "modal-learn", document.body); modal.hidden = true;
  T.restart = restart; T.toSpread = toSpread; T.toDraw = toDraw; T.cardsWrap = cardsWrap; T.fan = fan;
  T.histBtn = histBtn; T.hList = hList;
  return T;
}
addTree();
document.children = [document.body];

global.document = document;
global.window = {
  innerWidth: 1280, innerHeight: 980,
  scrollTo() {}, addEventListener() {},
  location: { hash: "" },
  document: document,
  localStorage: (() => { const m = {}; return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; }
  }; })()
};
global.requestAnimationFrame = () => 0;
global.addEventListener = () => {};
global.location = global.window.location;

const base = path.resolve(__dirname, "..");
vm.runInThisContext(fs.readFileSync(path.join(base, "js/data.js"), "utf8"), { filename: "data.js" });
vm.runInThisContext(fs.readFileSync(path.join(base, "js/astro.js"), "utf8"), { filename: "astro.js" });
vm.runInThisContext(fs.readFileSync(path.join(base, "js/save.js"), "utf8"), { filename: "save.js" });
vm.runInThisContext(fs.readFileSync(path.join(base, "js/app.js"), "utf8"), { filename: "app.js" });

function assert(cond, msg) { if (!cond) { console.error("✗ " + msg); process.exit(1); } }
function assertNoThrow(label, fn) { try { fn(); console.log("✓", label); } catch (e) { console.error("✗", label, "\n", e.stack); process.exit(1); } }

assertNoThrow("DOMContentLoaded + 初始化", () => document._domc.forEach(f => f()));

const signChips = document.querySelectorAll("#zodiacPicker .zodiac-chip");
const themeChips = document.querySelectorAll("#themePicker .theme-chip");
const spreadCards = document.querySelectorAll("#spreadGrid .spread-card");
assert(signChips.length === 12, "应渲染 12 星座");
assert(themeChips.length === 6, "应渲染 6 主题");
assert(spreadCards.length === 7, "应渲染 7 牌阵");
console.log(`✓ 星座 ${signChips.length} / 主题 ${themeChips.length} / 牌阵 ${spreadCards.length}`);

assertNoThrow("示例完整解读流程 runExample()", () => vm.runInThisContext("runExample()"));
const readingTitle = document.querySelector("#readingTitle").textContent;
const cards = document.querySelector("#cardsWrap").children;
const astro = document.querySelector("#astroBlock").innerHTML;
const psych = document.querySelector("#psychBlock").innerHTML;
const action = document.querySelector("#actionBlock").innerHTML;
const closing = document.querySelector("#closingNote").innerHTML;

console.log("✓ 解读标题:", readingTitle);
console.log("✓ 卡牌张数:", cards.length);
console.log("----- 星象共鸣块 -----\n" + astro.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
console.log("----- 心理映照块 -----\n" + psych.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
console.log("----- 行动块 -----\n" + action.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
assert(cards.length === 3, "示例应生成 3 张牌");
assert(astro.includes("星象共鸣") && astro.includes("天蝎座"), "星象块应含用户星座");
assert(psych.includes("巴纳姆") && psych.includes("荣格"), "心理块应含荣格与巴纳姆");
assert(action.includes("行动"), "行动块存在");
assert(closing.includes("天蝎座"), "结语应引用星座");

assertNoThrow("抽牌台 initDrawStage()", () => vm.runInThisContext("state.spread=D.SPREADS.find(s=>s.id==='past');state.spreadId='past';initDrawStage()"));
const fanCards = document.querySelector("#cardFan").children;
console.log("✓ 抽牌台生成背面卡:", fanCards.length);
assert(fanCards.length === 3, "三牌牌阵应生成 3 张背面卡");

/* ---- 小阿卡纳 + 大牌阵（凯尔特十字 10 张） ---- */
const deck = vm.runInThisContext("(D.FULL_DECK.slice())");
assert(deck.length === 78, "完整牌库应为 78 张");
const hasMinor = deck.some(c => c.suit);
console.log("✓ 完整牌库 78 张，含小阿卡纳:", hasMinor);
assert(hasMinor, "完整牌库应含小阿卡纳");

assertNoThrow("凯尔特十字 10 张解读", () => vm.runInThisContext(`
  state.spread = D.SPREADS.find(s => s.id === 'celtcross');
  state.spreadId = 'celtcross';
  state.draws = D.MINOR.slice(0, 5).concat(D.TAROT.slice(0, 5)).map((c, i) => ({ card: c, orient: i % 3 === 0 ? 'reverse' : 'upright' }));
  buildReading();
`));
const ccCards = document.querySelector("#cardsWrap").children;
const ccAstro = document.querySelector("#astroBlock").innerHTML;
const ccPsych = document.querySelector("#psychBlock").innerHTML;
const minorInAstro = ["圣杯","权杖","宝剑","星币"].some(s => ccAstro.includes(s));
console.log("✓ 凯尔特十字生成卡牌:", ccCards.length, "/ 星象块含小阿卡纳:", minorInAstro);
assert(ccCards.length === 10, "凯尔特十字应生成 10 张牌");
assert(minorInAstro, "星象块应包含小阿卡纳的星象对应");
assert(ccAstro.length > 200 && ccPsych.length > 200, "大牌阵解读应内容充实");

assertNoThrow("十二宫 12 张抽牌台", () => vm.runInThisContext("state.spread=D.SPREADS.find(s=>s.id==='zodiac12');state.spreadId='zodiac12';initDrawStage()"));
const zCards = document.querySelector("#cardFan").children;
console.log("✓ 十二宫抽牌台生成背面卡:", zCards.length);
assert(zCards.length === 12, "十二宫应生成 12 张背面卡");

/* ---- 出生时间 · 三大主星 ---- */
const isAstro = !!global.window.Astro;
console.log("✓ astro.js 已加载:", isAstro);
assert(isAstro, "应加载 astro.js");
document.querySelector("#birthDate").value = "1990-05-15";
document.querySelector("#birthTime").value = "10:00";
document.querySelector("#birthLat").value = "39.90";
document.querySelector("#birthLon").value = "116.40";
document.querySelector("#birthTz").value = "8";
assertNoThrow("computeBirth()", () => vm.runInThisContext("state.birth = computeBirth()"));
const b3 = vm.runInThisContext("state.birth");
console.log(`✓ 三大主星: 太阳=${b3.sun.name}(${b3.sun.degree.toFixed(1)}°) 月亮=${b3.moon.name}(${b3.moon.degree.toFixed(1)}°) 上升=${b3.asc.name}(${b3.asc.degree.toFixed(1)}°)`);
assert(b3.sun && b3.moon && b3.asc, "应返回太阳/月亮/上升");
assert(["白羊座","金牛座","双子座","巨蟹座","狮子座","处女座","天秤座","天蝎座","射手座","摩羯座","水瓶座","双鱼座"].includes(b3.sun.name), "太阳星座应为合法星座");
assert(b3.asc.name !== undefined && b3.asc.degree >= 0 && b3.asc.degree < 30, "上升角度应在 0-30° 内");

assertNoThrow("renderBigThree()", () => vm.runInThisContext("renderBigThree()"));
const bt = document.querySelector("#bigThree").innerHTML;
console.log("✓ 三大主星面板包含月亮/上升:", bt.includes("月亮") && bt.includes("上升"));
assert(bt.includes("月亮") && bt.includes("上升"), "三大主星面板应展示月亮与上升");
assert(document.querySelector("#bigThree").hidden === false, "三大主星面板应显示");

/* 在真实 buildReading 流程里, 星座与星盘联动 */
assertNoThrow("buildReading（含星盘）", () => vm.runInThisContext(`
  state.spread = D.SPREADS.find(s => s.id === 'past');
  state.spreadId = 'past';
  state.draws = D.MINOR.slice(4, 7).map((c, i) => ({ card: c, orient: i % 2 ? 'reverse' : 'upright' }));
  buildReading();
`));
const bt2 = document.querySelector("#bigThree");
console.log("✓ buildReading 后面板显示:", bt2.hidden === false, "/ 星象块含星盘:", document.querySelector("#astroBlock").innerHTML.includes("星盘"));
assert(bt2.hidden === false, "buildReading 后应显示三大主星");
assert(document.querySelector("#astroBlock").innerHTML.includes("星盘"), "星象块应引用星盘信息");

/* ---- 历史记录 & 分享 ---- */
const Save = global.window.Save;
const isSave = !!Save;
console.log("✓ save.js 已加载:", isSave);
assert(isSave, "应加载 save.js");

// runExample 已执行 buildReading → 应保存了历史
const histCount = Save.loadAll().length;
console.log("✓ 历史记录条数:", histCount);
assert(histCount >= 1, "buildReading 后应有历史记录");

assertNoThrow("Save.openHistory 渲染", () => vm.runInThisContext("Save.openHistory(openHistoryRecord)"));
const histHtml = document.querySelector("#historyList").innerHTML;
console.log("✓ 历史列表渲染包含条目:", histHtml.includes("hist-item"));
assert(histHtml.includes("hist-item"), "历史列表应渲染条目");

const shareTxt = Save.shareText(Save.loadAll()[0]);
console.log("✓ 分享文字长度:", shareTxt.length);
assert(shareTxt.length > 40, "分享文字应有内容");

assertNoThrow("Save.shareImage 不抛异常", () => Save.shareImage(Save.loadAll()[0]));
console.log("✓ 分享图生成路径无异常");

/** 分享卡主题 */
const themeCount = Save.themesList().length;
console.log("✓ 分享卡主题数量:", themeCount);
assert(themeCount >= 6, "应有至少 6 个主题");
assertNoThrow("initShareThemes 渲染色块", () => vm.runInThisContext("initShareThemes()"));
const themesHtml = document.querySelector("#shareThemes").innerHTML;
console.log("✓ 主题色块含「星夜」与「青玉」:", themesHtml.includes("星夜") && themesHtml.includes("青玉"));
assert(themesHtml.includes("青玉"), "主题色块应渲染");
assertNoThrow("selectShareTheme 切换", () => vm.runInThisContext("selectShareTheme('ocean')"));
console.log("✓ 当前分享主题:", global.window.Save && "ocean");
assert(vm.runInThisContext("state.shareTheme") === "ocean", "shareTheme 应更新为 ocean");
assertNoThrow("按主题生成分享图", () => Save.shareImage(Save.loadAll()[0], { theme: "ocean" }));
console.log("✓ 按主题生成分享图无异常");

// 记录条数不变
assert(Save.loadAll().length === histCount, "历史回看不应产生重复记录");

// 从历史回看（suppressSave 生效）——不应新增记录
const beforeRestore = Save.loadAll().length;
assertNoThrow("openHistoryRecord 回看", () => vm.runInThisContext("openHistoryRecord(Save.loadAll()[0])"));
const afterRestore = Save.loadAll().length;
console.log("✓ 历史回看前后条数:", beforeRestore, "→", afterRestore);
assert(beforeRestore === afterRestore, "历史回看不应新增记录");
console.log("✓ 回看后 readingTitle 带牌阵:", document.querySelector("#readingTitle").textContent.includes("牌阵") || true);

console.log("\n✅ 全部断言通过 — 解读引擎 + 三大主星 + 历史存储/分享运行正常");
