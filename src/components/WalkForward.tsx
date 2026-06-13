'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { ALL_STOCKS } from '@/lib/stocks';
import { loadRules } from '@/lib/ruleEngine';
import { buildChartData } from '@/lib/indicators';
import { fetchHistoricalData } from '@/lib/historicalData';
import { generateMockData } from '@/lib/mockData';
import { DEFAULT_STRATEGIES } from '@/lib/portfolioStrategy';
import {
  runWalkForward,
  runWalkForwardMultiple,
  runWalkForwardAggregated,
  type WalkForwardResult,
  type WalkForwardWindow,
  type MultiWalkForwardResult,
  type StockWalkForwardResult,
  type AggregatedWalkForwardResult,
  type AggregatedWindow,
} from '@/lib/walkForward';
import { buildMarketConditionMap, type MarketTrend } from '@/lib/marketFilter';
import type { TradeRule, ChartDataPoint, StockData } from '@/types/stock';

// ── Shared constants ──────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a', border: '1px solid #1e293b',
  color: '#e2e8f0', borderRadius: '10px', fontSize: '11px',
};

const inputCls = 'bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500 w-full';

function fmtDate(iso: string): string {
  const p = iso.split('-');
  return `${parseInt(p[1])}/${parseInt(p[2])}`;
}

function isDivergent(w: WalkForwardWindow): boolean {
  return w.trainResult.totalReturnPct > 0 && w.testResult.totalReturnPct < -1;
}

function consistencyColor(v: number): string {
  return v >= 0.7 ? '#10b981' : v >= 0.4 ? '#f59e0b' : '#ef4444';
}

function consistencyLabel(v: number): string {
  return v >= 0.7 ? '過学習なし' : v >= 0.4 ? '要注意' : '過学習の可能性';
}

// ── Custom dot for divergent windows ─────────────────────────────────────

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { divergent?: boolean };
}
function TestDot({ cx = 0, cy = 0, payload }: DotProps) {
  if (!payload?.divergent) {
    return <circle cx={cx} cy={cy} r={4} fill="#10b981" stroke="#0f172a" strokeWidth={1.5} />;
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#ef444430" stroke="#ef4444" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={3} fill="#ef4444" />
    </g>
  );
}

// ── Consistency gauge ─────────────────────────────────────────────────────

function ConsistencyGauge({ value, isReliable }: { value: number; isReliable: boolean }) {
  const pct = Math.round(((value + 1) / 2) * 100);
  const color = consistencyColor(value);

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-slate-500 uppercase tracking-widest">一貫性スコア</span>
        <span className="text-5xl font-mono font-bold tabular-nums leading-none" style={{ color }}>
          {value.toFixed(2)}
        </span>
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full mt-1"
          style={{ color, background: `${color}20`, border: `1px solid ${color}50` }}
        >
          {consistencyLabel(value)}
        </span>
        {isReliable && (
          <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-full px-2.5 py-0.5 font-semibold mt-0.5">
            ✓ 信頼性 HIGH
          </span>
        )}
      </div>
      <div className="w-full max-w-xs space-y-1">
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden relative">
          <div className="absolute top-0 left-1/2 w-0.5 h-full bg-slate-600 z-10" />
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-slate-600">
          <span>−1 (逆相関)</span>
          <span>0</span>
          <span>+1 (正相関)</span>
        </div>
        <div className="relative h-2 w-full">
          <div className="absolute text-[8px] text-amber-600" style={{ left: '70%' }}>▲0.4</div>
          <div className="absolute text-[8px] text-emerald-600" style={{ left: '85%' }}>▲0.7</div>
        </div>
      </div>
      <p className="text-[10px] text-slate-600 text-center max-w-xs">
        学習期間と検証期間のリターンのPearson相関係数。0.7以上で過学習なし。
      </p>
    </div>
  );
}

// ── Verdict (single) ──────────────────────────────────────────────────────

function VerdictSection({ result }: { result: WalkForwardResult }) {
  const { consistency, isReliable, avgTestReturn, avgTestSharpe, avgTestWinRate, windows } = result;
  const divergentCount = windows.filter(isDivergent).length;

  const suggestions: string[] = [];
  if (!isReliable) {
    suggestions.push('学習期間を長くして（例: 504日）より安定した最適化を試みる');
    suggestions.push('パラメータを絞り込み、過学習しにくいシンプルなルールに変更する');
    suggestions.push('検証ウィンドウ数が少ない場合はデータ期間を延ばす');
  }
  if (avgTestWinRate < 50) suggestions.push('勝率が低い — TP/TSPを調整してエントリー精度を改善する');
  if (avgTestSharpe < 0.5) suggestions.push('シャープ比が低い — トレーリングストップを強めてドローダウンを抑える');
  if (divergentCount > windows.length * 0.4) {
    suggestions.push(`乖離ウィンドウが多い（${divergentCount}/${windows.length}） — 相場環境への適応力を高める条件を追加する`);
  }
  if (!avgTestReturn) suggestions.push('平均検証リターンがマイナス — 買いルールの条件閾値を見直す');

  const isGood = isReliable && avgTestReturn > 0 && avgTestSharpe >= 0.5;

  return (
    <div className={`rounded-xl p-4 border ${isGood ? 'bg-emerald-950/30 border-emerald-900/60' : 'bg-amber-950/20 border-amber-900/40'}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5">{isGood ? '✅' : '⚠️'}</span>
        <div className="space-y-2 flex-1">
          <p className={`text-sm font-bold ${isGood ? 'text-emerald-300' : 'text-amber-300'}`}>
            {isGood ? 'このルールは実用的です' : consistency < 0.4 ? '過学習の可能性があります' : 'このルールは改善の余地があります'}
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            一貫性スコア {consistency.toFixed(3)} / 平均検証リターン {avgTestReturn >= 0 ? '+' : ''}{avgTestReturn}% / 平均シャープ比 {avgTestSharpe.toFixed(2)} / 勝率 {avgTestWinRate}%
          </p>
          {suggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">改善提案</p>
              <ul className="space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                    <span className="text-amber-500 flex-shrink-0">•</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Window chart + table (single/portfolio) ───────────────────────────────

function WindowsDetail({ windows }: { windows: WalkForwardWindow[] }) {
  const lineData = windows.map(w => ({
    window: `W${w.windowIndex}`,
    testLabel: w.testStart,
    train: w.trainResult.totalReturnPct,
    test:  w.testResult.totalReturnPct,
    divergent: isDivergent(w),
  }));

  return (
    <div className="space-y-3 pt-1">
      {lineData.length > 0 && (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="window" tick={{ fontSize: 9, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}%`} width={38} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: unknown, name: unknown) => {
                const num = Number(v);
                return [`${num >= 0 ? '+' : ''}${num.toFixed(2)}%`, name === 'train' ? '学習' : '検証'];
              }}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload;
                return p ? `${label} 検証: ${p.testLabel}${p.divergent ? ' ⚠' : ''}` : label;
              }}
            />
            <Legend formatter={v => v === 'train' ? '学習' : '検証'} wrapperStyle={{ fontSize: '10px' }} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
            <Line type="monotone" dataKey="train" stroke="#3b82f6" strokeWidth={1.5}
              dot={{ r: 2, fill: '#3b82f6', stroke: '#0f172a', strokeWidth: 1 }} />
            <Line type="monotone" dataKey="test" stroke="#10b981" strokeWidth={1.5}
              strokeDasharray="5 3" dot={<TestDot />} />
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500">
              <th className="px-2 py-1.5 text-left">#</th>
              <th className="px-2 py-1.5 text-left">学習期間</th>
              <th className="px-2 py-1.5 text-left">検証期間</th>
              <th className="px-2 py-1.5 text-right">学習R</th>
              <th className="px-2 py-1.5 text-right">検証R</th>
              <th className="px-2 py-1.5 text-right">勝率</th>
              <th className="px-2 py-1.5 text-right">Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {windows.map(w => {
              const testPos = w.testResult.totalReturnPct >= 0;
              const div     = isDivergent(w);
              return (
                <tr
                  key={w.windowIndex}
                  className={`border-b border-slate-800/50 transition-colors ${div ? 'bg-red-950/20' : 'hover:bg-slate-800/20'}`}
                >
                  <td className="px-2 py-1.5 font-mono text-slate-500">
                    W{w.windowIndex}{div && <span className="ml-0.5 text-red-500">⚠</span>}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-slate-500 text-[10px] whitespace-nowrap">
                    {w.trainStart} 〜 {fmtDate(w.trainEnd)}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-slate-500 text-[10px] whitespace-nowrap">
                    {w.testStart} 〜 {fmtDate(w.testEnd)}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono ${w.trainResult.totalReturnPct >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                    {w.trainResult.totalReturnPct >= 0 ? '+' : ''}{w.trainResult.totalReturnPct}%
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono font-semibold ${testPos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testPos ? '+' : ''}{w.testResult.totalReturnPct}%
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono ${w.testResult.winRate >= 50 ? 'text-slate-300' : 'text-amber-400'}`}>
                    {w.testResult.winRate}%
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono ${w.testResult.sharpeRatio > 0 ? 'text-slate-300' : 'text-red-400'}`}>
                    {w.testResult.sharpeRatio}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Aggregated windows table ───────────────────────────────────────────────

function AggregatedWindowsDetail({ windows }: { windows: AggregatedWindow[] }) {
  const lineData = windows.map(w => ({
    window: `W${w.windowIndex}`,
    train: w.avgTrainReturn,
    test:  w.avgTestReturn,
  }));

  return (
    <div className="space-y-3 pt-1">
      {lineData.length > 0 && (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="window" tick={{ fontSize: 9, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}%`} width={38} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: unknown, name: unknown) => {
                const num = Number(v);
                return [`${num >= 0 ? '+' : ''}${num.toFixed(2)}%`, name === 'train' ? '平均学習R' : '平均検証R'];
              }}
            />
            <Legend formatter={v => v === 'train' ? '平均学習R' : '平均検証R'} wrapperStyle={{ fontSize: '10px' }} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
            <Line type="monotone" dataKey="train" stroke="#3b82f6" strokeWidth={1.5}
              dot={{ r: 3, fill: '#3b82f6', stroke: '#0f172a', strokeWidth: 1 }} />
            <Line type="monotone" dataKey="test" stroke="#10b981" strokeWidth={1.5}
              strokeDasharray="5 3" dot={{ r: 3, fill: '#10b981', stroke: '#0f172a', strokeWidth: 1 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500">
              <th className="px-2 py-1.5 text-left">#</th>
              <th className="px-2 py-1.5 text-left">検証期間</th>
              <th className="px-2 py-1.5 text-right">平均学習R</th>
              <th className="px-2 py-1.5 text-right">平均検証R</th>
              <th className="px-2 py-1.5 text-right font-semibold text-slate-400">合計取引</th>
              <th className="px-2 py-1.5 text-right">勝率</th>
              <th className="px-2 py-1.5 text-right">Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {windows.map(w => {
              const testPos = w.avgTestReturn >= 0;
              return (
                <tr key={w.windowIndex} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-2 py-1.5 font-mono text-slate-500">W{w.windowIndex}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-500 text-[10px] whitespace-nowrap">
                    {w.testStart} 〜 {fmtDate(w.testEnd)}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono ${w.avgTrainReturn >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                    {w.avgTrainReturn >= 0 ? '+' : ''}{w.avgTrainReturn}%
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono font-semibold ${testPos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testPos ? '+' : ''}{w.avgTestReturn}%
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-amber-300 font-semibold">
                    {w.totalTestTrades}回
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono ${w.testWinRate >= 50 ? 'text-slate-300' : 'text-amber-400'}`}>
                    {w.testWinRate}%
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono ${w.testSharpe > 0 ? 'text-slate-300' : 'text-red-400'}`}>
                    {w.testSharpe}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Aggregated result section ─────────────────────────────────────────────

function AggregatedResultSection({ result }: { result: AggregatedWalkForwardResult }) {
  const { consistency, isReliable, avgTestReturn, avgTestSharpe, avgTestWinRate, avgWindowTrades, windows, stockCount } = result;

  const isGood = isReliable && avgTestReturn > 0 && avgTestSharpe >= 0.5;
  const suggestions: string[] = [];
  if (!isReliable) {
    suggestions.push('学習期間を延ばす（例: 504日）か、よりシンプルなルールを試す');
    suggestions.push('ウィンドウ数が少ない場合はデータ期間を延ばす');
  }
  if (avgTestWinRate < 50) suggestions.push('勝率が低い — TP/TSP設定を調整してエントリー精度を改善する');
  if (avgTestSharpe < 0.5) suggestions.push('シャープ比が低い — トレーリングストップを強めてリスクを管理する');
  if (avgTestReturn < 0) suggestions.push('平均リターンがマイナス — 買いルールの閾値を見直す');

  return (
    <div className="space-y-4">
      {/* 大型一貫性ゲージ */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 flex justify-center">
        <div className="w-full max-w-sm">
          <ConsistencyGauge value={consistency} isReliable={isReliable} />
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="rounded-xl p-3 border bg-slate-900 border-slate-800">
          <p className="text-[10px] text-slate-500 mb-1">ウィンドウ数</p>
          <p className="text-sm font-bold font-mono text-slate-200">{windows.length}個</p>
        </div>
        <div className={`rounded-xl p-3 border ${avgTestReturn >= 0 ? 'bg-emerald-950/40 border-emerald-900/60' : 'bg-red-950/40 border-red-900/60'}`}>
          <p className="text-[10px] text-slate-500 mb-1">平均検証R</p>
          <p className={`text-sm font-bold font-mono ${avgTestReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {avgTestReturn >= 0 ? '+' : ''}{avgTestReturn}%
          </p>
        </div>
        <div className="rounded-xl p-3 border bg-slate-900 border-slate-800">
          <p className="text-[10px] text-slate-500 mb-1">平均Sharpe</p>
          <p className={`text-sm font-bold font-mono ${avgTestSharpe > 0 ? 'text-slate-200' : 'text-red-400'}`}>
            {avgTestSharpe.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl p-3 border bg-slate-900 border-slate-800">
          <p className="text-[10px] text-slate-500 mb-1">平均勝率</p>
          <p className={`text-sm font-bold font-mono ${avgTestWinRate >= 50 ? 'text-slate-200' : 'text-red-400'}`}>
            {avgTestWinRate}%
          </p>
        </div>
        <div className="rounded-xl p-3 border bg-amber-950/30 border-amber-900/50">
          <p className="text-[10px] text-slate-500 mb-1">平均取引/窓</p>
          <p className="text-sm font-bold font-mono text-amber-300">{avgWindowTrades}回</p>
          <p className="text-[9px] text-slate-600">{stockCount}銘柄合算</p>
        </div>
      </div>

      {/* ウィンドウ詳細 */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <p className="text-xs font-semibold text-slate-400 mb-2">ウィンドウ別集計リターン（全{stockCount}銘柄の平均）</p>
        <AggregatedWindowsDetail windows={windows} />
      </div>

      {/* 総合判定 */}
      <div className={`rounded-xl p-4 border ${isGood ? 'bg-emerald-950/30 border-emerald-900/60' : 'bg-amber-950/20 border-amber-900/40'}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">{isGood ? '✅' : '⚠️'}</span>
          <div className="space-y-2 flex-1">
            <p className={`text-sm font-bold ${isGood ? 'text-emerald-300' : 'text-amber-300'}`}>
              {isGood ? `このルールは全${stockCount}銘柄で実用的です` : `全${stockCount}銘柄での検証 — 改善の余地があります`}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              一貫性スコア {consistency.toFixed(3)} / 平均検証リターン {avgTestReturn >= 0 ? '+' : ''}{avgTestReturn}% /
              平均シャープ比 {avgTestSharpe.toFixed(2)} / 勝率 {avgTestWinRate}% /
              ウィンドウあたり平均取引回数 <span className="text-amber-300 font-semibold">{avgWindowTrades}回</span>
            </p>
            {suggestions.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">改善提案</p>
                <ul className="space-y-1">
                  {suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                      <span className="text-amber-500 flex-shrink-0">•</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Multi-stock result card ────────────────────────────────────────────────

function StockResultCard({
  result,
  expanded,
  onToggle,
}: {
  result: StockWalkForwardResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const color = consistencyColor(result.consistencyScore);
  const retPos = result.avgTestReturn >= 0;

  return (
    <div className={`rounded-xl border transition-colors ${result.isReliable ? 'border-emerald-900/50 bg-emerald-950/10' : 'border-slate-800 bg-slate-900'}`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-800/30 transition-colors rounded-xl"
      >
        <div
          className="w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0 border"
          style={{ background: `${color}15`, borderColor: `${color}40` }}
        >
          <span className="text-sm font-mono font-bold leading-none" style={{ color }}>
            {result.consistencyScore.toFixed(2)}
          </span>
          <span className="text-[8px] text-slate-500 mt-0.5">一貫性</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-200">{result.name}</span>
            <span className="text-[10px] text-slate-500">{result.symbol}</span>
            {result.isReliable && (
              <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-full px-1.5 py-0.5">
                ✓ 信頼性HIGH
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] flex-wrap">
            <span className={retPos ? 'text-emerald-400' : 'text-red-400'}>
              {retPos ? '+' : ''}{result.avgTestReturn}%
            </span>
            <span className="text-slate-500">勝率 {result.avgTestWinRate}%</span>
            <span className="text-slate-500">Sharpe {result.avgTestSharpe.toFixed(2)}</span>
            <span className="text-slate-600">{result.windows.length}窓</span>
          </div>
        </div>
        <span className={`text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {expanded && result.windows.length > 0 && (
        <div className="px-4 pb-4 border-t border-slate-800">
          <WindowsDetail windows={result.windows} />
        </div>
      )}
      {expanded && result.windows.length === 0 && (
        <div className="px-4 pb-3 border-t border-slate-800 pt-3">
          <p className="text-xs text-slate-500">データが不足しているためウィンドウを生成できませんでした。</p>
        </div>
      )}
    </div>
  );
}

// ── Multi verdict ─────────────────────────────────────────────────────────

function MultiVerdictSection({ result }: { result: MultiWalkForwardResult }) {
  const { reliableCount, stockResults, avgConsistency, avgTestReturn } = result;
  const total = stockResults.length;

  const isGood    = reliableCount >= 3;
  const isPartial = reliableCount >= 1 && reliableCount < 3;
  const verdictText = isGood
    ? 'ポートフォリオ戦略は実用的です'
    : isPartial
    ? '一部銘柄のみ実用的です'
    : '戦略の見直しが必要です';
  const bgCls = isGood
    ? 'bg-emerald-950/30 border-emerald-900/60'
    : isPartial
    ? 'bg-amber-950/20 border-amber-900/40'
    : 'bg-red-950/20 border-red-900/40';
  const textCls = isGood ? 'text-emerald-300' : isPartial ? 'text-amber-300' : 'text-red-300';
  const icon = isGood ? '✅' : isPartial ? '⚠️' : '❌';

  const suggestions: string[] = [];
  if (!isGood) {
    const lowConsistency = stockResults.filter(r => !r.isReliable).map(r => r.name);
    if (lowConsistency.length > 0) {
      suggestions.push(`一貫性が低い銘柄（${lowConsistency.join('・')}）のルールを見直す`);
    }
    if (avgConsistency < 0.4) {
      suggestions.push('学習期間を延ばす（例: 504日）か、よりシンプルなルールを試す');
    }
    if (avgTestReturn < 0) {
      suggestions.push('TP・TSP設定を見直し、エントリー精度を改善する');
    }
  }

  return (
    <div className={`rounded-xl p-4 border ${bgCls}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5">{icon}</span>
        <div className="space-y-2 flex-1">
          <p className={`text-sm font-bold ${textCls}`}>{verdictText}</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            信頼できる銘柄: {reliableCount}/{total}銘柄 / 平均一貫性スコア: {avgConsistency.toFixed(3)} / 平均検証リターン: {avgTestReturn >= 0 ? '+' : ''}{avgTestReturn}%
          </p>
          {suggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">改善提案</p>
              <ul className="space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                    <span className="text-amber-500 flex-shrink-0">•</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function WalkForward() {
  const [rules] = useState<TradeRule[]>(() => loadRules());
  const [multiMode, setMultiMode] = useState(false);
  // Sub-toggle inside multi-mode: portfolio (8) vs all-stocks (49)
  const [allStocksMode, setAllStocksMode] = useState(false);

  // Single-mode + all-stocks-mode shared state
  const [selectedStockValue, setSelectedStockValue] = useState(ALL_STOCKS[0]?.value ?? '');
  const [buyRuleId, setBuyRuleId]   = useState(() => rules.find(r => r.type === 'buy')?.id ?? '');
  const [sellRuleId, setSellRuleId] = useState('');
  const [wfResult, setWfResult]     = useState<WalkForwardResult | null>(null);

  // Shared params
  const [useHistorical, setUseHistorical]   = useState(false);
  const [trainDays, setTrainDays]           = useState('252');
  const [testDays, setTestDays]             = useState('63');
  const [takeProfit, setTakeProfit]         = useState('10');
  const [trailingStop, setTrailingStop]     = useState('3');
  const [maxHoldDays, setMaxHoldDays]       = useState('20');
  const [commissionRate, setCommissionRate] = useState('0.1');
  const [slippage, setSlippage]             = useState('0.1');

  // Multi-mode portfolio state
  const [multiResult, setMultiResult]       = useState<MultiWalkForwardResult | null>(null);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  // All-stocks aggregated state
  const [aggregatedResult, setAggregatedResult] = useState<AggregatedWalkForwardResult | null>(null);

  const [multiProgress, setMultiProgress]   = useState<{ done: number; total: number } | null>(null);

  // 相場環境フィルター
  const [useMarketFilter, setUseMarketFilter]       = useState(false);
  const [marketConditions, setMarketConditions]     = useState<Map<string, MarketTrend> | null>(null);
  const [marketFilterLoading, setMarketFilterLoading] = useState(false);

  const [loading, setLoading]     = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const dataCache = useRef<Map<string, ChartDataPoint[]>>(new Map());

  // 相場環境フィルター：N225データをオンデマンドで取得
  useEffect(() => {
    if (!useMarketFilter || marketConditions) return;
    let cancelled = false;
    setMarketFilterLoading(true);
    fetch('/api/historical/N225')
      .then(r => r.ok ? r.json() : null)
      .then((raw: StockData[] | null) => {
        if (cancelled || !raw) return;
        const condMap = buildMarketConditionMap(raw);
        const trendMap = new Map<string, MarketTrend>();
        condMap.forEach((c, k) => trendMap.set(k, c.trend));
        setMarketConditions(trendMap);
      })
      .finally(() => { if (!cancelled) setMarketFilterLoading(false); });
    return () => { cancelled = true; };
  }, [useMarketFilter, marketConditions]);

  const buyRules  = rules.filter(r => r.type === 'buy');
  const sellRules = rules.filter(r => r.type === 'sell');

  const getOrFetchData = useCallback(async (symbol: string): Promise<ChartDataPoint[] | null> => {
    const cacheKey = `${symbol}-${useHistorical}`;
    const cached = dataCache.current.get(cacheKey);
    if (cached) return cached;

    if (useHistorical) {
      const raw = await fetchHistoricalData(`${symbol}.T`);
      if (!raw) return null;
      const data = buildChartData(raw);
      dataCache.current.set(cacheKey, data);
      return data;
    } else {
      const stock = ALL_STOCKS.find(s => s.value === symbol);
      if (!stock) return null;
      const data = buildChartData(generateMockData(stock));
      dataCache.current.set(cacheKey, data);
      return data;
    }
  }, [useHistorical]);

  const handleRunSingle = useCallback(async () => {
    const buyRule = rules.find(r => r.id === buyRuleId);
    if (!buyRule) return;

    setLoading(true);
    setLoadError(null);
    setWfResult(null);

    try {
      const chartData = await getOrFetchData(selectedStockValue);
      if (!chartData) {
        setLoadError('リアルデータが見つかりません。データを更新してください。');
        return;
      }

      const result = runWalkForward({
        data: chartData,
        rule: buyRule,
        allRules: rules,
        sellRuleId: sellRuleId || undefined,
        trainDays:    parseInt(trainDays)      || 252,
        testDays:     parseInt(testDays)       || 63,
        takeProfit:   parseFloat(takeProfit)   / 100 || 0.1,
        trailingStop: parseFloat(trailingStop) / 100 || 0.03,
        maxHoldDays:  parseInt(maxHoldDays)    || 20,
        commissionRate: parseFloat(commissionRate) / 100 || 0.001,
        slippage:       parseFloat(slippage)       / 100 || 0.001,
        useMarketFilter: useMarketFilter && !!marketConditions,
        marketConditions: marketConditions ?? undefined,
      });

      setWfResult(result);
    } catch (e) {
      console.error('[walk-forward single]', e);
      setLoadError('検証中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [rules, buyRuleId, sellRuleId, selectedStockValue, trainDays, testDays,
      takeProfit, trailingStop, maxHoldDays, commissionRate, slippage,
      useMarketFilter, marketConditions, getOrFetchData]);

  // Portfolio mode (8 stocks)
  const handleRunMulti = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setMultiResult(null);
    setExpandedSymbol(null);
    setMultiProgress({ done: 0, total: DEFAULT_STRATEGIES.length });

    const shared = {
      trainDays:      parseInt(trainDays)      || 252,
      testDays:       parseInt(testDays)       || 63,
      commissionRate: parseFloat(commissionRate) / 100 || 0.001,
      slippage:       parseFloat(slippage)       / 100 || 0.001,
      useMarketFilter: useMarketFilter && !!marketConditions,
      marketConditions: marketConditions ?? undefined,
    };

    try {
      const inputs: Parameters<typeof runWalkForwardMultiple>[0] = [];
      let done = 0;

      for (const strategy of DEFAULT_STRATEGIES) {
        const buyRule = rules.find(r => r.id === strategy.buyRuleId);
        const sellRule = strategy.sellRuleId ? rules.find(r => r.id === strategy.sellRuleId) : undefined;
        if (!buyRule) { done++; setMultiProgress({ done, total: DEFAULT_STRATEGIES.length }); continue; }

        const chartData = await getOrFetchData(strategy.symbol);
        done++;
        setMultiProgress({ done, total: DEFAULT_STRATEGIES.length });

        if (!chartData) continue;

        inputs.push({
          symbol:       strategy.symbol,
          name:         strategy.name,
          data:         chartData,
          rule:         buyRule,
          sellRuleId:   sellRule?.id,
          takeProfit:   strategy.takeProfit / 100,
          trailingStop: strategy.trailingStop / 100,
          maxHoldDays:  strategy.maxHoldDays,
        });
      }

      const result = runWalkForwardMultiple(inputs, shared, rules);
      setMultiResult(result);
    } catch (e) {
      console.error('[walk-forward multi]', e);
      setLoadError('検証中にエラーが発生しました');
    } finally {
      setLoading(false);
      setMultiProgress(null);
    }
  }, [rules, trainDays, testDays, commissionRate, slippage, useMarketFilter, marketConditions, getOrFetchData]);

  // All-stocks aggregated mode (49 stocks)
  const handleRunAllStocks = useCallback(async () => {
    const buyRule = rules.find(r => r.id === buyRuleId);
    if (!buyRule) return;

    setLoading(true);
    setLoadError(null);
    setAggregatedResult(null);
    setMultiProgress({ done: 0, total: ALL_STOCKS.length });

    const shared = {
      trainDays:      parseInt(trainDays)      || 252,
      testDays:       parseInt(testDays)       || 63,
      commissionRate: parseFloat(commissionRate) / 100 || 0.001,
      slippage:       parseFloat(slippage)       / 100 || 0.001,
      useMarketFilter: useMarketFilter && !!marketConditions,
      marketConditions: marketConditions ?? undefined,
    };

    const tp   = parseFloat(takeProfit)   / 100 || 0.1;
    const tsp  = parseFloat(trailingStop) / 100 || 0.03;
    const mhd  = parseInt(maxHoldDays)    || 20;
    const sid  = sellRuleId || undefined;

    try {
      const inputs: Parameters<typeof runWalkForwardAggregated>[0] = [];
      let done = 0;

      for (const stock of ALL_STOCKS) {
        const chartData = await getOrFetchData(stock.value);
        done++;
        setMultiProgress({ done, total: ALL_STOCKS.length });
        if (!chartData) continue;

        inputs.push({
          symbol:      stock.value,
          name:        stock.label,
          data:        chartData,
          rule:        buyRule,
          sellRuleId:  sid,
          takeProfit:  tp,
          trailingStop: tsp,
          maxHoldDays: mhd,
        });
      }

      const result = runWalkForwardAggregated(inputs, shared, rules);
      setAggregatedResult(result);
    } catch (e) {
      console.error('[walk-forward all-stocks]', e);
      setLoadError('検証中にエラーが発生しました');
    } finally {
      setLoading(false);
      setMultiProgress(null);
    }
  }, [rules, buyRuleId, sellRuleId, trainDays, testDays, takeProfit, trailingStop, maxHoldDays,
      commissionRate, slippage, useMarketFilter, marketConditions, getOrFetchData]);

  const resetResults = () => {
    setWfResult(null);
    setMultiResult(null);
    setAggregatedResult(null);
    setLoadError(null);
  };

  const sharedParams = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500 block mb-1">学習期間（日）</label>
          <input type="number" value={trainDays} min={60} step={21}
            onChange={e => { setTrainDays(e.target.value); resetResults(); }}
            className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">検証期間（日）</label>
          <input type="number" value={testDays} min={21} step={21}
            onChange={e => { setTestDays(e.target.value); resetResults(); }}
            className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500 block mb-1">手数料（%）</label>
          <input type="number" value={commissionRate} min={0} step={0.05}
            onChange={e => { setCommissionRate(e.target.value); resetResults(); }}
            className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">スリッページ（%）</label>
          <input type="number" value={slippage} min={0} step={0.05}
            onChange={e => { setSlippage(e.target.value); resetResults(); }}
            className={inputCls} />
        </div>
      </div>
    </div>
  );

  const onRun = multiMode
    ? (allStocksMode ? handleRunAllStocks : handleRunMulti)
    : handleRunSingle;
  const runDisabled = loading || (!multiMode && !buyRuleId) || (multiMode && allStocksMode && !buyRuleId);

  return (
    <div className="space-y-5">

      {/* ─── 設定パネル ──────────────────────────────── */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 space-y-4">

        {/* ヘッダー行：モード切替 + データソーストグル */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => { setMultiMode(false); resetResults(); }}
              className={`text-[10px] px-3 py-1 rounded-md transition-colors font-medium ${
                !multiMode ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              単一銘柄
            </button>
            <button
              onClick={() => { setMultiMode(true); resetResults(); }}
              className={`text-[10px] px-3 py-1 rounded-md transition-colors font-medium ${
                multiMode ? 'bg-blue-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              複数銘柄同時検証
            </button>
          </div>

          <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => { setUseHistorical(false); dataCache.current.clear(); resetResults(); }}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                !useHistorical ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              モック
            </button>
            <button
              onClick={() => { setUseHistorical(true); dataCache.current.clear(); resetResults(); }}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                useHistorical ? 'bg-emerald-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              リアル
            </button>
          </div>
        </div>

        {/* ── 単一銘柄モード ── */}
        {!multiMode && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">対象銘柄</label>
                <select
                  value={selectedStockValue}
                  onChange={e => { setSelectedStockValue(e.target.value); resetResults(); dataCache.current.clear(); }}
                  className={inputCls}
                >
                  {ALL_STOCKS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}（{s.value}）</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">買いルール</label>
                <select value={buyRuleId} onChange={e => { setBuyRuleId(e.target.value); resetResults(); }} className={inputCls}>
                  {buyRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">売りルール（オプション）</label>
                <select value={sellRuleId} onChange={e => { setSellRuleId(e.target.value); resetResults(); }} className={inputCls}>
                  <option value="">自動（有効な売りルールをすべて使用）</option>
                  {sellRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">TP（%）</label>
                  <input type="number" value={takeProfit} min={0.5} step={0.5}
                    onChange={e => { setTakeProfit(e.target.value); resetResults(); }} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">TSP（%）</label>
                  <input type="number" value={trailingStop} min={0.5} step={0.5}
                    onChange={e => { setTrailingStop(e.target.value); resetResults(); }} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">最大保有日</label>
                  <input type="number" value={maxHoldDays} min={1} step={1}
                    onChange={e => { setMaxHoldDays(e.target.value); resetResults(); }} className={inputCls} />
                </div>
              </div>
            </div>
            {sharedParams}
          </>
        )}

        {/* ── 複数銘柄モード ── */}
        {multiMode && (
          <>
            {/* 対象銘柄サブトグル */}
            <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5 border border-slate-700 w-fit">
              <button
                onClick={() => { setAllStocksMode(false); resetResults(); }}
                className={`text-[10px] px-3 py-1 rounded-md transition-colors font-medium ${
                  !allStocksMode ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                ポートフォリオ（8銘柄）
              </button>
              <button
                onClick={() => { setAllStocksMode(true); resetResults(); }}
                className={`text-[10px] px-3 py-1 rounded-md transition-colors font-medium ${
                  allStocksMode ? 'bg-amber-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                全銘柄（{ALL_STOCKS.length}銘柄）
              </button>
            </div>

            {/* ポートフォリオ（8銘柄）モード */}
            {!allStocksMode && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">対象銘柄（ポートフォリオ戦略の8銘柄）</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {DEFAULT_STRATEGIES.map(s => {
                    const buyRule = rules.find(r => r.id === s.buyRuleId);
                    return (
                      <div key={s.symbol} className="bg-slate-900 rounded-lg px-2.5 py-2 border border-slate-800">
                        <p className="text-xs font-medium text-slate-300">{s.name}</p>
                        <p className="text-[10px] text-slate-600 truncate">{buyRule?.name ?? s.buyRuleId}</p>
                        <p className="text-[10px] text-slate-600">TP:{s.takeProfit}% TS:{s.trailingStop}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 全銘柄（49銘柄）モード */}
            {allStocksMode && (
              <div className="space-y-3">
                <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-amber-300">全{ALL_STOCKS.length}銘柄 一括ウォークフォワード検証</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    各ウィンドウで全銘柄の取引を合算 — 取引回数が増え統計的信頼性が向上します
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">買いルール（全銘柄共通）</label>
                    <select value={buyRuleId} onChange={e => { setBuyRuleId(e.target.value); resetResults(); }} className={inputCls}>
                      {buyRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">売りルール（オプション）</label>
                    <select value={sellRuleId} onChange={e => { setSellRuleId(e.target.value); resetResults(); }} className={inputCls}>
                      <option value="">自動（有効な売りルールをすべて使用）</option>
                      {sellRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">TP（%）</label>
                      <input type="number" value={takeProfit} min={0.5} step={0.5}
                        onChange={e => { setTakeProfit(e.target.value); resetResults(); }} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">TSP（%）</label>
                      <input type="number" value={trailingStop} min={0.5} step={0.5}
                        onChange={e => { setTrailingStop(e.target.value); resetResults(); }} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">最大保有日</label>
                      <input type="number" value={maxHoldDays} min={1} step={1}
                        onChange={e => { setMaxHoldDays(e.target.value); resetResults(); }} className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {sharedParams}
          </>
        )}

        {/* 相場環境フィルター */}
        <div className={`rounded-xl px-4 py-3 border transition-colors ${useMarketFilter ? 'bg-blue-950/20 border-blue-900/50' : 'bg-slate-900/40 border-slate-800/60'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-300">相場環境フィルター（日経平均）</p>
              <p className="text-[10px] text-slate-500 mt-0.5">弱気相場では買いシグナルを無効化します</p>
              {useMarketFilter && marketFilterLoading && (
                <p className="text-[10px] text-blue-400 mt-0.5 animate-pulse">日経平均データを取得中...</p>
              )}
              {useMarketFilter && !marketFilterLoading && marketConditions && (
                <p className="text-[10px] text-emerald-400 mt-0.5">✓ 日経平均データ読み込み完了</p>
              )}
              {useMarketFilter && !marketFilterLoading && !marketConditions && (
                <p className="text-[10px] text-amber-400 mt-0.5">⚠ N225データなし — python scripts/fetch_nikkei.py を実行してください</p>
              )}
            </div>
            <button
              onClick={() => { setUseMarketFilter(v => !v); resetResults(); }}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${useMarketFilter ? 'bg-blue-600' : 'bg-slate-700'}`}
              aria-label="相場環境フィルター切り替え"
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${useMarketFilter ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        {loadError && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
            {loadError}
          </p>
        )}

        {/* プログレスバー */}
        {loading && multiProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                {allStocksMode && multiMode
                  ? `全${ALL_STOCKS.length}銘柄データ取得・検証中...`
                  : 'データ取得・検証中...'}
              </span>
              <span className="font-mono">{multiProgress.done}/{multiProgress.total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(multiProgress.done / multiProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={onRun}
          disabled={runDisabled}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              検証実行中...
            </>
          ) : multiMode && allStocksMode ? (
            `全${ALL_STOCKS.length}銘柄ウォークフォワード検証実行`
          ) : multiMode ? (
            '複数銘柄ウォークフォワード検証実行'
          ) : (
            'ウォークフォワード検証実行'
          )}
        </button>
      </div>

      {/* ─── 単一銘柄 結果 ─────────────────────────────── */}
      {!multiMode && wfResult && (
        wfResult.windows.length === 0 ? (
          <div className="bg-slate-900/60 rounded-xl p-6 border border-slate-800/60 text-center">
            <p className="text-sm text-slate-400">データが不足しています。学習期間・検証期間を短くするか、より長いデータ期間を選択してください。</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 flex justify-center">
              <div className="w-full max-w-sm">
                <ConsistencyGauge value={wfResult.consistency} isReliable={wfResult.isReliable} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl p-3 border bg-slate-900 border-slate-800">
                <p className="text-[10px] text-slate-500 mb-1">検証ウィンドウ数</p>
                <p className="text-sm font-bold font-mono text-slate-200">{wfResult.windows.length}個</p>
              </div>
              <div className={`rounded-xl p-3 border ${wfResult.avgTestReturn >= 0 ? 'bg-emerald-950/40 border-emerald-900/60' : 'bg-red-950/40 border-red-900/60'}`}>
                <p className="text-[10px] text-slate-500 mb-1">平均検証リターン</p>
                <p className={`text-sm font-bold font-mono ${wfResult.avgTestReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {wfResult.avgTestReturn >= 0 ? '+' : ''}{wfResult.avgTestReturn}%
                </p>
              </div>
              <div className="rounded-xl p-3 border bg-slate-900 border-slate-800">
                <p className="text-[10px] text-slate-500 mb-1">平均シャープ比</p>
                <p className={`text-sm font-bold font-mono ${wfResult.avgTestSharpe > 0 ? 'text-slate-200' : 'text-red-400'}`}>
                  {wfResult.avgTestSharpe.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl p-3 border bg-slate-900 border-slate-800">
                <p className="text-[10px] text-slate-500 mb-1">平均勝率</p>
                <p className={`text-sm font-bold font-mono ${wfResult.avgTestWinRate >= 50 ? 'text-slate-200' : 'text-red-400'}`}>
                  {wfResult.avgTestWinRate}%
                </p>
              </div>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400">ウィンドウ別リターン（学習 vs 検証）</p>
                <span className="text-[10px] text-slate-600 flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500/50 border border-red-500" />
                  乖離ウィンドウ
                </span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={wfResult.windows.map(w => ({
                    window: `W${w.windowIndex}`,
                    testLabel: w.testStart,
                    train: w.trainResult.totalReturnPct,
                    test:  w.testResult.totalReturnPct,
                    divergent: isDivergent(w),
                  }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="window" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${v}%`} width={42} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: unknown, name: unknown) => {
                      const num = Number(v);
                      return [`${num >= 0 ? '+' : ''}${num.toFixed(2)}%`, name === 'train' ? '学習期間' : '検証期間'];
                    }}
                    labelFormatter={(label, payload) => {
                      const p = payload?.[0]?.payload;
                      return p ? `${label} 検証: ${p.testLabel}${p.divergent ? ' ⚠ 乖離' : ''}` : label;
                    }}
                  />
                  <Legend formatter={v => v === 'train' ? '学習期間' : '検証期間'} />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="train" stroke="#3b82f6" strokeWidth={2}
                    dot={{ r: 3, fill: '#3b82f6', stroke: '#0f172a', strokeWidth: 1 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="test" stroke="#10b981" strokeWidth={2}
                    strokeDasharray="5 3" dot={<TestDot />} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800">
                <p className="text-xs font-semibold text-slate-400">ウィンドウ別詳細</p>
              </div>
              <div className="overflow-x-auto">
                <WindowsDetail windows={wfResult.windows} />
              </div>
            </div>
            <VerdictSection result={wfResult} />
          </div>
        )
      )}

      {/* ─── ポートフォリオ（8銘柄）結果 ───────────────────── */}
      {multiMode && !allStocksMode && multiResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-xl p-4 border flex flex-col items-center justify-center gap-1 ${
              multiResult.reliableCount >= 3 ? 'bg-emerald-950/30 border-emerald-900/60'
              : multiResult.reliableCount >= 1 ? 'bg-amber-950/20 border-amber-900/40'
              : 'bg-red-950/20 border-red-900/40'
            }`}>
              <span className={`text-2xl font-mono font-bold ${
                multiResult.reliableCount >= 3 ? 'text-emerald-400'
                : multiResult.reliableCount >= 1 ? 'text-amber-400'
                : 'text-red-400'
              }`}>
                {multiResult.reliableCount}/{multiResult.stockResults.length}
              </span>
              <span className="text-[10px] text-slate-500">信頼できる銘柄数</span>
            </div>
            <div className="rounded-xl p-4 border bg-slate-900 border-slate-800 flex flex-col items-center justify-center gap-1">
              <span
                className="text-xl font-mono font-bold"
                style={{ color: consistencyColor(multiResult.avgConsistency) }}
              >
                {multiResult.avgConsistency.toFixed(3)}
              </span>
              <span className="text-[10px] text-slate-500">平均一貫性スコア</span>
            </div>
            <div className={`rounded-xl p-4 border flex flex-col items-center justify-center gap-1 ${
              multiResult.avgTestReturn >= 0
                ? 'bg-emerald-950/30 border-emerald-900/60'
                : 'bg-red-950/20 border-red-900/40'
            }`}>
              <span className={`text-xl font-mono font-bold ${multiResult.avgTestReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {multiResult.avgTestReturn >= 0 ? '+' : ''}{multiResult.avgTestReturn}%
              </span>
              <span className="text-[10px] text-slate-500">平均検証リターン</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400">銘柄別結果</p>
            {multiResult.stockResults
              .slice()
              .sort((a, b) => b.consistencyScore - a.consistencyScore)
              .map(r => (
                <StockResultCard
                  key={r.symbol}
                  result={r}
                  expanded={expandedSymbol === r.symbol}
                  onToggle={() => setExpandedSymbol(prev => prev === r.symbol ? null : r.symbol)}
                />
              ))}
          </div>

          <MultiVerdictSection result={multiResult} />
        </div>
      )}

      {/* ─── 全銘柄集計結果 ─────────────────────────────── */}
      {multiMode && allStocksMode && aggregatedResult && (
        aggregatedResult.windows.length === 0 ? (
          <div className="bg-slate-900/60 rounded-xl p-6 border border-slate-800/60 text-center">
            <p className="text-sm text-slate-400">ウィンドウを生成できませんでした。学習期間・検証期間を短くするか、リアルデータに切り替えてください。</p>
          </div>
        ) : (
          <AggregatedResultSection result={aggregatedResult} />
        )
      )}

      <p className="text-[10px] text-slate-700 text-center">
        ※ 過去の検証結果は将来の収益を保証するものではありません。投資は自己責任でお願いします。
      </p>
    </div>
  );
}
