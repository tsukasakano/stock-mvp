import type { StockData } from '@/types/stock';

export type MarketTrend = 'bull' | 'bear' | 'neutral';

export type MarketCondition = {
  date: string;
  close: number;
  trend: MarketTrend;
  ma25: number;
  ma75: number;
  rsi: number;
  signal: 'buy_enabled' | 'buy_disabled' | 'neutral';
};

function sma(data: StockData[], period: number, idx: number): number {
  if (idx < period - 1) return 0;
  return data.slice(idx - period + 1, idx + 1).reduce((s, d) => s + d.close, 0) / period;
}

function calcRSI(data: StockData[], period: number, idx: number): number {
  if (idx < period) return 50;
  let gains = 0, losses = 0;
  for (let i = idx - period + 1; i <= idx; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gains += diff;
    else losses += -diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function classifyTrend(ma25: number, ma75: number, rsi: number): MarketTrend {
  if (ma25 > 0 && ma75 > 0) {
    if (ma25 > ma75 && rsi > 50) return 'bull';
    if (ma25 < ma75 && rsi < 50) return 'bear';
  }
  return 'neutral';
}

export function buildMarketConditionMap(data: StockData[]): Map<string, MarketCondition> {
  const map = new Map<string, MarketCondition>();
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const ma25v = sma(data, 25, i);
    const ma75v = sma(data, 75, i);
    const rsiv  = calcRSI(data, 14, i);
    const trend = i >= 75 ? classifyTrend(ma25v, ma75v, rsiv) : 'neutral';
    const signal: MarketCondition['signal'] =
      trend === 'bull' ? 'buy_enabled'
      : trend === 'bear' ? 'buy_disabled'
      : 'neutral';
    map.set(d.date, {
      date:   d.date,
      close:  d.close,
      trend,
      ma25:   Math.round(ma25v),
      ma75:   Math.round(ma75v),
      rsi:    parseFloat(rsiv.toFixed(1)),
      signal,
    });
  }
  return map;
}

export function getLatestCondition(map: Map<string, MarketCondition>): MarketCondition | null {
  if (map.size === 0) return null;
  const keys = [...map.keys()].sort();
  return map.get(keys[keys.length - 1]) ?? null;
}

export function getConditionOnOrBefore(
  date: string,
  map: Map<string, MarketCondition>,
): MarketCondition | null {
  const sorted = [...map.keys()].sort();
  // binary-search for last entry <= date
  let lo = 0, hi = sorted.length - 1, result: string | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= date) { result = sorted[mid]; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result ? (map.get(result) ?? null) : null;
}
