/* =========================================================================
 * 星曜塔罗 · app.js
 * 交互与解读引擎
 * ========================================================================= */

"use strict";

const D = window.TarotData;
const Astro = window.Astro;   // 星盘计算（js/astro.js）
const Save = window.Save;     // 历史存储/分享（js/save.js）
const $  = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
let suppressSave = false;      // 从历史回看时避免重复保存

/* ---- 全局状态 ---- */
const state = {
  name: "",
  signId: null,
  sign: null,      // 星座对象
  themeId: "general",
  spreadId: null,
  spread: null,
  draws: [],
  birth: null,     // 三大主星（太阳/月亮/上升）计算结果，未填则为 null
  shareTheme: "starlight"   // 分享卡主题
};

/* ============================ 屏幕导航 ============================ */
const SCREENS = ["welcome", "form", "spread", "draw", "reading"];
const restartBtn = $("#restartBtn");

function showScreen(id) {
  SCREENS.forEach(s => {
    const node = $(`#screen-${s}`);
    const active = s === id;
    node.classList.toggle("active", active);
    node.hidden = !active;
  });
  document.body.dataset.screen = id;
  window.scrollTo({ top: 0, behavior: "smooth" });

  // 顶部“重新开始”只在进入流程后出现
  restartBtn.hidden = (id === "welcome");

  // 进入抽牌台时渲染
  if (id === "draw") initDrawStage();
}

// 全局按钮绑定（data-goto）
$$("[data-goto]").forEach(btn => {
  btn.addEventListener("click", e => {
    e.preventDefault();
    const to = btn.dataset.goto;
    goBackGuard(to);
    showScreen(to);
  });
});

// 返回时重置相应下游状态
function goBackGuard(to) {
  if (to === "welcome") {
    restartBtn.hidden = true;
  }
  if (to === "form" && state.spreadId) {
    // 返回改信息，清除已选牌阵
    state.spreadId = null; state.spread = null;
    $("#toSpreadBtn").disabled = true; $("#toDrawBtn").disabled = true;
  }
  if (to === "spread" ) { $("#toDrawBtn").disabled = true; }
}

restartBtn.addEventListener("click", () => {
  showScreen("welcome");
});

$$("[data-open-modal]").forEach(b => b.addEventListener("click", () => {
  $("#modal-learn").hidden = false;
}));
$$("[data-close-modal]").forEach(b => b.addEventListener("click", () => {
  $("#modal-learn").hidden = true;
}));
$("#modal-learn").addEventListener("click", e => {
  if (e.target.id === "modal-learn") $("#modal-learn").hidden = true;
});

/* ============================ 角色 / 装扮 ============================ */

function initZodiacPicker() {
  const wrap = $("#zodiacPicker");
  wrap.innerHTML = "";
  D.ZODIAC.forEach(z => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "zodiac-chip";
    chip.dataset.sign = z.id;
    chip.innerHTML = `<span class="sym">${z.symbol}</span><span class="nm">${z.sign}</span>`;
    chip.addEventListener("click", () => selectZodiac(z.id));
    wrap.appendChild(chip);
  });
  // 自动预选：根据当前日期推断星座（可选体验）
  const auto = zodiacFromDate(new Date());
  if (auto) selectZodiac(auto.id, true);
}

function zodiacFromDate(date) {
  const m = date.getMonth() + 1;      // 1-12
  const d = date.getDate();
  const ranges = [
    ["aries", 3, 21, 4, 19], ["taurus", 4, 20, 5, 20],
    ["gemini", 5, 21, 6, 21], ["cancer", 6, 22, 7, 22],
    ["leo", 7, 23, 8, 22], ["virgo", 8, 23, 9, 22],
    ["libra", 9, 23, 10, 23], ["scorpio", 10, 24, 11, 22],
    ["sagittarius", 11, 23, 12, 21], ["capricorn", 12, 22, 1, 19],
    ["aquarius", 1, 20, 2, 18], ["pisces", 2, 19, 3, 20]
  ];
  // capricorn 跨年，特殊处理
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return D.ZODIAC.find(z => z.id === "capricorn");
  const r = ranges.find(rr => {
    const [id, sm, sd, em, ed] = rr;
    const start = sm * 100 + sd, end = em * 100 + ed, cur = m * 100 + d;
    return cur >= start && cur <= end;
  });
  return D.ZODIAC.find(z => z.id === (r && r[0])) || null;
}

function selectZodiac(id, silent) {
  state.signId = id;
  state.sign = D.ZODIAC.find(z => z.id === id);
  $$("#zodiacPicker .zodiac-chip").forEach(c => c.classList.toggle("selected", c.dataset.sign === id));
  updateFormReady();
  if (!silent) refreshContextLine();
}

function initThemePicker() {
  const wrap = $("#themePicker");
  wrap.innerHTML = "";
  D.THEMES.forEach(t => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "theme-chip";
    chip.dataset.theme = t.id;
    chip.innerHTML = `
      <div class="t-head"><span class="t-icon">${t.icon}</span><span>${t.name}</span></div>
      <div class="t-desc">${t.desc}</div>`;
    chip.addEventListener("click", () => selectTheme(t.id));
    wrap.appendChild(chip);
  });
  selectTheme("general", true);
}

function selectTheme(id, silent) {
  state.themeId = id;
  $$("#themePicker .theme-chip").forEach(c => c.classList.toggle("selected", c.dataset.theme === id));
  if (!silent) refreshContextLine();
}

function updateFormReady() {
  $("#toSpreadBtn").disabled = !state.sign;
}

$("#userName").addEventListener("input", e => {
  state.name = e.target.value.trim();
});

/* ============================ 出生时间（三大主星） ============================ */
function initBirthForm() {
  if (!Astro) return;
  const citySel = $("#birthCity");
  const tzSel = $("#birthTz");

  // 出生地下拉（中国省级行政区）
  citySel.innerHTML = `<option value="">选择出生省份（自动填坐标/时区）</option>` +
    D.CITIES.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  // 时区下拉
  const ops = [];
  for (let i = -12; i <= 14; i++) {
    if (i === -12 || i === 0 || i === 8 || i === 9 || i === 10 || i === 1 || i === -5 || i === -8 || i === 5 || i === 3 || i === 7 || i === -4 || i === -7 || i === 12 || i === 11 || i === 6 || i === 4 || i === 2 || i === -1 || i === -2 || i === -3 || i === -6 || i === -9 || i === -10 || i === -11 || i === 13 || i === 14) {
      ops.push(`<option value="${i}">UTC${i >= 0 ? "+" : ""}${i}</option>`);
    }
  }
  tzSel.innerHTML = ops.join("");
  tzSel.value = "8";

  // 选城市 → 自动填经纬度/时区
  citySel.addEventListener("change", () => {
    const c = D.CITIES.find(x => x.id === citySel.value);
    if (c) {
      $("#birthLat").value = c.lat;
      $("#birthLon").value = c.lon;
      tzSel.value = String(c.tz);
    }
  });

  // 出生日期 → 自动同步太阳星座（更精准）
  $("#birthDate").addEventListener("change", () => {
    const d = parseBirthDate();
    if (d) {
      const sun = Astro.signInfo(Astro.sunLongitude(Astro.julianDay(d.year, d.month, d.day, 12)));
      // 同步到星座选择器（若用户未手动改过星座）
      selectZodiac(sun.key, true);
      $("#birthTime").dataset.sun = sun.name;
    }
  });

  $("#birthTime").addEventListener("change", refreshContextLine);
  $("#birthLat").addEventListener("input", refreshContextLine);
  $("#birthLon").addEventListener("input", refreshContextLine);
}

/* 读取出生日期控件 */
function parseBirthDate() {
  const v = $("#birthDate").value;
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/* 计算三大主星（太阳/月亮/上升）；信息不全则返回 null */
function computeBirth() {
  if (!Astro) return null;
  const date = parseBirthDate();
  const time = $("#birthTime").value;
  const lat = parseFloat($("#birthLat").value);
  const lon = parseFloat($("#birthLon").value);
  const tz = parseInt($("#birthTz").value, 10);
  if (!date || !time || isNaN(lat) || isNaN(lon) || isNaN(tz)) return null;
  const [hh, mm] = time.split(":").map(Number);
  const r = Astro.bigThree({ year: date.year, month: date.month, day: date.day, hour: hh, minute: mm, tzOffset: tz, lat, lon });
  return r;
}

/* ============================ 牌阵 ============================ */
function initSpreadGrid() {
  const wrap = $("#spreadGrid");
  wrap.innerHTML = "";
  D.SPREADS.forEach(sp => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "spread-card";
    card.dataset.spread = sp.id;
    card.innerHTML = `
      <span class="s-icon">${sp.icon}</span>
      <span class="s-name">${sp.name}</span>
      <span class="s-count">${sp.count} 张 · ${sp.positions.join(" / ")}</span>
      <p class="s-desc">${sp.desc}</p>`;
    card.addEventListener("click", () => selectSpread(sp.id));
    wrap.appendChild(card);
  });
}

function selectSpread(id) {
  state.spreadId = id;
  state.spread = D.SPREADS.find(sp => sp.id === id);
  $$("#spreadGrid .spread-card").forEach(c => c.classList.toggle("selected", c.dataset.spread === id));
  $("#toDrawBtn").disabled = false;
}

$("#toSpreadBtn").addEventListener("click", () => showScreen("spread"));
$("#toDrawBtn").addEventListener("click", () => {
  refreshContextLine();
  showScreen("draw");
});

function refreshContextLine() {
  const theme = D.THEMES.find(t => t.id === state.themeId);
  const parts = [];
  if (state.name) parts.push(`你好，<b>${escapeHtml(state.name)}</b>`);
  if (state.sign) parts.push(`<b>${state.sign.sign}</b>（${state.sign.elementName || elementName(state.sign.element)}象）`);
  if (theme) parts.push(`主题：<b>${theme.name}</b>`);
  const lineParts = parts.join(" · ");
  $("#spreadContext").innerHTML = lineParts ? lineParts : "填写你的星座与主题，即可更精准地结合星象解读。";
  // 若在 draw 页也要显示
  const d = $("#drawHint");
  if (d) d.innerHTML = state.spread ? `已选「${state.spread.name}」· 将抽取 ${state.spread.count} 张` : "";
}

function elementName(key) {
  return D.ELEMENTS[key] ? D.ELEMENTS[key].name : key;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ============================ 抽牌台 ============================ */

let fanCards = [];   // 当前牌堆背面卡
let drawCount = 0;

function shuffleDeck() {
  const deck = (D.FULL_DECK || D.TAROT).slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function initDrawStage() {
  const title = $("#drawTitle");
  const hint = $("#drawHint");
  const status = $("#drawStatus");
  const fan = $("#cardFan");
  const n = state.spread.count;

  state.draws = [];
  drawCount = 0;
  title.textContent = `${state.spread.name} · 静心翻开 ${n} 张`;
  const posPreview = state.spread.positions.slice(0, n).join(" → ");
  hint.innerHTML = `主题：<b>${D.THEMES.find(t => t.id === state.themeId).name}</b> · 牌位：${posPreview}（点击任意牌面翻开）`;
  status.textContent = `已翻开 0 / ${n}`;

  // 从完整牌库抽 n 张不重复的牌
  const deck = shuffleDeck();
  const picked = deck.slice(0, n);
  fan.innerHTML = "";
  fan.classList.toggle("fan", n <= 5);
  fan.classList.toggle("grid", n > 5);

  picked.forEach((card, idx) => {
    const position = state.spread.positions[idx] || `位置 ${idx + 1}`;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "tarot-card";
    el.dataset.pos = idx;
    el.innerHTML = `
      <div class="card-inner">
        <div class="face back"><div class="back-border"></div>${n > 1 ? `<div class="back-pos">${position}</div>` : ""}</div>
        <div class="face front">
          <div class="mini-glyph">
            <span class="g-num">${card.num === 0 ? "〇" : (card.rank ? card.rank : card.num)}</span>
            <span class="g-sym">${card.symbol}</span>
            <span class="g-name">${card.name}</span>
            <span class="g-key">${card.keywords.slice(0, 2).join(" · ")}</span>
          </div>
        </div>
      </div>`;
    el.addEventListener("click", () => pickCard(el, card));
    fan.appendChild(el);
  });
}

function pickCard(el, card) {
  if (el.dataset.taken === "1") return; // 已翻开的牌不可重复点
  el.classList.add("flipped");
  el.style.cursor = "default";
  el.dataset.taken = "1";
  el.style.pointerEvents = "none";
  const orient = Math.random() < 0.42 ? "reverse" : "upright";
  state.draws.push({ card, orient });
  drawCount++;
  const status = $("#drawStatus");
  status.textContent = `已翻开 ${drawCount} / ${state.spread.count}`;
  status.classList.add("plus");
  setTimeout(() => status.classList.remove("plus"), 400);

  if (state.draws.length >= state.spread.count) {
    setTimeout(buildReading, 1150);
  }
}

$("#shuffleBtn").addEventListener("click", () => {
  if ($("#cardFan .tarot-card[data-taken='1']").length > 0) return; // 已选牌不重洗
  initDrawStage();
});

/* ============================ 解读引擎 ============================ */

function buildReading() {
  const spread = state.spread;
  const theme = D.THEMES.find(t => t.id === state.themeId);

  $("#readingTitle").textContent = `「${spread.name}」的启悟`;
  const metaParts = [];
  if (state.name) metaParts.push(escapeHtml(state.name));
  if (state.sign) metaParts.push(`${state.sign.sign} · ${theme.name}`);
  $("#readingMeta").innerHTML = metaParts.length ? metaParts.join("  ·  ") : "";

  // 计算三大主星（有出生时间才生效）；历史回看时保留已还原的星盘
  if (!state._restoring) state.birth = computeBirth();

  // 卡片展示
  const wrap = $("#cardsWrap");
  wrap.innerHTML = "";
  state.draws.forEach((d, i) => {
    wrap.appendChild(buildReadCard(d, spread.positions[i], i, spread.count));
  });

  // 三大主星面板
  renderBigThree();

  // 综合解读
  renderAstroBlock();
  renderPsychBlock();
  renderActionBlock();

  $("#closingNote").innerHTML = closingText();

  // 记录 & 保存（从历史回看时抑制）
  state.lastRecord = makeRecord();
  if (Save && !suppressSave) Save.add(state.lastRecord);

  restartBtn.hidden = false;
  showScreen("reading");
}

/* ---- 三大主星面板 ---- */
function renderBigThree() {
  const el = $("#bigThree");
  if (!state.birth || !Astro) { el.hidden = true; el.innerHTML = ""; return; }
  const b = state.birth;
  const info = [
    { label: "太阳", icon: "☀", d: b.sun, note: "核心意志 · 自我表达", desc: true },
    { label: "月亮", icon: "☽", d: b.moon, note: "内在情感 · 安全感", desc: true },
    { label: "上升", icon: "☉", d: b.asc, note: "外在面具 · 第一印象", desc: true }
  ];
  el.innerHTML = `
    <h3 class="bt-title"><span class="ic">☉</span>你的三大主星</h3>
    <div class="bt-grid">
      ${info.map(x => `
        <div class="bt-card">
          <div class="bt-label">${x.icon} ${x.label}</div>
          <div class="bt-sign">${x.d.name}</div>
          <div class="bt-deg">${x.d.degree.toFixed(1)}°</div>
          <div class="bt-note">${x.note}</div>
        </div>`).join("")}
    </div>
    ${elementBalanceLine(b)}
    <p class="legal small">按标准天文公式近似推算太阳/月亮/上升星座；若出生时间临近星座交界，可能有偏差，请以专业星历为准。</p>
  `;
  el.hidden = false;
}

function elementBalanceLine(b) {
  const c = Astro.elementBalance(b);
  const order = ["FIRE", "EARTH", "AIR", "WATER"];
  const total = order.reduce((s, k) => s + c[k], 0);
  const bars = order.map(k => {
    const n = c[k];
    const pct = total ? Math.round(n / total * 100) : 0;
    return `<div class="elbar">
      <span class="elbar-name">${D.ELEMENTS[k].name}</span>
      <span class="elbar-track"><span class="elbar-fill" style="width:${pct}%"></span></span>
      <span class="elbar-val">${n}/${total}</span></div>`;
  }).join("");
  return `<div class="bt-elems"><div class="bt-elems-title">元素分布 · 三大主星</div>${bars}</div>`;
}

function buildReadCard(d, position, idx, count) {
  const card = d.card;
  const up = d.orient === "upright";
  const el = document.createElement("div");
  el.className = "read-card";
  el.style.animation = `fadeUp 0.5s ${idx * 0.12}s cubic-bezier(0.22,1,0.36,1) both`;
  el.innerHTML = `
    <div class="rc-top">${position || `第 ${idx + 1} 张`}</div>
    <div class="rc-sym">${card.symbol}</div>
    <div class="rc-name">${card.name}</div>
    <div class="rc-en">${card.en}</div>
    <div class="rc-astro">星象 · ${card.astro}</div>
    <div class="rc-orient ${up ? "up" : "rev"}">${up ? "正位" : "逆位"}</div>
    <div class="rc-word">${card.keywords.map(k => `<span>${k}</span>`).join("")}</div>
    <div class="rc-mean"><b>${up ? "正位" : "逆位"}解读：</b>${up ? card.upright : card.reversed}</div>
  `;
  return el;
}

function astroRelation(cardElKey, userElKey) {
  if (cardElKey === userElKey) return "same";
  const aff = D.ELEMENT_AFFINITY[userElKey];
  if (aff.HARMONIOUS.includes(cardElKey)) return "harmonious";
  if (aff.CHALLENGING.includes(cardElKey)) return "challenging";
  return "neutral";
}

function elementRelationText(elRel) {
  switch (elRel) {
    case "same":      return "与你的元素同频，能量自然相合、彼此增强，你更容易顺应这张牌的方向。";
    case "harmonious":return "与你的元素相生相成，是一个顺风的配置，你可以更从容地借助这股能量推进。";
    case "challenging":return "与你的元素存在张力，需要多加磨合。这不是坏事——正是需要你主动调适、整合的地方。";
    default:          return "与你元素中性的呼应。它既不特别助你，也不阻碍，关键仍在你如何运用。";
  }
}

function renderAstroBlock() {
  const block = $("#astroBlock");
  const userElNamed = elementName(state.sign.element);

  let html = `
    <h3><span class="ic">☾</span>星象共鸣</h3>
  `;
  if (state.birth) {
    html += `<p class="legal small"><b>你的星盘：</b>太阳<b>${state.birth.sun.name}</b> · 月亮<b>${state.birth.moon.name}</b> · 上升<b>${state.birth.asc.name}</b>。以下以太阳<b>${state.sign.sign}</b>为基底，并以<b>${state.birth.asc.name}</b>（上升）作为你展现给世界的一面来照应。</p>`;
  }
  html += `<p>你的<b>${state.sign.sign}</b>（<b>${userElNamed}</b>象，守护星 ${state.sign.ruler}）此刻与所抽之牌能量交汇。</p>`;

  state.draws.forEach((d, i) => {
    const posName = state.spread.positions[i] || `位置 ${i + 1}`;
    const cardElKey = d.card.element;
    const rel = astroRelation(cardElKey, state.sign.element);
    const cardEl = D.ELEMENTS[cardElKey];
    const linkedSign = D.TAROT_SIGN_LINK[d.card.id];
    html += `
      <p><b>「${posName} · ${d.card.name}」</b>——星象对应 <b>${linkedSign || d.card.astro}</b>（${cardEl.name}象，${cardEl.planet}）。
        它与你的${userElNamed}象之间：<b style="color:${elementRelColor(rel)}">${elementRelationText(rel)}</b></p>
    `;
  });

  block.innerHTML = html;
}

function elementRelColor(rel) {
  return rel === "harmonious" || rel === "same" ? "#7fd6a2" : rel === "challenging" ? "#e0a06a" : "#a48bf0";
}

function renderPsychBlock() {
  const block = $("#psychBlock");
  const lines = state.draws.map((d, i) => {
    const posName = state.spread.positions[i] || `位置 ${i + 1}`;
    return `<p><b>「${posName} · ${d.card.name}」</b>：${d.card.psych}</p>`;
  }).join("");

  block.innerHTML = `
    <h3><span class="ic">◉</span>心理映照 · 荣格原型视角</h3>
    <p>${D.PSYCH.archetype.desc}</p>
    ${lines}
    <p>${D.PSYCH.projection.desc}</p>
    <p class="legal small"><b>巴纳姆效应提醒：</b>${D.PSYCH.barnum.desc}</p>
  `;
}

function renderActionBlock() {
  const block = $("#actionBlock");
  const actions = state.draws.map((d, i) => {
    const posName = state.spread.positions[i] || `位置 ${i + 1}`;
    return `<p><b>「${posName}」</b>：${d.card.action}</p>`;
  }).join("");

  block.innerHTML = `
    <h3><span class="ic">✧</span>给你当下的行动</h3>
    ${actions}
    <p>${D.PSYCH.agency.desc}</p>
  `;
}

/* ============================ 历史与分享 ============================ */
function makeRecord() {
  const theme = D.THEMES.find(t => t.id === state.themeId);
  return {
    ts: Date.now(),
    name: state.name || "",
    signId: state.sign ? state.sign.id : "",
    sign: state.sign ? state.sign.sign : "",
    big3: state.birth ? { sun: state.birth.sun, moon: state.birth.moon, asc: state.birth.asc } : null,
    themeId: state.themeId,
    themeName: theme ? theme.name : "综合指引",
    spreadId: state.spreadId,
    spreadName: state.spread ? state.spread.name : "塔罗指引",
    cards: state.draws.map((d, i) => ({
      id: d.card.id, name: d.card.name, en: d.card.en, symbol: d.card.symbol,
      position: (state.spread.positions[i] || ("位置 " + (i + 1))),
      orient: d.orient,
      keywords: (d.card.keywords || []).slice(0, 3),
      astro: d.card.astro
    })),
    summary: makeSummary()
  };
}

function makeSummary() {
  const first = state.draws[0];
  if (!first) return "";
  const kws = (first.card.keywords || []).slice(0, 2).join("、") || first.card.name;
  const orient = first.orient === "reverse" ? "逆位" : "正位";
  return `${state.spread.name}首张「${first.card.name}」${orient}，指向“${kws}”这一关键讯息。`;
}

function openHistoryRecord(rec) {
  suppressSave = true;
  state._restoring = true;
  // 恢复状态
  state.name = rec.name || "";
  $("#userName").value = state.name;
  const zs = D.ZODIAC.find(z => z.id === rec.signId);
  if (zs) selectZodiac(zs.id, true);
  state.themeId = rec.themeId || "general";
  $$("#themePicker .theme-chip").forEach(c => c.classList.toggle("selected", c.dataset.theme === state.themeId));
  state.spread = D.SPREADS.find(s => s.id === rec.spreadId) || D.SPREADS[0];
  state.spreadId = state.spread.id;
  state.draws = (rec.cards || []).map(c => ({
    card: D.FULL_DECK.find(x => x.id === c.id) || D.TAROT[0],
    orient: c.orient || "upright"
  }));
  state.birth = rec.big3 ? { sun: rec.big3.sun, moon: rec.big3.moon, asc: rec.big3.asc } : null;
  buildReading();
  state._restoring = false;
  suppressSave = false;
}

/* 分享按钮 + 主题选择 */
function setupShareButtons() {
  if (!Save) return;
  const imgBtn = $("#shareImgBtn"), txtBtn = $("#shareTextBtn");
  if (imgBtn) imgBtn.addEventListener("click", () => {
    if (state.lastRecord) Save.shareImage(state.lastRecord, { theme: state.shareTheme });
    else Save.toast("还没有可分享的解读");
  });
  if (txtBtn) txtBtn.addEventListener("click", () => {
    if (!state.lastRecord) { Save.toast("还没有可分享的解读"); return; }
    const text = Save.shareText(state.lastRecord);
    copyText(text).then(ok => Save.toast(ok ? "已复制解读文字" : "复制失败"));
  });
}

/* 渲染分享卡主题色块 */
function initShareThemes() {
  if (!Save) return;
  const wrap = $("#shareThemes");
  if (!wrap) return;
  const list = Save.themesList();
  wrap.innerHTML = list.map(t => `
    <button type="button" class="theme-swatch" data-theme="${t.id}" title="${t.name}主题"
      style="background:linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]}); border-color:${t.swatch[2]};">
      <span class="sn">${t.name}</span>
    </button>`).join("");
  $$(".theme-swatch", wrap).forEach(btn => {
    btn.addEventListener("click", () => selectShareTheme(btn.dataset.theme));
  });
  const initBtn = wrap.querySelector(`[data-theme="${state.shareTheme}"]`);
  if (initBtn) initBtn.classList.add("selected");
}

function selectShareTheme(id) {
  state.shareTheme = id;
  $$("#shareThemes .theme-swatch").forEach(b => b.classList.toggle("selected", b.dataset.theme === id));
}
function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(t).then(() => true).catch(() => fallbackCopy(t));
  }
  return Promise.resolve(fallbackCopy(t));
}
function fallbackCopy(t) {
  try {
    const ta = document.createElement("textarea");
    ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

function closingText() {
  const signTrait = state.sign ? state.sign.desc : "愿你带着好奇与觉察，去照见自己。";
  return `星辰与牌面只是镜子，真正的指引在你心里。<br/>
    <b>${state.sign ? state.sign.sign + "的你 · " + state.sign.keywords.join("、") : "愿你"}</b>：${signTrait}
    本解读基于塔罗象征、星象对应与心理学视角生成，供自我探索与反思之用，不构成对未来事实的断言。`;
}

/* ============================ 星空背景 ============================ */
function initStars() {
  const canvas = $("#stars");
  const ctx = canvas.getContext("2d");
  let w, h, stars = [];
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    stars = Array.from({ length: Math.min(180, Math.floor(w * h / 9000)) }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.3 + 0.2,
      tw: Math.random() * Math.PI * 2,
      sp: 0.004 + Math.random() * 0.02
    }));
  }
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const alpha = 0.3 + 0.7 * Math.abs(Math.sin(s.tw + t * s.sp));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232, 227, 242, ${alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(draw);
}

/* ============================ 示例解读 ============================ */
/* 示例：快速生成一组牌面以预览解读效果，也可作为分享链接 (index.html#example) */
function runExample() {
  selectZodiac("scorpio", true);
  selectTheme("love", true);
  state.themeId = "love";
  $$("#themePicker .theme-chip").forEach(c => c.classList.toggle("selected", c.dataset.theme === "love"));
  state.name = "小星";
  state.spread = D.SPREADS.find(s => s.id === "growth");
  state.spreadId = "growth";
  state.draws = [
    { card: D.TAROT.find(c => c.id === "moon"),     orient: "reverse" },
    { card: D.TAROT.find(c => c.id === "star"),     orient: "upright" },
    { card: D.TAROT.find(c => c.id === "sun"),      orient: "upright" }
  ];
  buildReading();
}

/* ============================ 启动 ============================ */
document.addEventListener("DOMContentLoaded", () => {
  initStars();
  initZodiacPicker();
  initThemePicker();
  initBirthForm();
  initSpreadGrid();
  refreshContextLine();
  updateFormReady();

  setupShareButtons();
  initShareThemes();

  // 历史记录入口
  const histBtn = $("#historyBtn");
  if (histBtn && Save) histBtn.addEventListener("click", () => Save.openHistory(openHistoryRecord));
  const clearBtn = $("#clearHistoryBtn");
  if (clearBtn && Save) clearBtn.addEventListener("click", () => {
    if (Save.loadAll().length && confirm("确定清空全部历史记录吗？")) { Save.clear(); Save.closeHistory(); Save.toast("历史已清空"); }
  });
  $$("[data-close-history]").forEach(b => b.addEventListener("click", () => Save && Save.closeHistory()));
  $("#modal-history").addEventListener("click", e => { if (e.target.id === "modal-history") Save && Save.closeHistory(); });

  $$("[data-goto-example]").forEach(b => b.addEventListener("click", () => runExample()));
  if (location.hash === "#example") runExample();
});
