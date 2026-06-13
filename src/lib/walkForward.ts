import type { ChartDataPoint, TradeRule } from '@/types/stock';
import { runBacktest, type BacktestResult } from '@/lib/backtest';

export type WalkForwardConfig = {
  data: ChartDataPoint[];
  rule: TradeRule;
  allRules: TradeRule[];
  sellRuleId?: string;
  trainPeriod: number;   // 学習期間（日数） default 252
  testPeriod: number;    // 検証期間（日数） default 63
  takeProfit: number;    // decimal e.g. 0.1
  trailingStop: number;  // decimal e.g. 0.03
  maxHoldDays: number;
  commissionRate: number;  // decimal e.g. 0.001
  slippage: number;        // decimal e.g. 0.001
};

export type WalkForwardWindow = {
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
  consistency: number;  // Pearson correlation between train/test returns (-1〜1)
};

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
    trainPeriod, testPeriod,
    takeProfit, trailingStop, maxHoldDays,
    commissionRate, slippage,
  } = config;

  const empty: WalkForwardResult = {
    windows: [],
    avgTestReturn: 0,
    avgTestSharpe: 0,
    avgTestWinRate: 0,
    consistency: 0,
  };

  if (data.length < trainPeriod + testPeriod) return empty;

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
  };

  const windows: WalkForwardWindow[] = [];
  let windowStart = 0;

  while (windowStart + trainPeriod + testPeriod <= data.length) {
    const trainSlice = data.slice(windowStart, windowStart + trainPeriod);
    const testSlice  = data.slice(windowStart + trainPeriod, windowStart + trainPeriod + testPeriod);

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
      trainStart: trainSlice[0].date,
      trainEnd:   trainSlice[trainSlice.length - 1].date,
      testStart:  testSlice[0].date,
      testEnd:    testSlice[testSlice.length - 1].date,
      trainResult,
      testResult,
    });

    windowStart += testPeriod;
  }

  if (windows.length === 0) return empty;

  const n = windows.length;
  const avgTestReturn  = windows.reduce((s, w) => s + w.testResult.totalReturnPct,  0) / n;
  const avgTestSharpe  = windows.reduce((s, w) => s + w.testResult.sharpeRatio,     0) / n;
  const avgTestWinRate = windows.reduce((s, w) => s + w.testResult.winRate,         0) / n;

  const trainReturns = windows.map(w => w.trainResult.totalReturnPct);
  const testReturns  = windows.map(w => w.testResult.totalReturnPct);
  const consistency  = pearsonCorr(trainReturns, testReturns);

  return {
    windows,
    avgTestReturn:  parseFloat(avgTestReturn.toFixed(2)),
    avgTestSharpe:  parseFloat(avgTestSharpe.toFixed(2)),
    avgTestWinRate: parseFloat(avgTestWinRate.toFixed(1)),
    consistency:    parseFloat(Math.max(-1, Math.min(1, consistency)).toFixed(3)),
  };
}
