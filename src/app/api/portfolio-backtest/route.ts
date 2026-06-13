import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import type { StockData } from '@/types/stock';
import { buildChartData } from '@/lib/indicators';
import { DEFAULT_RULES } from '@/lib/ruleEngine';
import { runBacktest, type BacktestResult } from '@/lib/backtest';
import { generateMockData } from '@/lib/mockData';
import { ALL_STOCKS } from '@/lib/stocks';
import type { StockStrategy } from '@/lib/portfolioStrategy';

export type PortfolioBacktestResponse = {
  results: {
    symbol: string;
    name: string;
    result: BacktestResult;
  }[];
  avgReturn: number;
  avgSharpe: number;
  avgWinRate: number;
  plusCount: number;
  minusCount: number;
};

type RequestBody = {
  strategies: StockStrategy[];
  useHistorical: boolean;
  commissionRate?: number;
  slippage?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody;
    const { strategies, useHistorical, commissionRate, slippage } = body;

    const results: PortfolioBacktestResponse['results'] = [];

    for (const strategy of strategies) {
      try {
        const buyRule = DEFAULT_RULES.find(r => r.id === strategy.buyRuleId);
        if (!buyRule) continue;

        let rawData: StockData[];

        if (useHistorical) {
          const filePath = path.join(
            process.cwd(),
            'public',
            'data',
            'historical',
            `${strategy.symbol}.T.json`,
          );
          if (!existsSync(filePath)) {
            console.error(`[portfolio-backtest] historical file not found: ${filePath}`);
            continue;
          }
          rawData = JSON.parse(readFileSync(filePath, 'utf-8')) as StockData[];
        } else {
          const stock = ALL_STOCKS.find(s => s.value === strategy.symbol);
          if (!stock) {
            console.error(`[portfolio-backtest] stock not found in ALL_STOCKS: ${strategy.symbol}`);
            continue;
          }
          rawData = generateMockData(stock);
        }

        const chartData = buildChartData(rawData);
        if (chartData.length === 0) continue;

        const startDate = chartData[0].date;
        const endDate = chartData[chartData.length - 1].date;

        const result = runBacktest(
          {
            rule: buyRule,
            initialCapital: 1_000_000,
            positionSize: 0.5,
            takeProfit: strategy.takeProfit / 100,
            trailingStop: strategy.trailingStop / 100,
            maxHoldDays: strategy.maxHoldDays,
            sellRuleId: strategy.sellRuleId,
            commissionRate: commissionRate ?? 0.001,
            slippage: slippage ?? 0.001,
            startDate,
            endDate,
          },
          chartData,
          DEFAULT_RULES,
        );

        results.push({ symbol: strategy.symbol, name: strategy.name, result });
      } catch (err) {
        console.error(`[portfolio-backtest] error processing ${strategy.symbol}:`, err);
      }
    }

    const count = results.length;
    const avg = (fn: (r: BacktestResult) => number) =>
      count === 0 ? 0 : results.reduce((s, { result }) => s + fn(result), 0) / count;

    const avgReturn = avg(r => r.totalReturnPct);
    const avgSharpe = avg(r => r.sharpeRatio);
    const avgWinRate = avg(r => r.winRate);
    const plusCount = results.filter(({ result }) => result.totalReturnPct > 0).length;
    const minusCount = count - plusCount;

    const response: PortfolioBacktestResponse = {
      results,
      avgReturn: parseFloat(avgReturn.toFixed(2)),
      avgSharpe: parseFloat(avgSharpe.toFixed(2)),
      avgWinRate: parseFloat(avgWinRate.toFixed(1)),
      plusCount,
      minusCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[portfolio-backtest]', error);
    const msg = error instanceof Error ? error.message : 'ポートフォリオバックテストに失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
