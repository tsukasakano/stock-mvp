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

function indicatorValue(
  indicator: RuleIndicator,
  data: ChartDataPoint[],
  idx: number,
): number | undefined {
  const d = data[idx];
  if (!d) return undefined;
  switch (indicator) {
    case 'rsi':    return d.rsi;
    case 'macd':   return d.macd;
    case 'price':  return d.close;
    case 'volume': return d.volume;
    case 'ma5':    return sma(data, 5, idx);
    case 'ma25':   return sma(data, 25, idx);
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

    // ma5 crossover 25 → MA5がMA25を上抜け / 下抜け
    let thrCur = cond.value;
    let thrPrev = cond.value;
    if (cond.indicator === 'ma5' && cond.value === 25) {
      const mc = sma(data, 25, curIdx);
      const mp = sma(data, 25, curIdx - 1);
      if (mc === undefined || mp === undefined) return false;
      thrCur = mc;
      thrPrev = mp;
    }

    return cond.operator === 'crossover'
      ? prev <= thrPrev && cur > thrCur
      : prev >= thrPrev && cur < thrCur;
  }

  switch (cond.operator) {
    case '>':  return cur > cond.value;
    case '<':  return cur < cond.value;
    case '>=': return cur >= cond.value;
    case '<=': return cur <= cond.value;
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
