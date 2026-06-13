#!/usr/bin/env python3
"""Fetch 5-year daily OHLCV data for Nikkei 225 (^N225) via yfinance.

負荷軽減ポリシー（fetch_historical.py と同様）:
- 当日取得済みのファイルはスキップ
- エラー時は3回までリトライ（5秒待機）
- 30秒タイムアウト
"""

import json
import os
import sys
import time
from datetime import date

try:
    import yfinance as yf
except ImportError:
    print("yfinance not found. Run: pip install yfinance pandas --break-system-packages")
    sys.exit(1)

SYMBOL = "^N225"
OUT_FILE = os.path.join(
    os.path.dirname(__file__), "..", "public", "data", "historical", "N225.json"
)

TODAY = date.today().isoformat()
MAX_RETRIES = 3
RETRY_WAIT = 5


def is_today_cached() -> bool:
    if not os.path.exists(OUT_FILE):
        return False
    try:
        with open(OUT_FILE, "r", encoding="utf-8") as f:
            records = json.load(f)
        if not records:
            return False
        return records[-1].get("date", "") >= TODAY
    except Exception:
        return False


def fetch_with_retry() -> list | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            ticker = yf.Ticker(SYMBOL)
            hist = ticker.history(period="5y", timeout=30)
            if hist.empty:
                return None

            records = []
            for dt, row in hist.iterrows():
                records.append({
                    "date":   dt.strftime("%Y-%m-%d"),
                    "open":   int(round(float(row["Open"]))),
                    "high":   int(round(float(row["High"]))),
                    "low":    int(round(float(row["Low"]))),
                    "close":  int(round(float(row["Close"]))),
                    "volume": int(row["Volume"]),
                })
            return records

        except Exception as e:
            if attempt < MAX_RETRIES:
                print(f"  リトライ {attempt}/{MAX_RETRIES} ({e}) → {RETRY_WAIT}秒待機...", flush=True)
                time.sleep(RETRY_WAIT)
            else:
                raise


if is_today_cached():
    print(f"{SYMBOL} CACHED (本日取得済み) → {OUT_FILE}")
    sys.exit(0)

print(f"{SYMBOL} 取得中...", end=" ", flush=True)

try:
    records = fetch_with_retry()
    if records is None:
        print("SKIP (データなし)")
        sys.exit(1)

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f)
    print(f"OK ({len(records)}日分) → {OUT_FILE}")

except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
