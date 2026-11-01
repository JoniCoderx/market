#!/usr/bin/env node
// Usage: node src/build.js [YYYY-MM] [TICKER ...]
// Renders output/<month>/<TICKER>.png for every stock in data/<month>.json.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { analyze } = require('./indicators');
const { chartSVG } = require('./chart');
const { card } = require('./card');

const ROOT = path.join(__dirname, '..');

async function fetchBars(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${ticker}: price download failed (${res.status})`);
  const r = (await res.json()).chart.result[0];
  const q = r.indicators.quote[0];
  return r.timestamp
    .map((t, i) => ({ t, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] }))
    .filter((b) => b.close != null && b.open != null);
}

function validate(ticker, m) {
  const errs = [];
  const num = (v, k) => (typeof v === 'number' && isFinite(v)) || errs.push(`${k} must be a number`);
  if (!m) return [`no entry in the month file`];
  num(m.fairValue?.average, 'fairValue.average'); num(m.fairValue?.low, 'fairValue.low'); num(m.fairValue?.high, 'fairValue.high');
  if (!m.fairValue?.uncertainty) errs.push('fairValue.uncertainty missing');
  num(m.analystTargets?.average, 'analystTargets.average'); num(m.analystTargets?.low, 'analystTargets.low'); num(m.analystTargets?.high, 'analystTargets.high');
  if (!Array.isArray(m.tips) || m.tips.length === 0) errs.push('tips missing');
  return errs.map((e) => `${ticker}: ${e}`);
}

async function main() {
  const now = new Date();
  const monthArg = process.argv[2] && /^\d{4}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const only = process.argv.slice(2).filter((a) => !/^\d{4}-\d{2}$/.test(a)).map((a) => a.toUpperCase());
  const stocks = JSON.parse(fs.readFileSync(path.join(ROOT, 'stocks.json'), 'utf8'));
  const monthFile = path.join(ROOT, 'data', `${monthArg}.json`);
  if (!fs.existsSync(monthFile)) throw new Error(`Missing ${path.relative(ROOT, monthFile)} — copy last month's file and update the InvestingPro numbers.`);
  const monthData = JSON.parse(fs.readFileSync(monthFile, 'utf8'));
  const outDir = path.join(ROOT, 'output', monthArg);
  fs.mkdirSync(outDir, { recursive: true });

  const list = stocks.filter((s) => !only.length || only.includes(s.ticker));
  const errors = list.flatMap((s) => validate(s.ticker, monthData[s.ticker]));
  if (errors.length) throw new Error('Fix the month file first:\n  ' + errors.join('\n  '));

  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets/logo.png')).toString('base64');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1450, height: 1050 } });
  const report = {};
  for (const stock of list) {
    const bars = await fetchBars(stock.quoteSymbol || stock.ticker);
    const year = bars.slice(-252);
    const market = {
      price: bars[bars.length - 1].close,
      low52: Math.min(...year.map((b) => b.low)),
      high52: Math.max(...year.map((b) => b.high)),
      asOf: new Date(bars[bars.length - 1].t * 1000).toISOString().slice(0, 10),
    };
    market.asOfLabel = new Date(market.asOf + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const [yy, mm] = monthArg.split('-').map(Number);
    const monthLabel = new Date(Date.UTC(yy, mm - 1, 15)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const signals = analyze(bars);
    const html = card({ stock, month: monthData[stock.ticker], market, signals, logo, chart: chartSVG(bars), monthLabel });
    const htmlPath = path.join(outDir, `${stock.ticker}.html`);
    fs.writeFileSync(htmlPath, html);
    await page.goto('file://' + htmlPath);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(outDir, `${stock.ticker}.png`) });
    fs.unlinkSync(htmlPath);
    report[stock.ticker] = {
      market,
      summary: signals.summary,
      technical: { label: signals.technical.label, buy: signals.technical.buy, sell: signals.technical.sell, items: signals.technical.items },
      movingAverages: { label: signals.movingAverages.label, buy: signals.movingAverages.buy, sell: signals.movingAverages.sell, items: signals.movingAverages.items },
    };
    console.log(`${stock.ticker.padEnd(6)} $${market.price.toFixed(2)}  ${signals.summary.label.padEnd(11)} TI ${signals.technical.buy}/${signals.technical.sell}  MA ${signals.movingAverages.buy}/${signals.movingAverages.sell}`);
  }
  fs.writeFileSync(path.join(outDir, 'signals.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(`\nSaved to ${path.relative(ROOT, outDir)}/`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
