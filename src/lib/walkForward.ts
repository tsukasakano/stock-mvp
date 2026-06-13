import type { ChartDataPoint, TradeRule } from '@/types/stock';
import { runBacktest, type BacktestResult } from '@/lib/backtest';
import type { MarketTrend } from '@/lib/marketFilter';

// ── Aggregated (all-stocks) types ──────────────────────────────────────────

export type AggregatedWindow = {
  windowIndex: number;
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  avgTrainReturn: number;   // equal-weight average across all stocks
  avgTestReturn: number;
  totalTrainTrades: number; // sum of all trades across all stocks
  totalTestTrades: number;
  testWinRate: number;      // weighted win rate
  testSharpe: number;       // average sharpe
};

export type AggregatedWalkForwardResult = {
  windows: AggregatedWindow[];
  avgTestReturn: number;
  avgTestSharpe: number;
  avgTestWinRate: number;
  avgWindowTrades: number;  // average total trades per window
  consistency: number;
  isReliable: boolean;
  stockCount: number;
};

// ── Multi-stock types ──────────────────────────────────────────────────────

export type StockWalkForwardInput = {
  symbol: string;
  name: string;
  data: ChartDataPoint[];
  rule: TradeRule;
  sellRuleId?: string;
  takeProfit: number;
  trailingStop: number;
  maxHoldDays: number;
};

export type SharedWalkForwardParams = {
  trainDays: number;
  testDays: number;
  commissionRate: number;
  slippage: number;
  useMarketFilter?: boolean;
  marketConditions?: Map<string, MarketTrend>;
};

export type StockWalkForwardResult = {
  symbol: string;
  name: string;
  consistencyScore: number;
  avgTestReturn: number;
  avgTestSharpe: number;
  avgTestWinRate: number;
  isReliable: boolean;
  windows: WalkForwardWindow[];
};

export type MultiWalkForwardResult = {
  stockResults: StockWalkForwardResult[];
  avgConsistency: number;
  avgTestReturn: number;
  reliableCount: number;
};

export type WalkForwardConfig = {
  data: ChartDataPoint[];
  rule: TradeRule;
  allRules: TradeRule[];
  sellRuleId?: string;
  trainDays: number;    // 学習期間（日数）
  testDays: number;     // 検証期間（日数）
  takeProfit: number;
  trailingStop: number;
  maxHoldDays: number;
  commissionRate: number;
  slippage: number;
  useMarketFilter?: boolean;
  marketConditions?: Map<string, MarketTrend>;
};

export type WalkForwardWindow = {
  windowIndex: number;
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  trainResult: BacktestResult;
  testResult: BacktestResult;
};

export type WalkForwardResult = {
  windows: WalkForwardWindow[];
  avgTestReturn: number;
  avgTestSharpe: number;
  avgTestWinRate: number;
  consistency: number;
  isReliable: boolean;  // consistency >= 0.7
};

export function runWalkForwardMultiple(
  stocks: StockWalkForwardInput[],
  shared: SharedWalkForwardParams,
  allRules: TradeRule[],
): MultiWalkForwardResult {
  const stockResults: StockWalkForwardResult[] = stocks.map(stock => {
    const result = runWalkForward({
      data: stock.data,
      rule: stock.rule,
      allRules,
      sellRuleId: stock.sellRuleId,
      trainDays:    shared.trainDays,
      testDays:     shared.testDays,
      takeProfit:   stock.takeProfit,
      trailingStop: stock.trailingStop,
      maxHoldDays:  stock.maxHoldDays,
      commissionRate:   shared.commissionRate,
      slippage:         shared.slippage,
      useMarketFilter:  shared.useMarketFilter,
      marketConditions: shared.marketConditions,
    });
    return {
      symbol:           stock.symbol,
      name:             stock.name,
      consistencyScore: result.consistency,
      avgTestReturn:    result.avgTestReturn,
      avgTestSharpe:    result.avgTestSharpe,
      avgTestWinRate:   result.avgTestWinRate,
      isReliable:       result.isReliable,
      windows:          result.windows,
    };
  });

  const n = stockResults.length;
  const avgConsistency = n > 0
    ? parseFloat((stockResults.reduce((s, r) => s + r.consistencyScore, 0) / n).toFixed(3))
    : 0;
  const avgTestReturn = n > 0
    ? parseFloat((stockResults.reduce((s, r) => s + r.avgTestReturn, 0) / n).toFixed(2))
    : 0;
  const reliableCount = stockResults.filter(r => r.isReliable).length;

  return { stockResults, avgConsistency, avgTestReturn, reliableCount };
}

function pearsonCorr(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  const num   = x.reduce((s, v, i) => s + (v - meanX) * (y[i] - meanY), 0);
  const denX  = Math.sqrt(x.reduce((s, v) => s + (v - meanX) ** 2, 0));
  const denY  = Math.sqrt(y.reduce((s, v) => s + (v - meanY) ** 2, 0));
  return denX === 0 || denY === 0 ? 0 : num / (denX * denY);
}

export function runWalkForward(config: WalkForwardConfig): WalkForwardResult {
  const {
    data, rule, allRules, sellRuleId,
    trainDays, testDays,
    takeProfit, trailingStop, maxHoldDays,
    commissionRate, slippage,
    useMarketFilter, marketConditions,
  } = config;

  const empty: WalkForwardResult = {
    windows: [],
    avgTestReturn: 0,
    avgTestSharpe: 0,
    avgTestWinRate: 0,
    consistency: 0,
    isReliable: false,
  };

  if (data.length < trainDays + testDays) return empty;

  const baseConfig = {
    rule,
    sellRuleId,
    initialCapital: 1_000_000,
    positionSize: 0.5,
    takeProfit,
    trailingStop,
    maxHoldDays,
    commissionRate,
    slippage,
    useMarketFilter,
    marketConditions,
  };

  const windows: WalkForwardWindow[] = [];
  let windowStart = 0;

  while (windowStart + trainDays + testDays <= data.length) {
    const trainSlice = data.slice(windowStart, windowStart + trainDays);
    const testSlice  = data.slice(windowStart + trainDays, windowStart + trainDays + testDays);

    const trainResult = runBacktest(
      { ...baseConfig, startDate: trainSlice[0].date, endDate: trainSlice[trainSlice.length - 1].date },
      trainSlice,
      allRules,
    );
    const testResult = runBacktest(
      { ...baseConfig, startDate: testSlice[0].date, endDate: testSlice[testSlice.length - 1].date },
      testSlice,
      allRules,
    );

    windows.push({
      windowIndex: windows.length + 1,
      trainStart: trainSlice[0].date,
      trainEnd:   trainSlice[trainSlice.length - 1].date,
      testStart:  testSlice[0].date,
      testEnd:    testSlice[testSlice.length - 1].date,
      trainResult,
      testResult,
    });

    windowStart += testDays;
  }

  if (windows.length === 0) return empty;

  const n = windows.length;
  const avgTestReturn  = windows.reduce((s, w) => s + w.testResult.totalReturnPct,  0) / n;
  const avgTestSharpe  = windows.reduce((s, w) => s + w.testResult.sharpeRatio,     0) / n;
  const avgTestWinRate = windows.reduce((s, w) => s + w.testResult.winRate,         0) / n;

  const trainReturns = windows.map(w => w.trainResult.totalReturnPct);
  const testReturns  = windows.map(w => w.testResult.totalReturnPct);
  const consistency  = pearsonCorr(trainReturns, testReturns);
  const clampedConsistency = parseFloat(Math.max(-1, Math.min(1, consistency)).toFixed(3));

  return {
    windows,
    avgTestReturn:  parseFloat(avgTestReturn.toFixed(2)),
    avgTestSharpe:  parseFloat(avgTestSharpe.toFixed(2)),
    avgTestWinRate: parseFloat(avgTestWinRate.toFixed(1)),
    consistency:    clampedConsistency,
    isReliable:     clampedConsistency >= 0.7,
  };
}

// ── Aggregated walk-forward (all-stocks mode) ─────────────────────────────

export function runWalkForwardAggregated(
  stocks: StockWalkForwardInput[],
  shared: SharedWalkForwardParams,
  allRules: TradeRule[],
): AggregatedWalkForwardResult {
  const empty: AggregatedWalkForwardResult = {
    windows: [], avgTestReturn: 0, avgTestSharpe: 0, avgTestWinRate: 0,
    avgWindowTrades: 0, consistency: 0, isReliable: false, stockCount: stocks.length,
  };

  if (stocks.length === 0) return empty;

  const { trainDays, testDays, commissionRate, slippage, useMarketFilter, marketConditions } = shared;

  // Use the stock with the most data as the anchor for window dates
  const anchor = stocks.reduce((best, s) => s.data.length > best.data.length ? s : best, stocks[0]);
  if (anchor.data.length < trainDays + testDays) return empty;

  const windows: AggregatedWindow[] = [];
  let windowStart = 0;

  while (windowStart + trainDays + testDays <= anchor.data.length) {
    const trainSlice = anchor.data.slice(windowStart, windowStart + trainDays);
    const testSlice  = anchor.data.slice(windowStart + trainDays, windowStart + trainDays + testDays);
    const trainStart = trainSlice[0].date;
    const trainEnd   = trainSlice[trainSlice.length - 1].date;
    const testStart  = testSlice[0].date;
    const testEnd    = testSlice[testSlice.length - 1].date;

    let sumTrainReturn = 0, sumTestReturn = 0;
    let totalTrainTrades = 0, totalTestTrades = 0;
    let totalTestWins = 0, sumTestSharpe = 0;
    let validCount = 0;

    for (const stock of stocks) {
      const baseConfig = {
        rule:           stock.rule,
        sellRuleId:     stock.sellRuleId,
        initialCapital: 1_000_000,
        positionSize:   0.5,
        takeProfit:     stock.takeProfit,
        trailingStop:   stock.trailingStop,
        maxHoldDays:    stock.maxHoldDays,
        commissionRate,
        slippage,
        useMarketFilter,
        marketConditions,
      };

      const tr = runBacktest({ ...baseConfig, startDate: trainStart, endDate: trainEnd }, stock.data, allRules);
      const ts = runBacktest({ ...baseConfig, startDate: testStart,  endDate: testEnd  }, stock.data, allRules);

      sumTrainReturn  += tr.totalReturnPct;
      sumTestReturn   += ts.totalReturnPct;
      totalTrainTrades += tr.totalTrades;
      totalTestTrades  += ts.totalTrades;
      totalTestWins    += (ts.winRate / 100) * ts.totalTrades;
      sumTestSharpe    += ts.sharpeRatio;
      validCount++;
    }

    if (validCount === 0) { windowStart += testDays; continue; }

    windows.push({
      windowIndex:      windows.length + 1,
      trainStart, trainEnd, testStart, testEnd,
      avgTrainReturn:   parseFloat((sumTrainReturn  / validCount).toFixed(2)),
      avgTestReturn:    parseFloat((sumTestReturn   / validCount).toFixed(2)),
      totalTrainTrades,
      totalTestTrades,
      testWinRate:      totalTestTrades > 0
        ? parseFloat(((totalTestWins / totalTestTrades) * 100).toFixed(1))
        : 0,
      testSharpe:       parseFloat((sumTestSharpe / validCount).toFixed(2)),
    });

    windowStart += testDays;
  }

  if (windows.length === 0) return empty;

  const n = windows.length;
  const avgTestReturn   = parseFloat((windows.reduce((s, w) => s + w.avgTestReturn, 0) / n).toFixed(2));
  const avgTestSharpe   = parseFloat((windows.reduce((s, w) => s + w.testSharpe,    0) / n).toFixed(2));
  const avgTestWinRate  = parseFloat((windows.reduce((s, w) => s + w.testWinRate,   0) / n).toFixed(1));
  const avgWindowTrades = Math.round(windows.reduce((s, w) => s + w.totalTestTrades, 0) / n);

  const trainReturns = windows.map(w => w.avgTrainReturn);
  const testReturns  = windows.map(w => w.avgTestReturn);
  const consistency  = parseFloat(Math.max(-1, Math.min(1, pearsonCorr(trainReturns, testReturns))).toFixed(3));

  return {
    windows,
    avgTestReturn,
    avgTestSharpe,
    avgTestWinRate,
    avgWindowTrades,
    consistency,
    isReliable: consistency >= 0.7,
    stockCount: stocks.length,
  };
}
