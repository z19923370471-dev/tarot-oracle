/* =========================================================================
 * 星曜塔罗 · astro.js
 * 出生时间 · 精准星盘（太阳/月亮/上升星座，基于 Meeus 天文算法近似）
 * 说明：本模块独立、纯 JS、无外部依赖；符号级精度足够判断星座，
 *       但若出生时间临近星座交界，请以专业星历软件为准。
 * ========================================================================= */

"use strict";

(function (root) {
  const RAD = Math.PI / 180;
  const deg  = (r) => r * 180 / Math.PI;
  const rad  = (d) => d * RAD;
  const norm360 = (x) => { x = x % 360; return x < 0 ? x + 360 : x; };

  /* ---- 儒略日（公历, UT 小时） ---- */
  function julianDay(y, m, d, utHours) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const jd0 = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
    return jd0 + utHours / 24;
  }

  /* ---- 太阳视黄经（Meeus, 精度约 0.01°） ---- */
  function sunLongitude(jd) {
    const T = (jd - 2451545.0) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M  = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const Mr = rad(M);
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
            + 0.000289 * Math.sin(3 * Mr);
    const trueLong = L0 + C;
    const omega = 125.04 - 1934.136 * T;
    return norm360(trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega)));
  }

  /* ---- 月亮黄经（Meeus 主项, 精度约 0.3°） ---- */
  function moonLongitude(jd) {
    const T = (jd - 2451545.0) / 36525;
    const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
    const M  = 357.5291092 + 35999.0502909 * T;
    const Mp = 134.9634114 + 477198.8676313 * T;
    const D  = 297.8501921 + 445267.1114034 * T;
    const F  = 93.2720950 + 483202.0175233 * T;
    let lon = Lp
      + 6.288774 * Math.sin(rad(Mp))
      + 1.274027 * Math.sin(rad(2 * D - Mp))
      + 0.658314 * Math.sin(rad(2 * D))
      + 0.213618 * Math.sin(rad(2 * Mp))
      - 0.185116 * Math.sin(rad(M))
      - 0.114332 * Math.sin(rad(2 * F))
      + 0.058793 * Math.sin(rad(2 * D - 2 * Mp))
      + 0.057066 * Math.sin(rad(2 * D - M - Mp))
      + 0.053322 * Math.sin(rad(2 * D + Mp))
      + 0.045758 * Math.sin(rad(2 * D - M))
      - 0.040923 * Math.sin(rad(M - Mp))
      - 0.034720 * Math.sin(rad(D))
      - 0.030383 * Math.sin(rad(M + Mp))
      + 0.015327 * Math.sin(rad(2 * D - 2 * F));
    return norm360(lon);
  }

  /* ---- 格林尼治平恒星时（度） ---- */
  function gmstDeg(jd) {
    const T = (jd - 2451545.0) / 36525;
    let g = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
    return norm360(g);
  }

  /* ---- 黄赤交角（度） ---- */
  function obliquity(jd) {
    const T = (jd - 2451545.0) / 36525;
    return 23.439291 - 0.0130042 * T;
  }

  /* ---- 上升点黄经 + 中天黄经 ---- */
  function ascMc(jd, latDeg, lonDeg) {
    const gmst = gmstDeg(jd);
    const ramc = norm360(gmst + lonDeg);   // 地方恒星时（东经为正）
    const eps  = obliquity(jd);
    const ramcR = rad(ramc), latR = rad(latDeg), epsR = rad(eps);
    // MC（中天）
    const mc = norm360(deg(Math.atan2(Math.sin(ramcR), Math.cos(ramcR) * Math.cos(epsR))));
    // Asc（上升点）
    const asc = norm360(deg(Math.atan2(
      Math.cos(ramcR),
      -(Math.sin(ramcR) * Math.cos(epsR) + Math.tan(latR) * Math.sin(epsR))
    )));
    return { asc, mc };
  }

  /* ---- 黄经 → 星座 ---- */
  const SIGN_NAMES = [
    "白羊座", "金牛座", "双子座", "巨蟹座", "狮子座", "处女座",
    "天秤座", "天蝎座", "射手座", "摩羯座", "水瓶座", "双鱼座"
  ];
  const SIGN_KEYS  = ["aries","taurus","gemini","cancer","leo","virgo",
                      "libra","scorpio","sagittarius","capricorn","aquarius","pisces"];
  function signInfo(longitude) {
    const idx = Math.floor(norm360(longitude) / 30) % 12;
    return { index: idx, name: SIGN_NAMES[idx], key: SIGN_KEYS[idx], degree: norm360(longitude) - idx * 30 };
  }

  /* ---- 出生信息 → 三大主星（太阳/月亮/上升） ---- */
  /* birth: { year, month, day, hour, minute, tzOffset(小时, 东正), lat, lon } */
  function bigThree(birth) {
    const ut = birth.hour - birth.tzOffset;          // 地方时 → UTC 小时(可能跨天)
    let jdDays = julianDay(birth.year, birth.month, birth.day, ut);
    // 若 UTC 小时越过 0/24 边界，再做一次整日校正
    const jd = jdDays;

    const sun = signInfo(sunLongitude(jd));
    const moon = signInfo(moonLongitude(jd));
    const am = ascMc(jd, birth.lat, birth.lon);
    const asc = signInfo(am.asc);
    const mc  = signInfo(am.mc);

    return { jd, sun, moon, asc, mc, ascDeg: am.asc, mcDeg: am.mc };
  }

  /* ---- 元素平衡（太阳/月亮/上升 三主星的元素分布） ---- */
  const ELEMENT_OF_SIGN = {
    aries:"FIRE", leo:"FIRE", sagittarius:"FIRE",
    taurus:"EARTH", virgo:"EARTH", capricorn:"EARTH",
    gemini:"AIR", libra:"AIR", aquarius:"AIR",
    cancer:"WATER", scorpio:"WATER", pisces:"WATER"
  };
  function elementBalance(big3) {
    const count = { FIRE: 0, EARTH: 0, AIR: 0, WATER: 0 };
    [big3.sun.key, big3.moon.key, big3.asc.key].forEach(k => {
      const e = ELEMENT_OF_SIGN[k]; if (e) count[e]++;
    });
    return count;
  }

  /* ---- 公开接口（浏览器 + Node） ---- */
  const api = { julianDay, sunLongitude, moonLongitude, gmstDeg, obliquity, ascMc, bigThree, signInfo, elementBalance, norm360, SIGN_NAMES, SIGN_KEYS, ELEMENT_OF_SIGN };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  else { root.Astro = api; }

})(typeof window !== "undefined" ? window : globalThis);
