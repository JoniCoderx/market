# SSCI Monthly Signals

Builds the monthly signal cards for ssci.group/monthly-sigals: one 1450×1050 PNG per stock, in the same layout as the Photoshop templates.

## Each month (about 5 minutes)

1. Copy last month's data file, for example `data/2026-11.json` → `data/2026-12.json`.
2. For each stock, update the values from **InvestingPro**:
   - `fairValue`: average, low, high, uncertainty (LOW / MED / HIGH)
   - `analystTargets`: average, low, high
   - `tips`: the ProTips, each with `tone` set to `good` (green), `bad` (red) or `neutral` (grey)
3. Run:
   ```bash
   npm install
   npx playwright install chromium
   npm run build -- 2026-12
   ```
4. The cards are written to `output/2026-12/<TICKER>.png`.

### Optional: use Investing.com's exact technical numbers

On Investing.com, open the stock's **Technical** tab, select **Daily**, and copy the numbers into the stock's entry:

```json
"technicals": {
  "summary": "Strong Buy",
  "technical": { "label": "Strong Buy", "buy": 9, "sell": 0 },
  "movingAverages": { "label": "Strong Buy", "buy": 11, "sell": 1 }
}
```

Leave it out and the card uses its own calculation, which usually matches.

### Optional: 52-week range

If the Market Range on the card doesn't match InvestingPro (it can happen after a spin-off or similar event, because the price source adjusts older prices), add `"marketRange": { "low": 249.83, "high": 404.03 }` to that stock.

## What is automatic

| On the card | Source |
|---|---|
| Price chart (candles, SMA 20/50/200, volume) | Daily prices (Yahoo Finance), drawn by `src/chart.js` |
| Market Range (price, 52-week low/high) | Daily prices |
| Technical Indicators / Moving Averages: rating and Buy/Sell counts | Computed in `src/indicators.js` with the same 12 oscillators and 12 moving averages Investing.com lists. The method differs from Investing.com's, so counts can be off by one or two. Details for every indicator are in `output/<month>/signals.json`. |
| Summary and gauge | Combination of the two ratings above |
| Upside / Downside % | Fair value average vs. the current price |

## What changes rarely

`stocks.json` holds each company's name, sector and **Financial Health** scores (overall + 5 factors). Edit it when InvestingPro's health scores change.

To add a stock, add it to `stocks.json` and give it an entry in the month file.
