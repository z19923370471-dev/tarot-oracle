/* =========================================================================
 * 星曜塔罗 · save.js
 * 本地存储（浏览器 localStorage）+ 历史记录 + 分享卡片（canvas）
 * ========================================================================= */

"use strict";

(function (root) {
  const KEY = "tarotOracle.history.v1";
  const MAX = 40;

  /* ---- 存储访问（带容错） ---- */
  function store() { try { return root.localStorage; } catch (e) { return null; } }
  function loadAll() {
    const s = store(); if (!s) return [];
    try { const v = JSON.parse(s.getItem(KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function persist(list) {
    const s = store(); if (!s) return;
    try { s.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) { /* 忽略（如隐私模式） */ }
  }

  function add(record) {
    const list = loadAll().filter(r => r.id !== record.id);
    list.unshift(record);
    persist(list);
    return record;
  }
  function remove(id) { persist(loadAll().filter(r => r.id !== id)); }
  function clear() { const s = store(); if (s) { try { s.removeItem(KEY); } catch (e) {} } }
  function find(id) { return loadAll().find(r => r.id === id) || null; }

  /* ---- 历史弹窗 ---- */
  function openHistory(onOpen) {
    const modal = root.document && document.getElementById("modal-history");
    if (!modal) return;
    const listEl = document.getElementById("historyList");
    const countEl = document.getElementById("historyCount");
    const recs = loadAll();
    countEl.textContent = `共 ${recs.length} 条`;
    listEl.innerHTML = recs.length
      ? recs.map(r => `
        <div class="hist-item" data-id="${r.id}">
          <div class="hist-top">
            <span class="hist-date">${fmtDate(r.ts)}</span>
            <span class="hist-spread">${escapeHtml(r.spreadName || "")}</span>
          </div>
          <div class="hist-cards">${(r.cards || []).map(c =>
            `<span class="hist-card">${escapeHtml(c.symbol || "")}${escapeHtml(c.name || "")}<em>${c.orient === "reverse" ? "逆" : "正"}</em></span>`
          ).join("")}</div>
          <div class="hist-meta">${escapeHtml(r.sign || "")}${r.big3 ? " · 升" + escapeHtml(r.big3.asc) : ""}${r.name ? " · " + escapeHtml(r.name) : ""}</div>
        </div>`).join("")
      : `<div class="hist-empty">还没有占卜记录，先去抽一次牌吧。</div>`;

    listEl.querySelectorAll(".hist-item").forEach(item => {
      item.addEventListener("click", () => {
        const rec = find(item.dataset.id);
        if (rec && onOpen) onOpen(rec);
        closeHistory();
      });
    });

    modal.hidden = false;
  }
  function closeHistory() {
    const modal = root.document && document.getElementById("modal-history");
    if (modal) modal.hidden = true;
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---- 分享文字 ---- */
  function shareText(record) {
    const L = [];
    L.push("☽ 星曜塔罗 · " + (record.spreadName || "塔罗指引"));
    if (record.name) L.push("致 " + record.name);
    if (record.sign) L.push("星座：" + record.sign + (record.big3 ? "（升" + record.big3.asc + "）" : ""));
    L.push("主题：" + (record.themeName || "综合指引"));
    L.push("");
    (record.cards || []).forEach((c, i) => {
      L.push(`${c.position ? c.position + " · " : ""}${c.name}【${c.orient === "reverse" ? "逆位" : "正位"}】`);
      L.push("  「" + (c.keywords || []).join(" / ") + "」");
    });
    L.push("");
    if (record.summary) L.push(record.summary);
    L.push("");
    L.push("—— 塔罗为心灵之镜，助你照见内心；星曜塔罗 · 内观即启明。");
    return L.join("\n");
  }

  /* ---- 分享卡主题 ---- */
  const SHARE_THEMES = {
    starlight: { name: "星夜", swatch: ["#1a1238", "#0a0716", "#d9b36a"],
      bg: ["#1a1238", "#120c26", "#080510"], border: "rgba(217,179,106,0.55)", borderSoft: "rgba(217,179,106,0.25)",
      title: "#f0d9a8", accent: "#d9b36a", meta: "#b3a9cc", text: "#f0e6cf", dim: "#8a7fa6",
      cardBg: "rgba(217,179,106,0.12)", cardLine: "rgba(217,179,106,0.5)",
      orientUp: "#d9b36a", orientRev: "#c8a4e8", footer: "#6f6488", star: "#e8e3f2" },
    dawn: { name: "晨曦", swatch: ["#3a1c2e", "#1a0e1a", "#e78a5f"],
      bg: ["#3a1c2e", "#2a1524", "#1a0e1a"], border: "rgba(240,178,120,0.6)", borderSoft: "rgba(240,178,120,0.28)",
      title: "#f7d9bd", accent: "#e78a5f", meta: "#c9a9b8", text: "#f6e7d2", dim: "#9c7f8e",
      cardBg: "rgba(231,138,95,0.14)", cardLine: "rgba(231,138,95,0.5)",
      orientUp: "#e78a5f", orientRev: "#d6a6d8", footer: "#8a6f7c", star: "#f6e6c8" },
    ocean: { name: "沧海", swatch: ["#0f2438", "#071220", "#7fb3d5"],
      bg: ["#0f2438", "#0c1b2c", "#071220"], border: "rgba(140,200,225,0.5)", borderSoft: "rgba(140,200,225,0.22)",
      title: "#cfe6f2", accent: "#7fb3d5", meta: "#9db8c9", text: "#e2eefa", dim: "#6d8ba1",
      cardBg: "rgba(127,179,213,0.13)", cardLine: "rgba(127,179,213,0.5)",
      orientUp: "#7fb3d5", orientRev: "#a5c8e0", footer: "#5b7689", star: "#d6ecf7" },
    jade: { name: "青玉", swatch: ["#0f2a24", "#071512", "#8fd3ab"],
      bg: ["#0f2a24", "#0b201b", "#071512"], border: "rgba(150,214,180,0.5)", borderSoft: "rgba(150,214,180,0.22)",
      title: "#d6f0dd", accent: "#8fd3ab", meta: "#a3c3b0", text: "#e3f4e8", dim: "#6d8a79",
      cardBg: "rgba(143,211,171,0.13)", cardLine: "rgba(143,211,171,0.5)",
      orientUp: "#8fd3ab", orientRev: "#b9d6c6", footer: "#5f7a6c", star: "#dbf3e3" },
    ember: { name: "焰火", swatch: ["#33121a", "#180708", "#e07a4a"],
      bg: ["#33121a", "#260d13", "#180708"], border: "rgba(240,150,90,0.55)", borderSoft: "rgba(240,150,90,0.25)",
      title: "#f6d0ae", accent: "#e07a4a", meta: "#bd938a", text: "#f6e3d4", dim: "#8f6a61",
      cardBg: "rgba(224,122,74,0.15)", cardLine: "rgba(224,122,74,0.5)",
      orientUp: "#e07a4a", orientRev: "#c89a6a", footer: "#7d5a50", star: "#f6d4b0" },
    parchment: { name: "羊皮纸", swatch: ["#efe4c9", "#d8c6a0", "#8a5a2a"],
      bg: ["#efe4c9", "#e6d7b6", "#d8c6a0"], border: "rgba(120,90,40,0.6)", borderSoft: "rgba(120,90,40,0.3)",
      title: "#4a3420", accent: "#8a5a2a", meta: "#6b5638", text: "#3a2c1a", dim: "#8a7550",
      cardBg: "rgba(138,90,42,0.12)", cardLine: "rgba(138,90,42,0.5)",
      orientUp: "#8a5a2a", orientRev: "#7c6550", footer: "#9a7f52", star: "#bfa977" }
  };
  function getTheme(id) { return SHARE_THEMES[id] || SHARE_THEMES.starlight; }
  function themesList() { return Object.keys(SHARE_THEMES).map(id => ({ id, name: SHARE_THEMES[id].name, swatch: SHARE_THEMES[id].swatch })); }

  /* ---- 分享卡片（canvas，主题驱动） ---- */
  function shareImage(record, opts) {
    // 兼容传法：{theme} 或直接传 canvas
    const opt = (opts && typeof opts === "object" && opts.getContext) ? { canvas: opts } : (opts || {});
    const theme = getTheme(opt.theme || "starlight");
    const canvas = opt.canvas || (root.document && document.createElement("canvas"));
    if (!canvas || !canvas.getContext) { toast("当前环境不支持生成图片"); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { toast("绘图失败"); return; }

    const W = 760;
    const rowH = 62;
    const headH = 330;
    const cardAmt = Math.min(record.cards.length, 10);
    const H = headH + cardAmt * (rowH + 6) + 150;
    canvas.width = W; canvas.height = H;

    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.bg[0]); g.addColorStop(0.5, theme.bg[1]); g.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 星光/纹理
    ctx.fillStyle = theme.star;
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      ctx.globalAlpha = 0.2 + Math.random() * 0.5;
      ctx.beginPath(); ctx.arc(x, y, Math.random() * 1.4 + 0.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 边框
    ctx.strokeStyle = theme.border; ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, W - 36, H - 36);
    ctx.strokeStyle = theme.borderSoft; ctx.lineWidth = 1;
    ctx.strokeRect(26, 26, W - 52, H - 52);

    const serif = '"Noto Serif SC","Microsoft YaHei",serif';

    // 标题区
    ctx.textAlign = "center";
    ctx.fillStyle = theme.title;
    ctx.font = "800 42px " + serif;
    ctx.fillText("星曜塔罗 · " + (record.spreadName || "塔罗指引"), W / 2, 110);

    ctx.fillStyle = theme.meta;
    ctx.font = "20px " + serif;
    const now = fmtDate(record.ts);
    let meta = now + (record.sign ? " · " + record.sign : "") + (record.name ? " · " + record.name : "");
    ctx.fillText(meta, W / 2, 158);

    if (record.big3) {
      ctx.fillStyle = theme.accent;
      ctx.font = "18px " + serif;
      ctx.fillText(`太阳 ${record.big3.sun} · 月亮 ${record.big3.moon} · 上升 ${record.big3.asc}`, W / 2, 196);
    }
    ctx.fillStyle = theme.dim;
    ctx.font = "17px " + serif;
    ctx.fillText("主题 · " + (record.themeName || "综合指引"), W / 2, 238);

    // 分隔线
    ctx.strokeStyle = theme.borderSoft;
    ctx.beginPath(); ctx.moveTo(60, 264); ctx.lineTo(W - 60, 264); ctx.stroke();

    // 卡牌列表
    let y = 310;
    record.cards.slice(0, cardAmt).forEach(c => {
      ctx.fillStyle = theme.cardBg;
      ctx.strokeStyle = theme.cardLine;
      ctx.lineWidth = 1;
      roundRect(ctx, 40, y, W - 80, rowH, 10); ctx.fill(); ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = theme.meta; ctx.font = "15px " + serif;
      const pos = c.position ? c.position.slice(0, 6) : "";
      ctx.fillText(pos, 56, y + rowH / 2 + 5);
      ctx.fillStyle = theme.text; ctx.font = "600 20px " + serif;
      const nameStr = (c.symbol ? c.symbol + " " : "") + c.name;
      ctx.fillText(nameStr, 150, y + rowH / 2 + 5);
      ctx.fillStyle = c.orient === "reverse" ? theme.orientRev : theme.orientUp;
      const orientStr = c.orient === "reverse" ? "逆位" : "正位";
      ctx.font = "600 17px " + serif;
      ctx.textAlign = "right";
      ctx.fillText(orientStr, W - 56, y + rowH / 2 + 5);
      ctx.fillStyle = theme.dim; ctx.font = "16px " + serif;
      ctx.textAlign = "left";
      ctx.fillText("「" + (c.keywords || []).slice(0, 3).join(" · ") + "」", 150, y + rowH - 12);
      y += rowH + 6;
    });

    // 底部
    if (record.summary) {
      ctx.textAlign = "center"; ctx.fillStyle = theme.meta; ctx.font = "17px " + serif;
      const s = record.summary.length > 46 ? record.summary.slice(0, 46) + "…" : record.summary;
      ctx.fillText(s, W / 2, y + 44);
    }
    ctx.fillStyle = theme.footer; ctx.font = "15px " + serif;
    ctx.textAlign = "center";
    ctx.fillText(`星曜塔罗 · 内观即启明 ❖ ${theme.name}主题 · 仅供自我探索`, W / 2, H - 66);

    // 自动下载
    try {
      const a = root.document.createElement("a");
      a.download = "星曜塔罗-" + theme.name + "-" + (record.spreadName || "指引") + "-" + record.ts + ".png";
      a.href = canvas.toDataURL("image/png");
      a.style.display = "none";
      root.document.body.appendChild(a);
      a.click();
      root.document.body.removeChild(a);
      toast(`「${theme.name}」分享卡已生成并开始下载`);
    } catch (e) { toast("下载失败"); }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---- 轻提示 ---- */
  let toastTimer = null;
  function toast(msg) {
    const el = root.document && document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  const api = { KEY, add, remove, clear, loadAll, find, openHistory, closeHistory, shareText, shareImage, toast, SHARE_THEMES, themesList };
  root.Save = api;
})(typeof window !== "undefined" ? window : globalThis);
