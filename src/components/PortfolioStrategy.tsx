'use client';

import { useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { DEFAULT_STRATEGIES, type StockStrategy } from '@/lib/portfolioStrategy';
import { DEFAULT_RULES } from '@/lib/ruleEngine';
import type { PortfolioBacktestResponse } from '@/app/api/portfolio-backtest/route';
import type { OptimizeSuggestion } from '@/app/api/optimize/route';

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a', border: '1px solid #1e293b',
  color: '#e2e8f0', borderRadius: '10px', fontSize: '11px',
};

const selectCls = 'bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-slate-500 w-full';
const numInputCls = 'bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] text-slate-200 text-center focus:outline-none focus:border-slate-500 w-14';

const buyRules  = DEFAULT_RULES.filter(r => r.type === 'buy');
const sellRules = DEFAULT_RULES.filter(r => r.type === 'sell');

function SummaryCard({ label, value, sub, positive, highlight }: {
  label: string; value: string; sub?: string; positive: boolean; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 border ${
      highlight
        ? positive ? 'bg-emerald-950/40 border-emerald-900/60' : 'bg-red-950/40 border-red-900/60'
        : 'bg-slate-900 border-slate-800'
    }`}>
      <p className="text-[10px] text-slate-500 mb-1">{label}</p>
      <p className={`text-sm font-bold font-mono leading-none ${
        highlight
          ? positive ? 'text-emerald-400' : 'text-red-400'
          : positive ? 'text-slate-200' : 'text-red-400'
      }`}>{value}</p>
      {sub && (
        <p className={`text-[10px] font-mono mt-0.5 ${positive ? 'text-emerald-500' : 'text-red-500'}`}>{sub}</p>
      )}
    </div>
  );
}

export default function PortfolioStrategy() {
  const [strategies, setStrategies] = useState<StockStrategy[]>(() =>
    DEFAULT_STRATEGIES.map(s => ({ ...s })),
  );
  const [useHistorical, setUseHistorical] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<PortfolioBacktestResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<OptimizeSuggestion | null>(null);

  const updateStrategy = useCallback((idx: number, patch: Partial<StockStrategy>) => {
    setStrategies(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
    setResponse(null);
    setAiSuggestion(null);
  }, []);

  const resetStrategies = useCallback(() => {
    setStrategies(DEFAULT_STRATEGIES.map(s => ({ ...s })));
    setResponse(null);
    setAiSuggestion(null);
  }, []);

  const handleRun = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    setAiSuggestion(null);
    try {
      const res = await fetch('/api/portfolio-backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategies, useHistorical }),
      });
      if (!res.ok) throw new Error('バックテストに失敗しました');
      setResponse(await res.json() as PortfolioBacktestResponse);
    } catch (e) {
      console.error('[portfolio]', e);
    } finally {
      setLoading(false);
    }
  }, [strategies, useHistorical]);

  const handleAiOptimize = useCallback(async () => {
    if (!response) return;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const primaryRule = DEFAULT_RULES.find(r => r.id === 'preset-ai-rsi-enhanced')!;
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule: primaryRule,
          results: response.results.map(r => r.result),
          stockName: `ポートフォリオ（${response.results.length}銘柄）`,
          currentConfig: {
            takeProfit: '10',
            trailingStop: '3',
            maxHoldDays: '20',
          },
        }),
      });
      if (res.ok) setAiSuggestion(await res.json() as OptimizeSuggestion);
    } catch (e) {
      console.error('[portfolio ai]', e);
    } finally {
      setAiLoading(false);
    }
  }, [response]);

  const applyAiRecommendation = useCallback((rec: OptimizeSuggestion['recommendations']) => {
    setStrategies(prev => prev.map(s => ({
      ...s,
      takeProfit:   rec.takeProfit,
      trailingStop: rec.trailingStop,
      maxHoldDays:  rec.maxHoldDays,
    })));
    setAiSuggestion(null);
    setResponse(null);
  }, []);

  const chartData = response?.results.map(r => ({
    name:     r.name.length > 6 ? r.name.slice(0, 6) + '…' : r.name,
    fullName: r.name,
    return:   r.result.totalReturnPct,
  })) ?? [];

  return (
    <div className="space-y-5">

      {/* ─── ヘッダー ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[10px] text-slate-500 mt-0.5">銘柄ごとに最適なルールを割り当てて総合パフォーマンスを計測</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => { setUseHistorical(false); setResponse(null); }}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                !useHistorical ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              モック
            </button>
            <button
              onClick={() => { setUseHistorical(true); setResponse(null); }}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                useHistorical ? 'bg-emerald-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              リアル5年
            </button>
          </div>
          <button
            onClick={resetStrategies}
            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
          >
            リセット
          </button>
        </div>
      </div>

      {/* ─── 戦略テーブル ───────────────────────────────── */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800/60 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400">銘柄別戦略設定</p>
          <p className="text-[10px] text-slate-600">各行のパラメータを直接編集できます</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800/60 text-slate-500 bg-slate-900/40">
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">銘柄</th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">買いルール</th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">売りルール</th>
                <th className="px-3 py-2.5 text-center font-medium whitespace-nowrap">TP%</th>
                <th className="px-3 py-2.5 text-center font-medium whitespace-nowrap">TSP%</th>
                <th className="px-3 py-2.5 text-center font-medium whitespace-nowrap">保有日</th>
                <th className="px-3 py-2.5 text-left font-medium min-w-[180px]">採用理由</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((s, idx) => {
                const btResult = response?.results.find(r => r.symbol === s.symbol)?.result;
                const isPos = btResult ? btResult.totalReturnPct >= 0 : null;
                return (
                  <tr key={s.symbol} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isPos !== null && (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPos ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        )}
                        <div>
                          <p className="font-semibold text-slate-200">{s.name}</p>
                          <p className="text-[9px] text-slate-600 font-mono">{s.symbol}</p>
                        </div>
                        {btResult && (
                          <span className={`ml-1 text-[10px] font-mono font-bold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPos ? '+' : ''}{btResult.totalReturnPct}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={s.buyRuleId}
                        onChange={e => updateStrategy(idx, { buyRuleId: e.target.value })}
                        className={selectCls}
                        style={{ minWidth: '130px' }}
                      >
                        {buyRules.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={s.sellRuleId ?? ''}
                        onChange={e => updateStrategy(idx, { sellRuleId: e.target.value || undefined })}
                        className={selectCls}
                        style={{ minWidth: '120px' }}
                      >
                        <option value="">自動</option>
                        {sellRules.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="number"
                        value={s.takeProfit}
                        min={0.5}
                        step={0.5}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v > 0) updateStrategy(idx, { takeProfit: v });
                        }}
                        className={numInputCls}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="number"
                        value={s.trailingStop}
                        min={0.5}
                        step={0.5}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v > 0) updateStrategy(idx, { trailingStop: v });
                        }}
                        className={numInputCls}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="number"
                        value={s.maxHoldDays}
                        min={1}
                        step={1}
                        onChange={e => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v > 0) updateStrategy(idx, { maxHoldDays: v });
                        }}
                        className={numInputCls}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-slate-500 leading-relaxed">{s.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 実行ボタン ─────────────────────────────────── */}
      <button
        onClick={handleRun}
        disabled={loading}
        className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            バックテスト実行中...
          </>
        ) : (
          'ポートフォリオバックテスト実行'
        )}
      </button>

      {/* ─── 結果 ────────────────────────────────────────── */}
      {response && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryCard
              label="ポートフォリオ平均リターン"
              value={`${response.avgReturn >= 0 ? '+' : ''}${response.avgReturn}%`}
              positive={response.avgReturn >= 0}
              highlight
            />
            <SummaryCard
              label="平均シャープ比"
              value={response.avgSharpe.toFixed(2)}
              positive={response.avgSharpe > 0}
            />
            <SummaryCard
              label="平均勝率"
              value={`${response.avgWinRate}%`}
              positive={response.avgWinRate >= 50}
            />
            <SummaryCard
              label="プラス / マイナス銘柄"
              value={`${response.plusCount} / ${response.minusCount}`}
              sub={`${response.results.length}銘柄中`}
              positive={response.plusCount > response.minusCount}
            />
          </div>

          {/* 棒グラフ：銘柄別リターン比較 */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <p className="text-xs font-semibold text-slate-400 mb-3">銘柄別リターン比較</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={v => `${v}%`}
                  width={40}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: unknown) => {
                    const num = Number(v);
                    return [`${num >= 0 ? '+' : ''}${num}%`, 'リターン'];
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
                <Bar dataKey="return" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.return >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 詳細テーブル */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800">
              <p className="text-xs font-semibold text-slate-400">銘柄別詳細結果</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="px-4 py-2.5 text-left font-medium">銘柄</th>
                    <th className="px-4 py-2.5 text-right font-medium">リターン</th>
                    <th className="px-4 py-2.5 text-right font-medium">勝率</th>
                    <th className="px-4 py-2.5 text-right font-medium">シャープ</th>
                    <th className="px-4 py-2.5 text-right font-medium">最大DD</th>
                    <th className="px-4 py-2.5 text-right font-medium">取引回数</th>
                  </tr>
                </thead>
                <tbody>
                  {[...response.results]
                    .sort((a, b) => b.result.totalReturnPct - a.result.totalReturnPct)
                    .map(({ symbol, name, result: r }) => {
                      const pos = r.totalReturnPct >= 0;
                      return (
                        <tr key={symbol} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-slate-200">{name}</p>
                            <p className="text-[9px] text-slate-600 font-mono">{symbol}</p>
                          </td>
                          <td className={`px-4 py-2.5 text-right font-mono font-bold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pos ? '+' : ''}{r.totalReturnPct}%
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-300">{r.winRate}%</td>
                          <td className={`px-4 py-2.5 text-right font-mono ${r.sharpeRatio > 0 ? 'text-slate-300' : 'text-red-400'}`}>
                            {r.sharpeRatio}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-400">-{r.maxDrawdown}%</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-400">{r.totalTrades}回</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI最適化 */}
          <div className="space-y-3">
            <button
              onClick={handleAiOptimize}
              disabled={aiLoading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-slate-200 border border-slate-600 bg-slate-800/60 hover:bg-slate-700/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {aiLoading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                  AI分析中...
                </>
              ) : (
                <>✨ AIにポートフォリオ最適化を提案してもらう</>
              )}
            </button>

            {aiSuggestion && (
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-600 space-y-4">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">AI最適化提案</p>

                <div>
                  <p className="text-[10px] text-slate-500 mb-1">現状分析</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{aiSuggestion.analysis}</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 mb-2">推奨パラメータ（全銘柄一括適用）</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-700">
                      <p className="text-[10px] text-slate-500">テイクプロフィット</p>
                      <p className="text-base font-mono font-bold text-emerald-400">{aiSuggestion.recommendations.takeProfit}%</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-700">
                      <p className="text-[10px] text-slate-500">トレイリングストップ</p>
                      <p className="text-base font-mono font-bold text-amber-400">{aiSuggestion.recommendations.trailingStop}%</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-700">
                      <p className="text-[10px] text-slate-500">最大保有日数</p>
                      <p className="text-base font-mono font-bold text-blue-400">{aiSuggestion.recommendations.maxHoldDays}日</p>
                    </div>
                  </div>
                  <button
                    onClick={() => applyAiRecommendation(aiSuggestion.recommendations)}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-600 hover:bg-slate-500 transition-colors"
                  >
                    全銘柄に一括適用する
                  </button>
                </div>

                {aiSuggestion.recommendations.conditionAdjustments.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">条件の調整案</p>
                    <ul className="space-y-1">
                      {aiSuggestion.recommendations.conditionAdjustments.map((adj, i) => (
                        <li key={i} className="text-xs text-slate-400 flex gap-2">
                          <span className="text-slate-600 shrink-0">•</span>
                          {adj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-slate-500 mb-1">改善予測</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{aiSuggestion.expectedImprovement}</p>
                </div>

                <p className="text-[10px] text-slate-700">
                  ※ AI提案はあくまで参考情報です。投資判断は自己責任でお願いします。
                </p>
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-[10px] text-slate-700 text-center">
        ※ 過去の結果は将来を保証しません。ポートフォリオ戦略は参考情報であり、投資助言ではありません。
      </p>
    </div>
  );
}
