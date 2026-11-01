// Draws a Finviz-style daily candlestick chart as inline SVG.
const { sma } = require('./indicators');

const C = {
  bg: '#22262f',
  grid: '#2d323d',
  axis: '#8a909c',
  up: '#2fbf4a',
  down: '#f0505a',
  upVol: 'rgba(47,191,74,0.45)',
  downVol: 'rgba(240,80,90,0.45)',
  sma20: '#9b59b6',
  sma50: '#e08a2c',
  sma200: '#a59a7a',
};

const fmt = (v) => (v >= 1000 ? v.toFixed(0) : v.toFixed(2));
const fmtVol = (v) => (v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : (v / 1e3).toFixed(0) + 'K');

function niceStep(range, ticks) {
  const raw = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

function chartSVG(allBars, { width = 1100, height = 308, visible = 215 } = {}) {
  const closes = allBars.map((b) => b.close);
  const s20 = sma(closes, 20), s50 = sma(closes, 50), s200 = sma(closes, 200);
  const start = Math.max(0, allBars.length - visible);
  const bars = allBars.slice(start);
  const lastBar = bars[bars.length - 1];
  const prevClose = allBars[allBars.length - 2].close;

  const padL = 8, padR = 46, top = 30, priceBottom = height - 62, volTop = height - 58, volBottom = height - 20;
  const plotW = width - padL - padR;
  const step = plotW / bars.length;
  const bodyW = Math.max(1.5, step * 0.62);

  const lo = Math.min(...bars.map((b) => b.low)), hi = Math.max(...bars.map((b) => b.high));
  const pad = (hi - lo) * 0.06;
  const yMin = lo - pad, yMax = hi + pad;
  const y = (v) => top + ((yMax - v) / (yMax - yMin)) * (priceBottom - top);
  const x = (i) => padL + step * i + step / 2;
  const vMax = Math.max(...bars.map((b) => b.volume));
  const vy = (v) => volBottom - (v / vMax) * (volBottom - volTop);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Source Sans 3, sans-serif">`;
  svg += `<rect width="${width}" height="${height}" fill="${C.bg}"/>`;

  // Price grid + right axis
  const ps = niceStep(yMax - yMin, 7);
  for (let v = Math.ceil(yMin / ps) * ps; v <= yMax; v += ps) {
    svg += `<line x1="${padL}" x2="${width - padR}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}" stroke-width="1"/>`;
    svg += `<text x="${width - padR + 6}" y="${y(v) + 3}" font-size="9" fill="${C.axis}">${fmt(v)}</text>`;
  }

  // Month labels + vertical grid
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  bars.forEach((b, i) => {
    if (i === 0) return;
    const d = new Date(b.t * 1000), p = new Date(bars[i - 1].t * 1000);
    if (d.getUTCMonth() !== p.getUTCMonth()) {
      const label = d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : months[d.getUTCMonth()];
      svg += `<line x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${volBottom}" stroke="${C.grid}" stroke-width="1"/>`;
      svg += `<text x="${x(i)}" y="${height - 7}" font-size="9" fill="${C.axis}" text-anchor="middle">${label}</text>`;
    }
  });

  // Volume
  bars.forEach((b, i) => {
    const up = b.close >= b.open;
    svg += `<rect x="${x(i) - bodyW / 2}" y="${vy(b.volume)}" width="${bodyW}" height="${volBottom - vy(b.volume)}" fill="${up ? C.upVol : C.downVol}"/>`;
  });
  [vMax * 0.5, vMax].forEach((v) => {
    svg += `<text x="${padL + 2}" y="${vy(v) + 3}" font-size="8" fill="${C.axis}">${fmtVol(v).replace(/\.\d+/, '')}</text>`;
  });

  // Moving averages
  const line = (series, color) => {
    const pts = [];
    for (let i = 0; i < bars.length; i++) {
      const v = series[start + i];
      if (v !== null && v !== undefined) pts.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    }
    return pts.length ? `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.9"/>` : '';
  };
  svg += line(s200, C.sma200) + line(s50, C.sma50) + line(s20, C.sma20);

  // Candles
  bars.forEach((b, i) => {
    const up = b.close >= b.open;
    const col = up ? C.up : C.down;
    const yo = y(b.open), yc = y(b.close);
    svg += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(b.high)}" y2="${y(b.low)}" stroke="${col}" stroke-width="1"/>`;
    svg += `<rect x="${x(i) - bodyW / 2}" y="${Math.min(yo, yc)}" width="${bodyW}" height="${Math.max(1, Math.abs(yc - yo))}" fill="${up ? C.bg : col}" stroke="${col}" stroke-width="0.8"/>`;
  });

  // Last price tag
  const ly = y(lastBar.close);
  const tagCol = lastBar.close >= prevClose ? C.up : C.down;
  svg += `<line x1="${padL}" x2="${width - padR}" y1="${ly}" y2="${ly}" stroke="${tagCol}" stroke-dasharray="2,3" stroke-width="0.8"/>`;
  svg += `<rect x="${width - padR + 1}" y="${ly - 7}" width="${padR - 2}" height="14" fill="${tagCol}"/>`;
  svg += `<text x="${width - padR + 5}" y="${ly + 3.5}" font-size="9.5" font-weight="600" fill="#fff">${fmt(lastBar.close)}</text>`;

  // Header (OHLC, volume, SMA legend)
  const d = new Date(lastBar.t * 1000);
  const dl = `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const chg = lastBar.close - prevClose, pct = (chg / prevClose) * 100;
  const cc = chg >= 0 ? C.up : C.down;
  const v = (k, val, col = cc) => `<tspan fill="${C.axis}">${k}</tspan><tspan fill="${col}">${val}</tspan>  `;
  svg += `<text x="${padL + 2}" y="13" font-size="9.5" xml:space="preserve"><tspan fill="#ddd">${dl}</tspan>  ${v('O', fmt(lastBar.open))}${v('H', fmt(lastBar.high))}${v('L', fmt(lastBar.low))}${v('C', fmt(lastBar.close))}${v('Vol ', fmtVol(lastBar.volume))}<tspan fill="${cc}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)} (${pct.toFixed(2)}%)</tspan></text>`;
  const legend = [
    ['SMA 20', s20, C.sma20],
    ['SMA 50', s50, C.sma50],
    ['SMA 200', s200, C.sma200],
  ];
  legend.forEach(([n, s, col], i) => {
    const val = s[s.length - 1];
    svg += `<text x="${padL + 2}" y="${25 + i * 11}" font-size="8.5" fill="${col}">${n} · ${val ? fmt(val) : '—'}</text>`;
  });
  svg += `<rect x="${width / 2 - 140}" y="4" width="40" height="15" fill="none" stroke="#ddd" stroke-width="1"/>`;
  svg += `<text x="${width / 2 - 120}" y="15" font-size="9.5" fill="#fff" text-anchor="middle">Daily</text>`;

  return svg + '</svg>';
}

module.exports = { chartSVG };
