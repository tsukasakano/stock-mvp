import type { ChartDataPoint, TradeRule, RuleCondition, RuleIndicator } from '@/types/stock';
import type { MarketTrend } from '@/lib/marketFilter';

export type BacktestConfig = {
  rule: TradeRule;
  startDate: string;
  endDate: string;
  initialCapital: number;
  positionSize: number;
  takeProfit?: number;      // 利益確定ライン (e.g. 0.05 = +5%)
  trailingStop?: number;    // トレイリングストップ (e.g. 0.03 = 高値から-3%)
  maxHoldDays?: number;     // 最大保有日数
  sellRuleId?: string;      // 明示的に使用する売りルールID
  commissionRate?: number;  // 手数料率 (e.g. 0.001 = 0.1%)
  slippage?: number;        // スリッページ (e.g. 0.001 = 0.1%)
  useMarketFilter?: boolean;
  marketConditions?: Map<string, MarketTrend>;
};

export type ExitReason =
  | 'takeProfit'
  | 'trailingStop'
  | 'maxHoldDays'
  | 'ruleExit'
  | 'periodEnd';

export type BacktestTrade = {
  date: string;
  type: 'buy' | 'sell';
  price: number;
  shares: number;
  capital: number;
  pnl: number;
  exitReason?: ExitReason;
};

export type BacktestResult = {
  trades: BacktestTrade[];
  finalCapital: number;
  totalReturn: number;
  totalReturnPct: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  totalCost: number;
  marketFilteredCount: number;
  equityCurve: { date: string; capital: number }[];
  exitReasons: {
    ruleExit: number;
    takeProfit: number;
    trailingStop: number;
    maxHoldDays: number;
  };
};

// ─── Indicator helpers (mirrors ruleEngine.ts logic) ─────────────────────────

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

function evalConditionAt(
  cond: RuleCondition,
  data: ChartDataPoint[],
  idx: number,
): boolean {
  if (idx < 1) return false;
  const cur = indicatorValue(cond.indicator, data, idx);
  if (cur === undefined) return false;

  if (cond.operator === 'crossover' || cond.operator === 'crossunder') {
    const prev = indicatorValue(cond.indicator, data, idx - 1);
    if (prev === undefined) return false;

    let thrCur: number | undefined;
    let thrPrev: number | undefined;

    if (cond.compareIndicator) {
      thrCur  = indicatorValue(cond.compareIndicator, data, idx);
      thrPrev = indicatorValue(cond.compareIndicator, data, idx - 1);
    } else {
      thrCur = thrPrev = cond.value;
      // 後方互換: ma5 crossover value=25 → MA5がMA25を上抜け
      if (cond.indicator === 'ma5' && cond.value === 25) {
        thrCur  = sma(data, 25, idx);
        thrPrev = sma(data, 25, idx - 1);
      }
    }

    if (thrCur === undefined || thrPrev === undefined) return false;

    return cond.operator === 'crossover'
      ? prev <= thrPrev && cur > thrCur
      : prev >= thrPrev && cur < thrCur;
  }

  const threshold = cond.compareIndicator
    ? indicatorValue(cond.compareIndicator, data, idx)
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

function evalRuleAt(rule: TradeRule, data: ChartDataPoint[], idx: number): boolean {
  if (!rule.enabled || rule.conditions.length === 0 || idx < 1) return false;
  const results = rule.conditions.map(c => evalConditionAt(c, data, idx));
  return rule.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

function calcSharpe(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const n = dailyReturns.length;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / n;
  const variance = dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  return std === 0 ? 0 : (mean / std) * Math.sqrt(252);
}

// ─── Multi-stock result type ──────────────────────────────────────────────────

export type StockBacktestResult = {
  stockCode: string;
  stockLabel: string;
  color: string;
  result: BacktestResult;
};

// ─── Main backtest engine ─────────────────────────────────────────────────────

export function runBacktest(
  config: BacktestConfig,
  data: ChartDataPoint[],
  allRules: TradeRule[],
): BacktestResult {
  const emptyExitReasons = { ruleExit: 0, takeProfit: 0, trailingStop: 0, maxHoldDays: 0 };
  const empty: BacktestResult = {
    trades: [],
    finalCapital: config.initialCapital,
    totalReturn: 0,
    totalReturnPct: 0,
    winRate: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    totalTrades: 0,
    totalCost: 0,
    marketFilteredCount: 0,
    equityCurve: [],
    exitReasons: emptyExitReasons,
  };

  const { rule, initialCapital, positionSize } = config;
  const rate = (config.commissionRate ?? 0) + (config.slippage ?? 0);

  // Filter to requested date range
  const rangeData = data.filter(
    d => d.date >= config.startDate && d.date <= config.endDate,
  );
  if (rangeData.length < 5) return empty;

  // Use the full data array for indicator lookback, trade only within rangeData
  const startGi = data.findIndex(d => d.date === rangeData[0].date);
  if (startGi < 0) return empty;

  // Entry/exit rule assignment
  const entryRules: TradeRule[] =
    rule.type === 'buy'
      ? [rule]
      : allRules.filter(r => r.enabled && r.type === 'buy');

  const exitRules: TradeRule[] =
    rule.type === 'sell'
      ? [rule]
      : config.sellRuleId
      ? allRules.filter(r => r.id === config.sellRuleId)
      : allRules.filter(r => r.enabled && r.type === 'sell');

  let cash = initialCapital;
  let posShares = 0;
  let entryPrice = 0;
  let entryRangeIdx = -1;
  let positionHighPrice = 0; // highest close since entry (for trailing stop)
  let totalCostAccum = 0;
  let marketFilteredCount = 0;

  const trades: BacktestTrade[] = [];
  const equityCurve: { date: string; capital: number }[] = [];
  const dailyReturns: number[] = [];
  const exitReasonCounts = { ruleExit: 0, takeProfit: 0, trailingStop: 0, maxHoldDays: 0 };
  let prevDayEquity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdown = 0;

  for (let ri = 0; ri < rangeData.length; ri++) {
    const gi = startGi + ri;
    const d = rangeData[ri];
    const price = d.close;
    const isLast = ri === rangeData.length - 1;

    // Update trailing stop high-water mark (use actual market price)
    if (posShares > 0 && price > positionHighPrice) positionHighPrice = price;

    // Exit open long position
    if (posShares > 0) {
      const holdDays = ri - entryRangeIdx;
      let exitReason: ExitReason | null = null;

      // Priority: takeProfit > trailingStop > maxHoldDays > ruleExit > periodEnd
      if (
        config.takeProfit !== undefined &&
        price >= entryPrice * (1 + config.takeProfit)
      ) {
        exitReason = 'takeProfit';
      } else if (
        config.trailingStop !== undefined &&
        positionHighPrice > 0 &&
        price < positionHighPrice * (1 - config.trailingStop)
      ) {
        exitReason = 'trailingStop';
      } else if (
        config.maxHoldDays !== undefined &&
        holdDays >= config.maxHoldDays
      ) {
        exitReason = 'maxHoldDays';
      } else if (exitRules.some(r => evalRuleAt(r, data, gi))) {
        exitReason = 'ruleExit';
      } else if (isLast) {
        exitReason = 'periodEnd';
      }

      if (exitReason) {
        const effectiveSellPrice = price * (1 - rate);
        const revenue = posShares * effectiveSellPrice;
        const pnl = revenue - entryPrice * posShares;
        totalCostAccum += posShares * price * rate;
        cash += revenue;
        if (exitReason !== 'periodEnd') exitReasonCounts[exitReason]++;
        trades.push({
          date: d.date,
          type: 'sell',
          price,
          shares: posShares,
          capital: Math.round(cash),
          pnl: Math.round(pnl),
          exitReason,
        });
        posShares = 0;
        entryPrice = 0;
        entryRangeIdx = -1;
        positionHighPrice = 0;
      }
    }

    // Enter long position (not on last day)
    if (posShares === 0 && !isLast) {
      // 相場環境フィルター：弱気相場では買いシグナルを無効化
      const marketTrend = config.useMarketFilter && config.marketConditions
        ? (config.marketConditions.get(d.date) ?? 'neutral')
        : 'neutral';
      const blockedByMarket = config.useMarketFilter && marketTrend === 'bear';
      if (blockedByMarket) {
        marketFilteredCount++;
      } else {
        const shouldEnter = entryRules.some(r => evalRuleAt(r, data, gi));
        if (shouldEnter && cash > 0) {
          const effectiveBuyPrice = price * (1 + rate);
          const sharesToBuy = Math.floor((cash * positionSize) / effectiveBuyPrice);
          if (sharesToBuy > 0) {
            entryPrice = effectiveBuyPrice;
            posShares = sharesToBuy;
            entryRangeIdx = ri;
            positionHighPrice = price;
            totalCostAccum += sharesToBuy * price * rate;
            cash -= sharesToBuy * effectiveBuyPrice;
            trades.push({
              date: d.date,
              type: 'buy',
              price,
              shares: sharesToBuy,
              capital: Math.round(cash + posShares * price),
              pnl: 0,
            });
          }
        }
      }
    }

    // End-of-day equity (mark-to-market at actual price)
    const equity = cash + posShares * price;

    if (equity > peakEquity) peakEquity = equity;
    const dd = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (ri > 0) {
      dailyReturns.push(prevDayEquity > 0 ? (equity - prevDayEquity) / prevDayEquity : 0);
    }
    prevDayEquity = equity;
    equityCurve.push({ date: d.date, capital: Math.round(equity) });
  }

  const finalCapital = cash + posShares * (rangeData[rangeData.length - 1]?.close ?? 0);
  const totalReturn = finalCapital - initialCapital;
  const totalReturnPct = (totalReturn / initialCapital) * 100;

  const sellTrades = trades.filter(t => t.type === 'sell');
  const winTrades = sellTrades.filter(t => t.pnl > 0);
  const winRate = sellTrades.length > 0 ? (winTrades.length / sellTrades.length) * 100 : 0;

  return {
    trades,
    finalCapital: Math.round(finalCapital),
    totalReturn: Math.round(totalReturn),
    totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
    sharpeRatio: parseFloat(calcSharpe(dailyReturns).toFixed(2)),
    totalTrades: sellTrades.length,
    totalCost: Math.round(totalCostAccum),
    marketFilteredCount,
    equityCurve,
    exitReasons: exitReasonCounts,
  };
}

// ─── Multi-stock backtest ────────────────────────────────────────────────────

export function runBacktestMultiple(
  config: Omit<BacktestConfig, 'startDate' | 'endDate'>,
  stocks: { code: string; label: string; color: string; data: ChartDataPoint[] }[],
  allRules: TradeRule[],
): StockBacktestResult[] {
  return stocks.map(({ code, label, color, data }) => ({
    stockCode: code,
    stockLabel: label,
    color,
    result: runBacktest(
      {
        ...config,
        startDate: data[0]?.date ?? '',
        endDate: data[data.length - 1]?.date ?? '',
      },
      data,
      allRules,
    ),
  }));
}
