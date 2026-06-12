#!/usr/bin/env python3
"""Fetch 5-year daily OHLCV data for Nikkei 225 stocks via yfinance."""

import json
import os
import sys

try:
    import yfinance as yf
except ImportError:
    print("yfinance not found. Run: pip install yfinance pandas --break-system-packages")
    sys.exit(1)

SYMBOLS = [
    "7203.T", "6758.T", "9984.T", "7974.T", "9432.T", "6861.T",
    "8306.T", "7267.T", "6954.T", "9433.T", "4063.T", "6367.T",
    "8035.T", "7741.T", "6971.T", "4519.T", "8316.T", "7751.T",
    "6902.T", "9022.T", "4502.T", "6645.T", "8001.T", "7733.T",
    "6501.T", "8411.T", "9020.T", "4661.T", "6752.T", "8058.T",
    "2914.T", "4568.T", "6503.T", "7832.T", "9602.T", "8802.T",
    "3382.T", "6201.T", "7261.T", "4543.T", "8031.T", "6702.T",
    "9021.T", "8053.T", "6764.T", "4183.T", "5401.T", "8766.T",
    "6301.T", "9983.T",
]

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data", "historical")
os.makedirs(OUT_DIR, exist_ok=True)

total = len(SYMBOLS)
ok_count = 0
skip_count = 0

for i, symbol in enumerate(SYMBOLS):
    pct = (i + 1) / total * 100
    print(f"[{pct:5.1f}%] {symbol} ...", end=" ", flush=True)
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="5y")
        if hist.empty:
            print("SKIP (no data)")
            skip_count += 1
            continue

        records = []
        for dt, row in hist.iterrows():
            records.append({
                "date":   dt.strftime("%Y-%m-%d"),
                "open":   int(round(row["Open"])),
                "high":   int(round(row["High"])),
                "low":    int(round(row["Low"])),
                "close":  int(round(row["Close"])),
                "volume": int(row["Volume"]),
            })

        out_path = os.path.join(OUT_DIR, f"{symbol}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(records, f)

        print(f"OK ({len(records)} days)")
        ok_count += 1

    except Exception as e:
        print(f"ERROR: {e}")
        skip_count += 1

print(f"\nDone. success={ok_count}, skipped={skip_count}")
