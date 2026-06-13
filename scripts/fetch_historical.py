#!/usr/bin/env python3
"""Fetch 5-year daily OHLCV data for Nikkei 225 stocks via yfinance.

負荷軽減ポリシー:
- 1銘柄ずつ順番に取得
- リクエスト間に2〜3秒のランダム待機
- 当日取得済みのファイルはスキップ
- エラー時は3回までリトライ（5秒待機）
- 30秒タイムアウト
"""

import json
import os
import sys
import time
import random
from datetime import datetime, date

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

TODAY = date.today().isoformat()
MAX_RETRIES = 3
RETRY_WAIT = 5      # seconds between retries
MIN_WAIT = 2.0      # min seconds between successful requests
MAX_WAIT = 3.0      # max seconds between successful requests

total = len(SYMBOLS)
ok_count = 0
skip_count = 0
cached_count = 0


def is_today_cached(out_path: str) -> bool:
    """Return True if the file exists and its last record is from today."""
    if not os.path.exists(out_path):
        return False
    try:
        with open(out_path, "r", encoding="utf-8") as f:
            records = json.load(f)
        if not records:
            return False
        last_date = records[-1].get("date", "")
        return last_date >= TODAY
    except Exception:
        return False


def fetch_with_retry(symbol: str) -> list | None:
    """Fetch history for a symbol with up to MAX_RETRIES attempts."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            ticker = yf.Ticker(symbol)
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


for i, symbol in enumerate(SYMBOLS):
    pct = (i + 1) / total * 100
    out_path = os.path.join(OUT_DIR, f"{symbol}.json")

    # 当日取得済みならスキップ
    if is_today_cached(out_path):
        print(f"[{pct:5.1f}%] {symbol} CACHED (本日取得済み)")
        cached_count += 1
        continue

    print(f"[{pct:5.1f}%] {symbol} 取得中...", end=" ", flush=True)

    try:
        records = fetch_with_retry(symbol)

        if records is None:
            print("SKIP (データなし)")
            skip_count += 1
        else:
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(records, f)
            print(f"OK ({len(records)}日分)")
            ok_count += 1

            # 次のリクエストまでランダム待機（当日取得済みスキップ時は待機しない）
            wait = random.uniform(MIN_WAIT, MAX_WAIT)
            time.sleep(wait)

    except Exception as e:
        print(f"ERROR: {e}")
        skip_count += 1
        # エラー後も少し待機
        time.sleep(RETRY_WAIT)

print(f"\n完了: 新規取得={ok_count}, キャッシュ済={cached_count}, スキップ={skip_count}")
