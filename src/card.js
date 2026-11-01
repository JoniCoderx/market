// Builds the 1450x1050 monthly signal card as HTML (rendered to PNG by build.js).
const path = require('path');

const COL = {
  green: '#2fd12f',
  red: '#ff2a2a',
  grey: '#a8a8a8',
  yellow: '#ffff33',
  orange: '#ffa31a',
  cyan: '#1ec8f0',
};
const RATING_COLOR = { 'Strong Buy': COL.green, Buy: COL.green, Neutral: '#d0d0d0', Sell: COL.red, 'Strong Sell': COL.red };
const HEALTH = [
  { label: 'Weak Performance', color: '#e02424', fill: '#2a0b0b' },
  { label: 'Fair Performance', color: '#f08a00', fill: '#2a1a05' },
  { label: 'Good Performance', color: '#e0b000', fill: '#2a2205' },
  { label: 'Great Performance', color: '#7fb800', fill: '#18220a' },
  { label: 'Excellent Performance', color: '#2f9a14', fill: '#0c2208' },
];
const TONE = { good: COL.green, bad: COL.red, neutral: '#bdbdbd' };

const money = (v) => '$' + (v >= 100 ? Math.round(v).toString() : v.toFixed(0));
const price = (v) => '$' + v.toFixed(2);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function slider(title, value, low, high) {
  const lo = Math.min(low, value), hi = Math.max(high, value);
  const pos = hi === lo ? 50 : ((value - lo) / (hi - lo)) * 100;
  return `
  <div class="slider">
    <div class="s-title">${title}</div>
    <div class="s-val" style="left:${Math.min(80, Math.max(20, pos))}%">${price(value)}</div>
    <div class="s-bar"><div class="s-dot" style="left:${pos}%"></div></div>
    <div class="s-ends"><span>${money(low)}</span><span>${money(high)}</span></div>
  </div>`;
}

function gauge(score, label, logo) {
  // score in [-1, 1] -> angle 180° (strong sell) .. 0° (strong buy)
  const cx = 150, cy = 150, r = 128;
  const ang = Math.PI * (1 - (Math.max(-1, Math.min(1, score)) + 1) / 2);
  const nx = cx + Math.cos(ang) * (r - 34), ny = cy - Math.sin(ang) * (r - 34);
  return `
  <div class="gauge">
    <svg width="300" height="165" viewBox="0 0 300 165">
      <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ff1a2d"/><stop offset="0.5" stop-color="#9a5a4a"/><stop offset="1" stop-color="#4be81d"/></linearGradient></defs>
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="url(#g)" stroke-width="22"/>
      <image href="${logo}" x="${cx - 62}" y="${cy - 110}" width="124" height="124" opacity="0.13"/>
      <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="7" fill="#fff"/>
    </svg>
    <span class="g-l" style="left:-96px;top:120px">Strong Sell</span>
    <span class="g-l" style="left:12px;top:44px">Sell</span>
    <span class="g-l" style="left:150px;top:-8px;transform:translateX(-50%)">Neutral</span>
    <span class="g-l" style="left:258px;top:44px">Buy</span>
    <span class="g-l" style="left:312px;top:120px">Strong Buy</span>
    <div class="g-status" style="color:${RATING_COLOR[label]}">${label.toUpperCase()}</div>
  </div>`;
}

function card({ stock, month, market, signals, logo, chart }) {
  const fv = month.fairValue;
  const upside = ((fv.average - market.price) / market.price) * 100;
  const up = upside >= 0;
  const h = stock.financialHealth;
  const hs = HEALTH[h.score - 1];
  const unc = { LOW: COL.green, MED: '#e0b000', MEDIUM: '#e0b000', HIGH: COL.red }[fv.uncertainty.toUpperCase()] || COL.grey;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Source Sans 3';font-weight:400;src:url('${path.join(__dirname, '../assets/fonts/source-sans-400.woff2')}')}
@font-face{font-family:'Source Sans 3';font-weight:600;src:url('${path.join(__dirname, '../assets/fonts/source-sans-600.woff2')}')}
@font-face{font-family:'Source Sans 3';font-weight:700;src:url('${path.join(__dirname, '../assets/fonts/source-sans-700.woff2')}')}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1450px;height:1050px;background:#000;color:#fff;font-family:'Source Sans 3',sans-serif;position:relative;overflow:hidden}
.abs{position:absolute}
h1{position:absolute;left:32px;top:28px;font-size:34px;font-weight:700;letter-spacing:-0.3px}
h1 .t{color:${COL.orange}}
.logo{position:absolute;right:26px;top:20px;width:52px;height:52px}
.chart{position:absolute;left:30px;top:84px}
.pros{position:absolute;left:1150px;top:84px;width:292px}
.pro{display:flex;gap:10px;font-size:18px;line-height:1.3;padding:4px 0 16px}
.pro:before{content:'';flex:0 0 13px;height:13px;border-radius:50%;background:#fff;margin-top:5px}
.pro+.pro{border-top:2px solid #fff;padding-top:14px}
.sum{position:absolute;left:42px;top:494px;font-size:34px}
.rule{position:absolute;height:2px;background:#bbb}
.row{position:absolute;left:42px;font-size:23px;display:grid;grid-template-columns:232px 130px 92px 90px}
.cnt{color:${COL.grey}}
.slider{position:absolute;top:660px;width:178px}
.s-title{color:${COL.yellow};font-size:26px;white-space:nowrap;margin-bottom:12px}
.s-val{position:relative;font-size:19px;transform:translateX(-50%);display:inline-block;white-space:nowrap}
.s-bar{position:relative;height:3px;background:#bbb;margin-top:10px}
.s-dot{position:absolute;top:-5px;width:13px;height:13px;border-radius:50%;background:#ffe600;transform:translateX(-50%)}
.s-ends{display:flex;justify-content:space-between;font-size:14px;margin-top:9px}
.gauge{position:absolute;left:162px;top:825px;width:300px}
.g-l{position:absolute;font-size:16px;white-space:nowrap}
.g-status{position:absolute;top:174px;width:300px;text-align:center;font-size:24px;font-weight:600}
.vline{position:absolute;left:748px;top:508px;width:2px;height:494px;background:#ddd}
.fv-title{position:absolute;left:776px;top:500px;font-size:24px}
.fv{position:absolute;top:550px;display:flex;flex-direction:column;gap:8px;padding-left:15px;border-left:3px solid;font-size:18px;height:58px;justify-content:center}
.fh-title{position:absolute;left:774px;top:654px;font-size:30px;color:${COL.cyan}}
.fh-text{position:absolute;left:774px;top:703px;width:640px;font-size:17.5px;line-height:1.35}
.scale{position:absolute;top:800px;width:110px;text-align:center;font-size:18px}
.scale i{display:block;height:9px;margin-top:6px}
.box{position:absolute;top:888px;width:116px;height:110px;border:3px solid;padding:16px 10px 0;font-size:18px;line-height:1.25}
</style></head><body>
<h1>${esc(stock.name)} <span class="t">${esc(stock.ticker)}</span></h1>
<img class="logo" src="${logo}">
<div class="chart">${chart}</div>

<div class="pros">
${month.tips.map((t) => `<div class="pro" style="color:${TONE[t.tone] || TONE.neutral}">${esc(t.text)}</div>`).join('')}
</div>

<div class="sum">Summary: <span style="color:${RATING_COLOR[signals.summary.label]}">${signals.summary.label}</span></div>
<div class="rule" style="left:42px;top:545px;width:336px"></div>
<div class="row" style="top:556px"><span>Technical Indicators:</span><span style="color:${RATING_COLOR[signals.technical.label]}">${signals.technical.label}</span><span class="cnt">Buy: (${signals.technical.buy})</span><span class="cnt">Sell: (${signals.technical.sell})</span></div>
<div class="row" style="top:589px"><span>Moving Averages:</span><span style="color:${RATING_COLOR[signals.movingAverages.label]}">${signals.movingAverages.label}</span><span class="cnt">Buy: (${signals.movingAverages.buy})</span><span class="cnt">Sell: (${signals.movingAverages.sell})</span></div>
<div class="rule" style="left:42px;top:643px;width:682px"></div>

<div style="position:absolute;left:44px">${slider('Market Range', market.price, market.low52, market.high52)}</div>
<div style="position:absolute;left:287px">${slider('Analyst Targets', month.analystTargets.average, month.analystTargets.low, month.analystTargets.high)}</div>
<div style="position:absolute;left:532px">${slider('Investing Models', fv.average, fv.low, fv.high)}</div>

${gauge(signals.summary.score, signals.summary.label, logo)}

<div class="vline"></div>
<div class="fv-title">Fair Value</div>
<div class="fv" style="left:782px;border-color:${up ? COL.green : COL.red}"><span>Average</span><span style="color:${up ? COL.green : COL.red}">${fv.average.toFixed(2)}</span></div>
<div class="fv" style="left:901px;border-color:${up ? COL.green : COL.red}"><span>${up ? 'Upside' : 'Downside'}</span><span style="color:${up ? COL.green : COL.red}">${Math.abs(upside).toFixed(1)}%</span></div>
<div class="fv" style="left:1028px;border-color:${unc}"><span>Uncertainty</span><span>${esc(fv.uncertainty.toUpperCase())}</span></div>
<div class="fv" style="left:1165px;border-color:#888"><span>Spread</span><span>${fv.high.toFixed(2)} - ${fv.low.toFixed(2)}</span></div>
<div class="rule" style="left:776px;top:641px;width:198px"></div>

<div class="fh-title">Financial Health</div>
<div class="fh-text">Financial Health for ${esc(stock.shortName)} is determined by ranking the company on over 100 factors against companies in the ${esc(stock.sector)} sector and operating in Developed Economic Markets</div>
${HEALTH.map((s, i) => `<div class="scale" style="left:${776 + i * 122}px">${i + 1}<i style="background:${s.color}"></i></div>`).join('')}
<div class="abs" style="left:${776 + (h.score - 1) * 122 + 55 - 8}px;top:821px;width:16px;height:16px;border-radius:50%;background:#fff"></div>
<div class="abs" style="left:${776 + (h.score - 1) * 122 + 55}px;top:845px;transform:translateX(-50%);font-size:18px;white-space:nowrap">${hs.label}</div>
${h.factors
  .map((f, i) => {
    const s = HEALTH[f.score - 1];
    return `<div class="box" style="left:${780 + i * 130}px;border-color:${s.color};background:${s.fill}">${f.score}<br>${esc(f.name).replace(/ (?=\S+$)/, '<br>')}</div>`;
  })
  .join('')}
</body></html>`;
}

module.exports = { card };
