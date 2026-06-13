import type {
  ChartDataPoint,
  TradeRule,
  RuleCondition,
  RuleIndicator,
  RuleSignal,
  AlertEntry,
} from '@/types/stock';

export const RULES_KEY  = 'stock-trade-rules';
export const ALERTS_KEY = 'stock-trade-alerts';

export const DEFAULT_RULES: TradeRule[] = [
  {
    id: 'preset-rsi-buy',
    name: 'RSI売られ過ぎ買いルール',
    type: 'buy',
    conditions: [{ indicator: 'rsi', operator: '<', value: 30 }],
    logic: 'AND',
    enabled: true,
  },
  {
    id: 'preset-gc',
    name: 'ゴールデンクロス買いルール',
    type: 'buy',
    // ma5 crossover value=25 → MA5がMA25を上抜け
    conditions: [{ indicator: 'ma5', operator: 'crossover', value: 25 }],
    logic: 'AND',
    enabled: true,
  },
  {
    id: 'preset-rsi-sell',
    name: 'RSI買われ過ぎ売りルール',
    type: 'sell',
    conditions: [{ indicator: 'rsi', operator: '>', value: 70 }],
    logic: 'AND',
    enabled: true,
  },
  {
    id: 'preset-bb-reversal',
    name: 'BBバンド下限割れ逆張り',
    type: 'buy',
    conditions: [
      { indicator: 'price', operator: '<', value: 0, compareIndicator: 'bbLower' },
      { indicator: 'rsi',   operator: '<', value: 40 },
    ],
    logic: 'AND',
    enabled: true,
  },
  {
    id: 'preset-trend-follow',
    name: 'トレンドフォロー複合',
    type: 'buy',
    conditions: [
      { indicator: 'ma5',    operator: '>',  value: 0,  compareIndicator: 'ma25' },
      { indicator: 'rsi',    operator: '>=', value: 40 },
      { indicator: 'rsi',    operator: '<=', value: 60 },
      { indicator: 'volume', operator: '>',  value: 0,  compareIndicator: 'volumeMA' },
    ],
    logic: 'AND',
    enabled: true,
  },
  {
    id: 'preset-ai-rsi-enhanced',
    name: 'AI提案強化版RSIルール',
    type: 'buy',
    conditions: [
      { indicator: 'rsi',            operator: '<',  value: 30  },
      { indicator: 'rsiDivergence',  operator: '>=', value: 1   },
      { indicator: 'priceVsMA20',    operator: '<',  value: 1.0 },
      { indicator: 'volumeRatio',    operator: '>',  value: 1.5 },
    ],
    logic: 'AND',
    enabled: true,
  },
  {
    id: 'preset-ai-rsi-relaxed',
    name: 'AI提案緩和版RSIルール',
    type: 'buy',
    conditions: [
      { indicator: 'rsi',            operator: '<',  value: 30   },
      { indicator: 'rsiDivergence',  operator: '>=', value: 1    },
      { indicator: 'priceVsMA20',    operator: '<',  value: 1.05 },
      { indicator: 'volumeRatio',    operator: '>',  value: 1.2  },
    ],
    logic: 'AND',
    enabled: true,
  },
  {
    id: 'preset-ai-rsi-strict',
    name: 'AI提案厳格化版RSIルール',
    type: 'buy',
    conditions: [
      { indicator: 'rsi',            operator: '<',  value: 25   },
      { indicator: 'rsiDivergence',  operator: '>=', value: 2    },
      { indicator: 'volumeRatio',    operator: '>',  value: 2.0  },
      { indicator: 'priceVsMA20',    operator: '<',  value: 0.98 },
    ],
    logic: 'AND',
    enabled: true,
  },
  {
    id: 'preset-sell-trend-reversal',
    name: 'トレンド転換売りルール',
    type: 'sell',
    conditions: [
      { indicator: 'rsi',         operator: '>',  value: 70 },
      { indicator: 'macd',        operator: '<',  value: 0,  compareIndicator: 'signal' },
      { indicator: 'macd',        operator: '<',  value: 0  },
      { indicator: 'priceVsMA20', operator: '>',  value: 1.1 },
    ],
    logic: 'OR',
    enabled: true,
  },
  {
    id: 'preset-sell-profit-take',
    name: '利益確定売りルール',
    type: 'sell',
    conditions: [
      { indicator: 'rsi',  operator: '>',  value: 65 },
      { indicator: 'macd', operator: '<',  value: 0,  compareIndicator: 'signal' },
    ],
    logic: 'AND',
    enabled: true,
  },
  {
    id: 'preset-sell-bearish',
    name: '弱気転換売りルール',
    type: 'sell',
    conditions: [
      { indicator: 'rsiDivergence', operator: '>=', value: 1    },
      { indicator: 'volumeRatio',   operator: '>',  value: 1.5  },
      { indicator: 'priceVsMA20',   operator: '>',  value: 1.05 },
    ],
    logic: 'AND',
    enabled: true,
  },
];

// ─── ストレージ ───────────────────────────────────────────

export function loadRules(): TradeRule[] {
  if (typeof window === 'undefined') return DEFAULT_RULES;
  try {
    const saved = localStorage.getItem(RULES_KEY);
    if (saved) return JSON.parse(saved) as TradeRule[];
  } catch { /* ignore */ }
  return DEFAULT_RULES;
}

export function saveRules(rules: TradeRule[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(RULES_KEY, JSON.stringify(rules));
  }
}

export function loadAlerts(): AlertEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(ALERTS_KEY);
    if (saved) return JSON.parse(saved) as AlertEntry[];
  } catch { /* ignore */ }
  return [];
}

export function saveAlerts(alerts: AlertEntry[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  }
}

// ─── 評価エンジン ─────────────────────────────────────────

function sma(data: ChartDataPoint[], period: number, idx: number): number | undefined {
  if (idx < period - 1) return undefined;
  const slice = data.slice(idx - period + 1, idx + 1);
  return slice.reduce((s, d) => s + d.close, 0) / period;
}

function volumeSMA(data: ChartDataPoint[], period: number, idx: number): number | undefined {
  if (idx < period - 1) return undefined;
  const slice = data.slice(idx - period + 1, idx + 1);
  return slice.reduce((s, d) => s + d.volume, 0) / period;
}

function indicatorValue(
  indicator: RuleIndicator,
  data: ChartDataPoint[],
  idx: number,
): number | undefined {
  const d = data[idx];
  if (!d) return undefined;
  switch (indicator) {
    case 'rsi':      return d.rsi;
    case 'macd':     return d.macd;
    case 'signal':   return d.signal;
    case 'price':    return d.close;
    case 'volume':   return d.volume;
    case 'ma5':      return sma(data, 5, idx);
    case 'ma25':     return sma(data, 25, idx);
    case 'bbUpper':  return d.upperBand;
    case 'bbLower':  return d.lowerBand;
    case 'bbMid':    return d.middleBand;
    case 'bbWidth': {
      const u = d.upperBand, l = d.lowerBand;
      return u !== undefined && l !== undefined ? u - l : undefined;
    }
    case 'volumeMA': return volumeSMA(data, 20, idx);
    case 'rsiDivergence': {
      if (idx < 4) return undefined;
      const rsiCur  = data[idx].rsi;
      const rsiPrev = data[idx - 4].rsi;
      if (rsiCur === undefined || rsiPrev === undefined) return undefined;
      // 直近5日で価格下落 かつ RSI上昇 → ダイバージェンス = 1
      return data[idx].close < data[idx - 4].close && rsiCur > rsiPrev ? 1 : 0;
    }
    case 'priceVsMA20': {
      const ma20 = sma(data, 20, idx);
      return ma20 !== undefined && ma20 > 0 ? d.close / ma20 : undefined;
    }
    case 'volumeRatio': {
      const vma = volumeSMA(data, 20, idx);
      return vma !== undefined && vma > 0 ? d.volume / vma : undefined;
    }
    default:         return undefined;
  }
}

function evalCondition(
  cond: RuleCondition,
  data: ChartDataPoint[],
  curIdx: number,
): boolean {
  const cur = indicatorValue(cond.indicator, data, curIdx);
  if (cur === undefined) return false;

  if (cond.operator === 'crossover' || cond.operator === 'crossunder') {
    const prev = indicatorValue(cond.indicator, data, curIdx - 1);
    if (prev === undefined) return false;

    let thrCur: number | undefined;
    let thrPrev: number | undefined;

    if (cond.compareIndicator) {
      thrCur  = indicatorValue(cond.compareIndicator, data, curIdx);
      thrPrev = indicatorValue(cond.compareIndicator, data, curIdx - 1);
    } else {
      thrCur = thrPrev = cond.value;
      // 後方互換: ma5 crossover value=25 → MA5がMA25を上抜け
      if (cond.indicator === 'ma5' && cond.value === 25) {
        thrCur  = sma(data, 25, curIdx);
        thrPrev = sma(data, 25, curIdx - 1);
      }
    }

    if (thrCur === undefined || thrPrev === undefined) return false;

    return cond.operator === 'crossover'
      ? prev <= thrPrev && cur > thrCur
      : prev >= thrPrev && cur < thrCur;
  }

  const threshold = cond.compareIndicator
    ? indicatorValue(cond.compareIndicator, data, curIdx)
    : cond.value;
  if (threshold === undefined) return false;

  switch (cond.operator) {
    case '>':  return cur > threshold;
    case '<':  return cur < threshold;
    case '>=': return cur >= threshold;
    case '<=': return cur <= threshold;
    default:   return false;
  }
}

export function evaluateRules(
  rules: TradeRule[],
  data: ChartDataPoint[],
): RuleSignal[] {
  const curIdx = data.length - 1;
  if (curIdx < 1) {
    return rules.map(r => ({ ruleId: r.id, ruleName: r.name, type: r.type, triggered: false }));
  }

  return rules.map(rule => {
    if (!rule.enabled || rule.conditions.length === 0) {
      return { ruleId: rule.id, ruleName: rule.name, type: rule.type, triggered: false };
    }
    const results = rule.conditions.map(c => evalCondition(c, data, curIdx));
    const triggered = rule.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
    return { ruleId: rule.id, ruleName: rule.name, type: rule.type, triggered };
  });
}

// ─── ブラウザ通知 ─────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function sendNotification(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/next.svg' });
}
