// Technical signals computed from daily OHLC bars.
// Mirrors the indicator set Investing.com shows on its "Technical" tab
// (12 oscillators + 12 moving averages). Values are computed independently,
// so counts can differ by one or two from Investing.com's page.

const sma = (arr, n) => arr.map((_, i) => (i < n - 1 ? null : arr.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n));

function ema(arr, n) {
  const k = 2 / (n + 1);
  const out = [];
  let prev = null;
  arr.forEach((v, i) => {
    if (i < n - 1) return out.push(null);
    if (prev === null) prev = arr.slice(0, n).reduce((a, b) => a + b, 0) / n;
    else prev = v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

// Wilder smoothing
function wilder(arr, n) {
  const out = [];
  let prev = null;
  arr.forEach((v, i) => {
    if (i < n - 1) return out.push(null);
    if (prev === null) prev = arr.slice(0, n).reduce((a, b) => a + b, 0) / n;
    else prev = (prev * (n - 1) + v) / n;
    out.push(prev);
  });
  return out;
}

const last = (a) => a[a.length - 1];

function rsiSeries(close, n = 14) {
  const gains = [0], losses = [0];
  for (let i = 1; i < close.length; i++) {
    const d = close[i] - close[i - 1];
    gains.push(Math.max(d, 0));
    losses.push(Math.max(-d, 0));
  }
  const ag = wilder(gains.slice(1), n), al = wilder(losses.slice(1), n);
  return [null, ...ag.map((g, i) => (g === null ? null : al[i] === 0 ? 100 : 100 - 100 / (1 + g / al[i])))];
}

function classify(value, { buy, sell, overbought, oversold }) {
  if (overbought !== undefined && value >= overbought) return 'Overbought';
  if (oversold !== undefined && value <= oversold) return 'Oversold';
  if (value > buy) return 'Buy';
  if (value < sell) return 'Sell';
  return 'Neutral';
}

function technicalIndicators(bars) {
  const H = bars.map((b) => b.high), L = bars.map((b) => b.low), C = bars.map((b) => b.close);
  const price = last(C);
  const out = [];

  // RSI(14)
  const rsi = rsiSeries(C, 14);
  out.push({ name: 'RSI(14)', value: last(rsi), signal: classify(last(rsi), { buy: 50, sell: 50, overbought: 70, oversold: 30 }) });

  // STOCH(9,6): %K over 9 periods, %D = SMA6 of %K
  const k = C.map((c, i) => {
    if (i < 8) return null;
    const hh = Math.max(...H.slice(i - 8, i + 1)), ll = Math.min(...L.slice(i - 8, i + 1));
    return hh === ll ? 50 : ((c - ll) / (hh - ll)) * 100;
  });
  const d = sma(k.map((v) => v ?? 0), 6);
  out.push({ name: 'STOCH(9,6)', value: last(d), signal: classify(last(d), { buy: 50, sell: 50, overbought: 80, oversold: 20 }) });

  // STOCHRSI(14)
  const r = rsi.slice(15);
  const srsi = r.map((v, i) => {
    if (i < 13) return null;
    const w = r.slice(i - 13, i + 1);
    const hh = Math.max(...w), ll = Math.min(...w);
    return hh === ll ? 50 : ((v - ll) / (hh - ll)) * 100;
  });
  out.push({ name: 'STOCHRSI(14)', value: last(srsi), signal: classify(last(srsi), { buy: 50, sell: 50, overbought: 80, oversold: 20 }) });

  // MACD(12,26)
  const e12 = ema(C, 12), e26 = ema(C, 26);
  const macd = last(e12) - last(e26);
  out.push({ name: 'MACD(12,26)', value: macd, signal: macd > 0 ? 'Buy' : 'Sell' });

  // ADX(14) with +DI / -DI
  const tr = [], pdm = [], ndm = [];
  for (let i = 1; i < bars.length; i++) {
    tr.push(Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1])));
    const up = H[i] - H[i - 1], dn = L[i - 1] - L[i];
    pdm.push(up > dn && up > 0 ? up : 0);
    ndm.push(dn > up && dn > 0 ? dn : 0);
  }
  const atr = wilder(tr, 14), sp = wilder(pdm, 14), sn = wilder(ndm, 14);
  const pdi = sp.map((v, i) => (v === null ? null : (100 * v) / atr[i]));
  const ndi = sn.map((v, i) => (v === null ? null : (100 * v) / atr[i]));
  const dx = pdi.map((v, i) => (v === null ? null : (100 * Math.abs(v - ndi[i])) / (v + ndi[i] || 1))).filter((v) => v !== null);
  const adx = last(wilder(dx, 14));
  out.push({ name: 'ADX(14)', value: adx, signal: adx < 20 ? 'Neutral' : last(pdi) > last(ndi) ? 'Buy' : 'Sell' });

  // Williams %R(14)
  const hh14 = Math.max(...H.slice(-14)), ll14 = Math.min(...L.slice(-14));
  const wr = hh14 === ll14 ? -50 : ((hh14 - price) / (hh14 - ll14)) * -100;
  out.push({ name: 'Williams %R', value: wr, signal: classify(wr, { buy: -50, sell: -50, overbought: -20, oversold: -80 }) });

  // CCI(14)
  const tp = bars.map((b) => (b.high + b.low + b.close) / 3);
  const tpw = tp.slice(-14), tpm = tpw.reduce((a, b) => a + b, 0) / 14;
  const md = tpw.reduce((a, b) => a + Math.abs(b - tpm), 0) / 14;
  const cci = (last(tp) - tpm) / (0.015 * md);
  out.push({ name: 'CCI(14)', value: cci, signal: classify(cci, { buy: 50, sell: -50, overbought: 200, oversold: -200 }) });

  // ATR(14) — volatility, not directional (shown, not counted)
  out.push({ name: 'ATR(14)', value: last(atr), signal: 'Neutral', counted: false });

  // Highs/Lows(14): price vs the 14-day midpoint
  const mid = (hh14 + ll14) / 2;
  out.push({ name: 'Highs/Lows(14)', value: price - mid, signal: price > mid ? 'Buy' : price < mid ? 'Sell' : 'Neutral' });

  // Ultimate Oscillator(7,14,28)
  const bp = [], trr = [];
  for (let i = 1; i < bars.length; i++) {
    const lo = Math.min(L[i], C[i - 1]), hi = Math.max(H[i], C[i - 1]);
    bp.push(C[i] - lo);
    trr.push(hi - lo);
  }
  const avg = (n) => bp.slice(-n).reduce((a, b) => a + b, 0) / trr.slice(-n).reduce((a, b) => a + b, 0);
  const uo = (100 * (4 * avg(7) + 2 * avg(14) + avg(28))) / 7;
  out.push({ name: 'Ultimate Oscillator', value: uo, signal: classify(uo, { buy: 50, sell: 50, overbought: 70, oversold: 30 }) });

  // ROC(12)
  const roc = ((price - C[C.length - 13]) / C[C.length - 13]) * 100;
  out.push({ name: 'ROC', value: roc, signal: roc > 0 ? 'Buy' : 'Sell' });

  // Bull/Bear Power(13)
  const e13 = last(ema(C, 13));
  const bbp = last(H) - e13 + (last(L) - e13);
  out.push({ name: 'Bull/Bear Power(13)', value: bbp, signal: bbp > 0 ? 'Buy' : 'Sell' });

  return out;
}

function movingAverages(bars) {
  const C = bars.map((b) => b.close);
  const price = last(C);
  const out = [];
  for (const n of [5, 10, 20, 50, 100, 200]) {
    const s = last(sma(C, n)), e = last(ema(C, n));
    out.push({ name: `MA${n} Simple`, value: s, signal: price > s ? 'Buy' : 'Sell' });
    out.push({ name: `MA${n} Exponential`, value: e, signal: price > e ? 'Buy' : 'Sell' });
  }
  return out;
}

// Turns a buy/sell tally into a rating + a score in [-1, 1] for the gauge.
function rate(items) {
  const counted = items.filter((i) => i.counted !== false);
  const buy = counted.filter((i) => i.signal === 'Buy').length;
  const sell = counted.filter((i) => i.signal === 'Sell').length;
  const score = (buy - sell) / counted.length;
  return { buy, sell, score, label: labelFor(score) };
}

function labelFor(score) {
  if (score >= 0.5) return 'Strong Buy';
  if (score >= 0.15) return 'Buy';
  if (score <= -0.5) return 'Strong Sell';
  if (score <= -0.15) return 'Sell';
  return 'Neutral';
}

function analyze(bars) {
  const ti = technicalIndicators(bars);
  const ma = movingAverages(bars);
  const tiR = rate(ti), maR = rate(ma);
  const score = (tiR.score + maR.score) / 2;
  return { technical: { ...tiR, items: ti }, movingAverages: { ...maR, items: ma }, summary: { score, label: labelFor(score) } };
}

module.exports = { analyze, sma, labelFor };
