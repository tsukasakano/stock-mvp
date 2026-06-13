'use client';

import { useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { ALL_STOCKS } from '@/lib/stocks';
import { loadRules } from '@/lib/ruleEngine';
import { buildChartData } from '@/lib/indicators';
import { fetchHistoricalData } from '@/lib/historicalData';
import { generateMockData } from '@/lib/mockData';
import { runWalkForward, type WalkForwardResult, type WalkForwardWindow } from '@/lib/walkForward';
import type { TradeRule } from '@/types/stock';

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

// Custom dot for the test line — red when window is divergent
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

function ConsistencyGauge({ value, isReliable }: { value: number; isReliable: boolean }) {
  const pct = Math.round(((value + 1) / 2) * 100);
  const color = value >= 0.7 ? '#10b981' : value >= 0.4 ? '#f59e0b' : '#ef4444';
  const label = value >= 0.7 ? '過学習なし' : value >= 0.4 ? '要注意' : '過学習の可能性';

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {/* Large score */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-slate-500 uppercase tracking-widest">一貫性スコア</span>
        <span
          className="text-5xl font-mono font-bold tabular-nums leading-none"
          style={{ color }}
        >
          {value.toFixed(2)}
        </span>
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full mt-1"
          style={{ color, background: `${color}20`, border: `1px solid ${color}50` }}
        >
          {label}
        </span>
        {isReliable && (
          <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-full px-2.5 py-0.5 font-semibold mt-0.5">
            ✓ 信頼性 HIGH
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="w-full max-w-xs space-y-1">
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden relative">
          {/* Zero marker */}
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
        {/* Threshold markers */}
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

function VerdictSection({ result }: { result: WalkForwardResult }) {
  const { consistency, isReliable, avgTestReturn, avgTestSharpe, avgTestWinRate, windows } = result;
  const divergentCount = windows.filter(isDivergent).length;
  const isProfit = avgTestReturn > 0;

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
  if (!isProfit) suggestions.push('平均検証リターンがマイナス — 買いルールの条件閾値を見直す');

  const isGood = isReliable && isProfit && avgTestSharpe >= 0.5;

  return (
    <div className={`rounded-xl p-4 border ${isGood ? 'bg-emerald-950/30 border-emerald-900/60' : 'bg-amber-950/20 border-amber-900/40'}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5">{isGood ? '✅' : '⚠️'}</span>
        <div className="space-y-2 flex-1">
          <p className={`text-sm font-bold ${isGood ? 'text-emerald-300' : 'text-amber-300'}`}>
            {isGood
              ? 'このルールは実用的です'
              : consistency < 0.4
              ? '過学習の可能性があります'
              : 'このルールは改善の余地があります'}
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            一貫性スコア {consistency.toFixed(3)}
            {' / '}平均検証リターン {avgTestReturn >= 0 ? '+' : ''}{avgTestReturn}%
            {' / '}平均シャープ比 {avgTestSharpe.toFixed(2)}
            {' / '}勝率 {avgTestWinRate}%
          </p>
          {suggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">改善提案</p>
              <ul className="space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                    <span className="text-amber-500 flex-shrink-0">•</span>
                    {s}
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

export default function WalkForward() {
  const [rules] = useState<TradeRule[]>(() => loadRules());
  const [selectedStockValue, setSelectedStockValue] = useState(ALL_STOCKS[0]?.value ?? '');
  const [useHistorical, setUseHistorical] = useState(false);
  const [buyRuleId, setBuyRuleId] = useState(() => rules.find(r => r.type === 'buy')?.id ?? '');
  const [sellRuleId, setSellRuleId] = useState('');
  const [trainDays, setTrainDays] = useState('252');
  const [testDays, setTestDays] = useState('63');
  const [takeProfit, setTakeProfit] = useState('10');
  const [trailingStop, setTrailingStop] = useState('3');
  const [maxHoldDays, setMaxHoldDays] = useState('20');
  const [commissionRate, setCommissionRate] = useState('0.1');
  const [slippage, setSlippage] = useState('0.1');

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wfResult, setWfResult] = useState<WalkForwardResult | null>(null);

  const dataCache = useRef<Map<string, ReturnType<typeof buildChartData>>>(new Map());

  const buyRules  = rules.filter(r => r.type === 'buy');
  const sellRules = rules.filter(r => r.type === 'sell');
  const selectedStock = ALL_STOCKS.find(s => s.value === selectedStockValue) ?? ALL_STOCKS[0];

  const handleRun = useCallback(async () => {
    const buyRule = rules.find(r => r.id === buyRuleId);
    if (!buyRule) return;

    setLoading(true);
    setLoadError(null);
    setWfResult(null);

    try {
      let chartData = dataCache.current.get(`${selectedStockValue}-${useHistorical}`);

      if (!chartData) {
        if (useHistorical) {
          const raw = await fetchHistoricalData(`${selectedStockValue}.T`);
          if (!raw) {
            setLoadError('リアルデータが見つかりません。データを更新してください。');
            return;
          }
          chartData = buildChartData(raw);
        } else {
          chartData = buildChartData(generateMockData(selectedStock));
        }
        dataCache.current.set(`${selectedStockValue}-${useHistorical}`, chartData);
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
      });

      setWfResult(result);
    } catch (e) {
      console.error('[walk-forward]', e);
      setLoadError('検証中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [rules, buyRuleId, sellRuleId, selectedStockValue, selectedStock, useHistorical, trainDays, testDays, takeProfit, trailingStop, maxHoldDays, commissionRate, slippage]);

  const lineData = wfResult?.windows.map(w => ({
    window: `W${w.windowIndex}`,
    testLabel: w.testStart,
    train: w.trainResult.totalReturnPct,
    test:  w.testResult.totalReturnPct,
    divergent: isDivergent(w),
  })) ?? [];

  return (
    <div className="space-y-5">

      {/* ─── 設定パネル ──────────────────────────────── */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ウォークフォワード設定</p>
          <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => { setUseHistorical(false); setWfResult(null); }}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                !useHistorical ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              モック
            </button>
            <button
              onClick={() => { setUseHistorical(true); setWfResult(null); }}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                useHistorical ? 'bg-emerald-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              リアル
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">対象銘柄</label>
            <select
              value={selectedStockValue}
              onChange={e => { setSelectedStockValue(e.target.value); setWfResult(null); dataCache.current.clear(); }}
              className={inputCls}
            >
              {ALL_STOCKS.map(s => (
                <option key={s.value} value={s.value}>{s.label}（{s.value}）</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">買いルール</label>
            <select value={buyRuleId} onChange={e => { setBuyRuleId(e.target.value); setWfResult(null); }} className={inputCls}>
              {buyRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">売りルール（オプション）</label>
            <select value={sellRuleId} onChange={e => { setSellRuleId(e.target.value); setWfResult(null); }} className={inputCls}>
              <option value="">自動（有効な売りルールをすべて使用）</option>
              {sellRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 block mb-1">学習期間（日）</label>
              <input type="number" value={trainDays} min={60} step={21}
                onChange={e => { setTrainDays(e.target.value); setWfResult(null); }}
                className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">検証期間（日）</label>
              <input type="number" value={testDays} min={21} step={21}
                onChange={e => { setTestDays(e.target.value); setWfResult(null); }}
                className={inputCls} />
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">パラメータ</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'TP（%）',         val: takeProfit,    set: setTakeProfit,    min: 0.5, step: 0.5 },
              { label: 'TSP（%）',        val: trailingStop,  set: setTrailingStop,  min: 0.5, step: 0.5 },
              { label: '最大保有日',       val: maxHoldDays,   set: setMaxHoldDays,   min: 1,   step: 1   },
              { label: '手数料（%）',      val: commissionRate,set: setCommissionRate,min: 0,   step: 0.05},
              { label: 'スリッページ（%）', val: slippage,      set: setSlippage,      min: 0,   step: 0.05},
            ].map(({ label, val, set, min, step }) => (
              <div key={label}>
                <label className="text-xs text-slate-500 block mb-1">{label}</label>
                <input type="number" value={val} min={min} step={step}
                  onChange={e => { set(e.target.value); setWfResult(null); }}
                  className={inputCls} />
              </div>
            ))}
          </div>
        </div>

        {loadError && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
            {loadError}
          </p>
        )}

        <button
          onClick={handleRun}
          disabled={loading || !buyRuleId}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              検証実行中...
            </>
          ) : (
            'ウォークフォワード検証実行'
          )}
        </button>
      </div>

      {/* ─── 結果 ────────────────────────────────────────── */}
      {wfResult && (
        wfResult.windows.length === 0 ? (
          <div className="bg-slate-900/60 rounded-xl p-6 border border-slate-800/60 text-center">
            <p className="text-sm text-slate-400">データが不足しています。学習期間・検証期間を短くするか、より長いデータ期間を選択してください。</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ─── 大型一貫性ゲージ ─── */}
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 flex justify-center">
              <div className="w-full max-w-sm">
                <ConsistencyGauge value={wfResult.consistency} isReliable={wfResult.isReliable} />
              </div>
            </div>

            {/* ─── サマリーカード ─── */}
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

            {/* ─── 乖離ハイライトチャート ─── */}
            {lineData.length > 0 && (
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-400">ウィンドウ別リターン（学習 vs 検証）</p>
                  <span className="text-[10px] text-slate-600 flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500/50 border border-red-500" />
                    乖離ウィンドウ（学習＋・検証−）
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={lineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                        const div = p?.divergent ? ' ⚠ 乖離' : '';
                        return p ? `${label} 検証開始: ${p.testLabel}${div}` : label;
                      }}
                    />
                    <Legend formatter={v => v === 'train' ? '学習期間' : '検証期間'} />
                    <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
                    <Line
                      type="monotone"
                      dataKey="train"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#3b82f6', stroke: '#0f172a', strokeWidth: 1 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="test"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={<TestDot />}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ─── ウィンドウ別詳細テーブル ─── */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800">
                <p className="text-xs font-semibold text-slate-400">ウィンドウ別詳細</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">学習期間</th>
                      <th className="px-3 py-2 text-left font-medium">検証期間</th>
                      <th className="px-3 py-2 text-right font-medium">学習R</th>
                      <th className="px-3 py-2 text-right font-medium">検証R</th>
                      <th className="px-3 py-2 text-right font-medium">勝率</th>
                      <th className="px-3 py-2 text-right font-medium">Sharpe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wfResult.windows.map(w => {
                      const testPos  = w.testResult.totalReturnPct >= 0;
                      const trainPos = w.trainResult.totalReturnPct >= 0;
                      const div      = isDivergent(w);
                      return (
                        <tr
                          key={w.windowIndex}
                          className={`border-b border-slate-800/60 transition-colors ${
                            div ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="px-3 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                            W{w.windowIndex}
                            {div && <span className="ml-1 text-red-500">⚠</span>}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-500 text-[10px] whitespace-nowrap">
                            {w.trainStart} 〜 {fmtDate(w.trainEnd)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-500 text-[10px] whitespace-nowrap">
                            {w.testStart} 〜 {fmtDate(w.testEnd)}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono ${trainPos ? 'text-blue-400' : 'text-red-400'}`}>
                            {trainPos ? '+' : ''}{w.trainResult.totalReturnPct}%
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-semibold ${testPos ? 'text-emerald-400' : 'text-red-400'}`}>
                            {testPos ? '+' : ''}{w.testResult.totalReturnPct}%
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono ${w.testResult.winRate >= 50 ? 'text-slate-300' : 'text-amber-400'}`}>
                            {w.testResult.winRate}%
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono ${w.testResult.sharpeRatio > 0 ? 'text-slate-300' : 'text-red-400'}`}>
                            {w.testResult.sharpeRatio}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─── 総合判定 ─── */}
            <VerdictSection result={wfResult} />

          </div>
        )
      )}

      <p className="text-[10px] text-slate-700 text-center">
        ※ ウォークフォワード検証は過学習の有無を確認するための参考指標です。将来の収益を保証するものではありません。
      </p>
    </div>
  );
}
