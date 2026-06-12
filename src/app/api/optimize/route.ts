import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import type { TradeRule, RuleCondition } from '@/types/stock';

type BacktestSummary = {
  totalReturnPct: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  exitReasons: {
    ruleExit: number;
    takeProfit: number;
    trailingStop: number;
    maxHoldDays: number;
  };
};

type OptimizeRequest = {
  rule: TradeRule;
  results: BacktestSummary[];
  stockName: string;
  currentConfig: {
    takeProfit: string | null;
    trailingStop: string | null;
    maxHoldDays: string | null;
  };
};

export type OptimizeSuggestion = {
  analysis: string;
  recommendations: {
    takeProfit: number;
    trailingStop: number;
    maxHoldDays: number;
    conditionAdjustments: string[];
  };
  expectedImprovement: string;
};

const client = new Anthropic();

const INDICATOR_JP: Record<string, string> = {
  rsi: 'RSI', macd: 'MACD', price: '株価', ma5: 'MA5', ma25: 'MA25',
  volume: '出来高', bbUpper: 'BB上限', bbLower: 'BB下限', bbMid: 'BB中央',
  bbWidth: 'BBバンド幅', volumeMA: '出来高MA20',
};
const OPERATOR_JP: Record<string, string> = {
  '>': '>', '<': '<', '>=': '>=', '<=': '<=',
  crossover: '上抜け', crossunder: '下抜け',
};

function conditionText(cond: RuleCondition): string {
  const ind = INDICATOR_JP[cond.indicator] ?? cond.indicator;
  const op  = OPERATOR_JP[cond.operator]   ?? cond.operator;
  const rhs = cond.compareIndicator
    ? (INDICATOR_JP[cond.compareIndicator] ?? cond.compareIndicator)
    : String(cond.value);
  return `${ind} ${op} ${rhs}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as OptimizeRequest;
    const { rule, results, stockName, currentConfig } = body;

    const n = results.length;
    const avg = (fn: (r: BacktestSummary) => number) =>
      results.reduce((s, r) => s + fn(r), 0) / n;

    const avgReturn   = avg(r => r.totalReturnPct);
    const avgWinRate  = avg(r => r.winRate);
    const avgSharpe   = avg(r => r.sharpeRatio);
    const avgDD       = avg(r => r.maxDrawdown);
    const totalTrades = results.reduce((s, r) => s + r.totalTrades, 0);
    const exits = results.reduce(
      (acc, r) => ({
        takeProfit:   acc.takeProfit   + r.exitReasons.takeProfit,
        trailingStop: acc.trailingStop + r.exitReasons.trailingStop,
        maxHoldDays:  acc.maxHoldDays  + r.exitReasons.maxHoldDays,
        ruleExit:     acc.ruleExit     + r.exitReasons.ruleExit,
      }),
      { takeProfit: 0, trailingStop: 0, maxHoldDays: 0, ruleExit: 0 },
    );

    const conditions = rule.conditions.map(conditionText).join(` ${rule.logic} `);
    const tp = currentConfig.takeProfit  ? `${currentConfig.takeProfit}%`  : '未設定';
    const ts = currentConfig.trailingStop ? `${currentConfig.trailingStop}%` : '未設定';
    const mh = currentConfig.maxHoldDays  ? `${currentConfig.maxHoldDays}日` : '未設定';

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `株式バックテスト結果を分析し最適化案をJSONのみで返してください。

ルール: ${rule.name}（${rule.type === 'buy' ? '買い' : '売り'}）
条件: ${conditions}
対象: ${stockName}（${n}銘柄）

結果:
- 平均リターン: ${avgReturn.toFixed(2)}%
- 勝率: ${avgWinRate.toFixed(1)}%
- シャープレシオ: ${avgSharpe.toFixed(2)}
- 最大DD: ${avgDD.toFixed(2)}%
- 総取引: ${totalTrades}回（利確${exits.takeProfit}・TStop${exits.trailingStop}・期間${exits.maxHoldDays}・ルール${exits.ruleExit}）

現在設定: テイクプロフィット=${tp} / トレイリングストップ=${ts} / 最大保有=${mh}

以下のJSONのみ返答（前後の説明不要）:
{
  "analysis": "現状の問題点と改善余地（日本語・2-3文）",
  "recommendations": {
    "takeProfit": 数値（%・例7.5）,
    "trailingStop": 数値（%・例4.0）,
    "maxHoldDays": 整数（例15）,
    "conditionAdjustments": ["具体的な条件調整案（日本語）", "調整案2", "調整案3"]
  },
  "expectedImprovement": "調整後の改善予測（日本語・1-2文）"
}`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI response contained no JSON');

    const suggestion = JSON.parse(jsonMatch[0]) as OptimizeSuggestion;
    return NextResponse.json(suggestion);
  } catch (error) {
    console.error('[optimize]', error);
    const msg = error instanceof Error ? error.message : '最適化に失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
