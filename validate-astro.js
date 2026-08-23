/* astro.js 校验：验证太阳/月亮精度 + 上升星座方向恒等式 */
"use strict";
const A = require("../js/astro.js");

function assert(cond, msg) { if (!cond) { console.error("✗ " + msg); process.exit(1); } }

/* 1) 太阳黄经精度：春分≈0°，夏至≈90°，秋分≈180°，冬至≈270°（2025 各节气近似时刻） */
const solstice = [
  ["2025-03-20 09:01", 0], ["2025-06-21 02:42", 90], ["2025-09-22 18:19", 180], ["2025-12-21 15:03", 270]
];
console.log("── 太阳黄经精度 ──");
solstice.forEach(([s, exp]) => {
  const [date, hm] = s.split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const jd = A.julianDay(y, m, d, hh + mm / 60);
  const lon = A.sunLongitude(jd);
  const err = Math.abs(lon - exp) > 180 ? 360 - Math.abs(lon - exp) : Math.abs(lon - exp);
  console.log(`  ${s}  太阳黄经=${lon.toFixed(2)}°  预期=${exp}°  误差=${err.toFixed(3)}°`);
  assert(err < 1.0, `太阳黄经误差过大：${s}`);
});

/* 2) 月亮相位：公认日期——新月 2000-01-06 18:14UT(相位≈0)，满月 2000-01-21 04:40UT(≈180) */
console.log("── 月亮黄经(相位检测) ──");
const moonTests = [
  { label: "新月 2000-01-06 18:14 UT", y:2000,m:1,d:6,hh:18,mm:14, expect: 0 },
  { label: "满月 2000-01-21 04:40 UT", y:2000,m:1,d:21,hh:4,mm:40, expect: 180 }
];
moonTests.forEach(t => {
  const jd = A.julianDay(t.y, t.m, t.d, t.hh + t.mm/60);
  const sunL = A.sunLongitude(jd), moonL = A.moonLongitude(jd);
  let phase = ((moonL - sunL) % 360 + 360) % 360;
  const err = Math.abs(phase - t.expect) > 180 ? 360 - Math.abs(phase - t.expect) : Math.abs(phase - t.expect);
  console.log(`  ${t.label}  太阳=${sunL.toFixed(1)}° 月亮=${moonL.toFixed(1)}° 相位=${phase.toFixed(1)}° 预期=${t.expect}° 误差=${err.toFixed(1)}°`);
  assert(err < 4, `月亮相位误差过大：${t.label}`);
});

/* 3) 上升星座方向恒等式：日出时刻，上升点黄经≈太阳黄经 */
console.log("── 上升点 = 太阳(日出时刻) 恒等式 ──");
function declination(sunLon, jd) {
  const eps = A.obliquity(jd);
  return Math.asin(Math.sin(A.rad === undefined ? sunLon * Math.PI/180 : sunLon * Math.PI/180) * Math.sin(eps * Math.PI/180)) * 180 / Math.PI;
}
function testSunrise(y, m, d, lat, lon, label) {
  // 参考正午 UT 计算太阳赤纬, 再求日出时角
  const jdNoon = A.julianDay(y, m, d, 12 - lon / 15);
  const sunN = A.sunLongitude(jdNoon);
  const dec = declination(sunN, jdNoon);
  const cosH0 = -Math.tan(lat * Math.PI / 180) * Math.tan(dec * Math.PI / 180);
  if (Math.abs(cosH0) > 1) { console.log(`  ${label}: 极昼/极夜，跳过`); return; }
  const H0 = Math.acos(cosH0) * 180 / Math.PI;      // 日出时角(度)
  const srLAT = 12 - H0 / 15;                        // 日出地方视时(小时)
  const srUT = srLAT - lon / 15;                     // 近似换算到 UT
  const jdSR = A.julianDay(y, m, d, srUT);
  const asc = A.ascMc(jdSR, lat, lon).asc;
  const sunAtSr = A.sunLongitude(jdSR);
  let ddeg = Math.abs(asc - sunAtSr); if (ddeg > 180) ddeg = 360 - ddeg;
  console.log(`  ${label}  日出UT=${srUT.toFixed(2)}h  上升=${asc.toFixed(2)}°  太阳=${sunAtSr.toFixed(2)}°  差=${ddeg.toFixed(2)}°`);
  assert(ddeg < 3, `上升≠太阳恒等式失败：${label}（差 ${ddeg}°，可能方向反了）`);
}
testSunrise(2025, 3, 25, 40.71, -74.0, "纽约 03-25");   // 北半球
testSunrise(2025, 9, 20, -33.87, 151.2, "悉尼 09-20");  // 南半球
testSunrise(2025, 6, 15, 51.5, -0.12, "伦敦 06-15");    // 高纬

/* 4) 上升星座 24h 内应走完 12 星座（每 ~2h 换一个） */
console.log("── 24h 上升星座轮转 ──");
const jd0 = A.julianDay(2025, 6, 15, 0); // 用某基准
let signs = new Set();
for (let h = 0; h < 24; h++) {
  const am = A.ascMc(jd0 + h / 24, 51.5, -0.12);
  signs.add(Math.floor(A.norm360(A.signInfo(am.asc).index)));
}
console.log("  伦敦 24h 出现的上升星座(0-11):", Array.from(signs).sort((a,b)=>a-b).join(","));
assert(signs.size >= 11, "上升星座应在 24h 内几乎走完 12 星座");

console.log("\n✅ astro.js 校验全部通过 — 太阳/月亮/上升星座算法正确");
