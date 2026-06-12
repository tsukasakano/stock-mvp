#!/usr/bin/env python3
"""Screen Nikkei 225 stocks using technical indicators."""

import json
import os
import sys
from datetime import date

try:
    import pandas as pd
except ImportError:
    print("pandas not found. Run: pip install yfinance pandas --break-system-packages")
    sys.exit(1)

STOCK_NAMES: dict[str, str] = {
    "7203.T": "トヨタ自動車",    "6758.T": "ソニーグループ",  "9984.T": "ソフトバンクG",
    "7974.T": "任天堂",          "9432.T": "NTT",             "6861.T": "キーエンス",
    "8306.T": "三菱UFJ",         "7267.T": "ホンダ",          "6954.T": "ファナック",
    "9433.T": "KDDI",            "4063.T": "信越化学",        "6367.T": "ダイキン工業",
    "8035.T": "東京エレクトロン","7741.T": "HOYA",            "6971.T": "京セラ",
    "4519.T": "中外製薬",        "8316.T": "三井住友FG",      "7751.T": "キヤノン",
    "6902.T": "デンソー",        "9022.T": "東海旅客鉄道",    "4502.T": "武田薬品",
    "6645.T": "オムロン",        "8001.T": "伊藤忠商事",      "7733.T": "オリンパス",
    "6501.T": "日立製作所",      "8411.T": "みずほFG",        "9020.T": "東日本旅客鉄道",
    "4661.T": "オリエンタルランド","6752.T": "パナソニック",   "8058.T": "三菱商事",
    "2914.T": "JT",              "4568.T": "第一三共",        "6503.T": "三菱電機",
    "7832.T": "バンダイナムコ",  "9602.T": "東宝",            "8802.T": "三菱地所",
    "3382.T": "セブン&アイ",     "6201.T": "豊田自動織機",    "7261.T": "マツダ",
    "4543.T": "テルモ",          "8031.T": "三井物産",        "6702.T": "富士通",
    "9021.T": "西日本旅客鉄道",  "8053.T": "住友商事",        "6764.T": "三洋電機",
    "4183.T": "三井化学",        "5401.T": "日本製鉄",        "8766.T": "東京海上HD",
    "6301.T": "コマツ",          "9983.T": "ファーストリテイリング",
}

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data", "historical")
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data", "screening_result.json")


def calc_rsi(closes: pd.Series, period: int = 14) -> float:
    delta = closes.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    val = rsi.iloc[-1]
    return round(float(val), 1) if pd.notna(val) else 50.0


def calc_macd(closes: pd.Series) -> tuple[float, float]:
    ema12 = closes.ewm(span=12, adjust=False).mean()
    ema26 = closes.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    return round(float(macd.iloc[-1]), 2), round(float(signal.iloc[-1]), 2)


def calc_ma(closes: pd.Series, period: int) -> float:
    if len(closes) < period:
        return float(closes.iloc[-1])
    return float(closes.tail(period).mean())


def calc_bb_mid(closes: pd.Series, period: int = 20) -> float:
    return calc_ma(closes, period)


def calc_volume_ratio(volumes: pd.Series, period: int = 20) -> float:
    if len(volumes) < period:
        return 1.0
    avg = float(volumes.tail(period).mean())
    if avg == 0:
        return 1.0
    return round(float(volumes.iloc[-1]) / avg, 2)


if not os.path.isdir(DATA_DIR):
    print(f"Historical data directory not found: {DATA_DIR}")
    print("Run fetch_historical.py first.")
    sys.exit(1)

files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
if not files:
    print("No historical data files found. Run fetch_historical.py first.")
    sys.exit(1)

print(f"Screening {len(files)} stocks ...")

candidates = []

for fname in sorted(files):
    symbol = fname[:-5]  # strip .json
    path = os.path.join(DATA_DIR, fname)

    try:
        with open(path, encoding="utf-8") as f:
            records = json.load(f)
    except Exception as e:
        print(f"  SKIP {symbol}: {e}")
        continue

    if len(records) < 30:
        print(f"  SKIP {symbol}: insufficient data ({len(records)} days)")
        continue

    df = pd.DataFrame(records)
    closes  = df["close"].astype(float)
    volumes = df["volume"].astype(float)

    latest_close = float(closes.iloc[-1])

    rsi              = calc_rsi(closes)
    macd_val, signal = calc_macd(closes)
    ma25             = calc_ma(closes, 25)
    volume_ratio     = calc_volume_ratio(volumes)
    bb_mid           = calc_bb_mid(closes)

    score   = 0
    signals = []

    if rsi < 40:
        score += 1
        signals.append("RSI売られ過ぎ")
    if macd_val > signal:
        score += 1
        signals.append("MACD上昇")
    if latest_close > ma25:
        score += 1
        signals.append("上昇トレンド")
    if volume_ratio > 1.2:
        score += 1
        signals.append("出来高増加")
    if latest_close > bb_mid:
        score += 1
        signals.append("BB中央より上")

    candidates.append({
        "symbol":       symbol,
        "name":         STOCK_NAMES.get(symbol, symbol),
        "score":        score,
        "price":        int(round(latest_close)),
        "rsi":          rsi,
        "macd":         macd_val,
        "volume_ratio": volume_ratio,
        "signals":      signals,
    })

# Sort: score desc, then RSI asc (lower RSI = more oversold = higher priority)
candidates.sort(key=lambda x: (-x["score"], x["rsi"]))
top20 = candidates[:20]

result = {
    "updatedAt":  str(date.today()),
    "candidates": top20,
}

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"\nDone. Top {len(top20)} candidates saved to {OUT_PATH}")
for c in top20:
    print(f"  {c['symbol']:12s} {c['name']:20s}  score={c['score']}  RSI={c['rsi']:.1f}  signals={c['signals']}")
