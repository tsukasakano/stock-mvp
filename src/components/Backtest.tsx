'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { ChartDataPoint, StockOption, TradeRule } from '@/types/stock';
import { STOCKS, ALL_STOCKS } from '@/lib/stocks';
import { loadRules } from '@/lib/ruleEngine';
import { buildChartData } from '@/lib/indicators';
import { fetchStockData } from '@/lib/api';
import { fetchHistoricalData, filterByPeriod, type RealPeriod } from '@/lib/historicalData';
import {
  runBacktest, runBacktestMultiple,
  type BacktestResult, type ExitReason, type StockBacktestResult,
} from '@/lib/backtest';
import type { OptimizeSuggestion } from '@/app/api/optimize/route';

interface Props {
  data: ChartDataPoint[];
  stock: StockOption;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a', border: '1px solid #1e293b',
  color: '#e2e8f0', borderRadius: '10px', fontSize: '12px',
};

const EXIT_REASON_LABEL: Record<ExitReason, string> = {
  takeProfit: '利確', trailingStop: 'TStop',
  maxHoldDays: '期間満了', ruleExit: 'ルール', periodEnd: '期間終了',
};

const EXIT_REASON_STYLE: Record<ExitReason, string> = {
  takeProfit:   'bg-emerald-900/50 text-emerald-400 border-emerald-800/60',
  trailingStop: 'bg-amber-900/50 text-amber-400 border-amber-800/60',
  maxHoldDays:  'bg-blue-900/50 text-blue-400 border-blue-800/60',
  ruleExit:     'bg-slate-800 text-slate-400 border-slate-700',
  periodEnd:    'bg-slate-800/50 text-slate-600 border-slate-700/50',
};

const inputCls = 'bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500';

// ─── Helper components ────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const p = iso.split('-');
  return `${parseInt(p[1])}/${parseInt(p[2])}`;
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1">
      <span className="text-slate-600 text-[9px] cursor-help select-none">(?)</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 p-2 bg-slate-800 border border-slate-700 rounded-lg text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none shadow-xl">
        {text}
      </span>
    </span>
  );
}

function SummaryCard({
  label, value, sub, positive, highlight,
}: {
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
        <p className={`text-[10px] font-mono mt-0.5 ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function StockCard({ sr }: { sr: StockBacktestResult }) {
  const r = sr.result;
  const pos = r.totalReturn >= 0;
  return (
    <div
      className="rounded-xl p-3.5 border bg-slate-900/60"
      style={{ borderColor: sr.color + '50' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sr.color }} />
        <p className="text-xs font-semibold text-slate-200 truncate">{sr.stockLabel}</p>
      </div>
      <p className={`text-xl font-mono font-bold leading-none mb-2 ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
        {pos ? '+' : ''}{r.totalReturnPct}%
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <span className="text-slate-500">勝率 <span className="text-slate-300 font-medium">{r.winRate}%</span></span>
        <span className="text-slate-500">シャープ <span className="text-slate-300 font-medium">{r.sharpeRatio}</span></span>
        <span className="text-slate-500">取引 <span className="text-slate-300 font-medium">{r.totalTrades}回</span></span>
        <span className="text-slate-500">最大DD <span className="text-slate-300 font-medium">-{r.maxDrawdown}%</span></span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Backtest({ data, stock }: Props) {
  const [rules] = useState<TradeRule[]>(() => loadRules());
  const [selectedRuleId, setSelectedRuleId] = useState<string>(rules[0]?.id ?? '');
  const [sellRuleId, setSellRuleId] = useState<string>('');
  const [initialCapital, setInitialCapital] = useState(1_000_000);
  const [positionSize, setPositionSize] = useState(50);
  const [takeProfit, setTakeProfit] = useState('5');
  const [trailingStop, setTrailingStop] = useState('3');
  const [maxHoldDays, setMaxHoldDays] = useState('20');

  type DataPeriod = 'mock' | RealPeriod;
  const [dataSourceMode, setDataSourceMode] = useState<DataPeriod>('mock');
  const [realAllData, setRealAllData] = useState<ChartDataPoint[]>([]);
  const [realDataLoading, setRealDataLoading] = useState(false);
  const [realDataError, setRealDataError] = useState<string | null>(null);
  const realDataFor = useRef<string | null>(null);

  const [multiMode, setMultiMode] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [multiResults, setMultiResults] = useState<StockBacktestResult[]>([]);
  const [sortBy, setSortBy] = useState<'return' | 'sharpe' | 'winrate'>('return');
  const [showPlusOnly, setShowPlusOnly] = useState(false);
  const [multiLoading, setMultiLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<OptimizeSuggestion | null>(null);

  // リアルデータ取得（銘柄変更 or モード切替時のみ再fetch）
  useEffect(() => {
    if (dataSourceMode === 'mock') return;
    if (realDataFor.current === stock.value) return; // already loaded for this stock
    let cancelled = false;
    setRealDataLoading(true);
    setRealDataError(null);
    setRealAllData([]);
    realDataFor.current = stock.value;
    fetchHistoricalData(`${stock.value}.T`)
      .then(raw => {
        if (cancelled) return;
        if (!raw) {
          setRealDataError('リアルデータが見つかりません。fetch_historical.py を実行してください。');
          realDataFor.current = null;
          return;
        }
        setRealAllData(buildChartData(raw));
      })
      .finally(() => { if (!cancelled) setRealDataLoading(false); });
    return () => { cancelled = true; };
  }, [dataSourceMode, stock.value]);

  // モード・銘柄変更時は結果をクリア
  useEffect(() => { setResult(null); setMultiResults([]); setAiSuggestion(null); }, [data, stock]);
  useEffect(() => { setResult(null); setMultiResults([]); setAiSuggestion(null); }, [multiMode]);
  useEffect(() => { setResult(null); setMultiResults([]); setAiSuggestion(null); }, [dataSourceMode]);

  const isRealMode = dataSourceMode !== 'mock';

  const activeData = useMemo(() => {
    if (!isRealMode) return data;
    if (realAllData.length === 0) return [];
    if (dataSourceMode === 'real-5y') return realAllData;
    return filterByPeriod(realAllData, dataSourceMode);
  }, [isRealMode, dataSourceMode, data, realAllData]);

  const baseConfig = useCallback(() => {
    const rule = rules.find(r => r.id === selectedRuleId);
    if (!rule) return null;
    return {
      rule,
      initialCapital,
      positionSize: positionSize / 100,
      takeProfit:   takeProfit   !== '' ? parseFloat(takeProfit)   / 100 : undefined,
      trailingStop: trailingStop !== '' ? parseFloat(trailingStop) / 100 : undefined,
      maxHoldDays:  maxHoldDays  !== '' ? parseInt(maxHoldDays)          : undefined,
      sellRuleId:   sellRuleId   !== '' ? sellRuleId                      : undefined,
    };
  }, [rules, selectedRuleId, initialCapital, positionSize, takeProfit, trailingStop, maxHoldDays, sellRuleId]);

  const handleRun = useCallback(async () => {
    const cfg = baseConfig();
    if (!cfg) return;
    setAiSuggestion(null);

    if (multiMode) {
      const targetStocks = isRealMode ? ALL_STOCKS.filter(s => s.value !== '6764') : STOCKS;
      setMultiLoading(true);
      try {
        const stockInputs = (await Promise.all(
          targetStocks.map(async s => {
            if (isRealMode) {
              const raw = await fetchHistoricalData(`${s.value}.T`);
              if (!raw) return null;
              const all = buildChartData(raw);
              const filtered = dataSourceMode === 'real-5y' ? all : filterByPeriod(all, dataSourceMode as RealPeriod);
              if (filtered.length < 5) return null;
              return { code: s.value, label: s.label, color: s.color, data: filtered };
            }
            const { data: raw } = await fetchStockData(s.value);
            return { code: s.value, label: s.label, color: s.color, data: buildChartData(raw) };
          }),
        )).filter((x): x is NonNullable<typeof x> => x !== null);
        setMultiResults(runBacktestMultiple(cfg, stockInputs, rules));
      } catch (e) {
        console.error('[backtest multi]', e);
      } finally {
        setMultiLoading(false);
      }
    } else {
      if (activeData.length < 5) return;
      setResult(
        runBacktest(
          { ...cfg, startDate: activeData[0].date, endDate: activeData[activeData.length - 1].date },
          activeData,
          rules,
        ),
      );
    }
  }, [baseConfig, multiMode, activeData, rules, isRealMode, dataSourceMode]);

  const handleAiOptimize = useCallback(async () => {
    const rule = rules.find(r => r.id === selectedRuleId);
    if (!rule) return;
    const resultsToSend = multiResults.length > 0 ? multiResults.map(r => r.result) : result ? [result] : [];
    if (resultsToSend.length === 0) return;

    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule,
          results: resultsToSend,
          stockName: multiMode ? `全銘柄（${STOCKS.length}銘柄）` : stock.label,
          currentConfig: {
            takeProfit:   takeProfit   || null,
            trailingStop: trailingStop || null,
            maxHoldDays:  maxHoldDays  || null,
          },
        }),
      });
      if (res.ok) setAiSuggestion(await res.json() as OptimizeSuggestion);
    } catch (e) {
      console.error('[ai optimize]', e);
    } finally {
      setAiLoading(false);
    }
  }, [rules, selectedRuleId, result, multiResults, stock, multiMode, takeProfit, trailingStop, maxHoldDays]);

  const applyRecommendation = useCallback((rec: OptimizeSuggestion['recommendations']) => {
    setTakeProfit(String(rec.takeProfit));
    setTrailingStop(String(rec.trailingStop));
    setMaxHoldDays(String(rec.maxHoldDays));
    setAiSuggestion(null);
  }, []);

  type PresetCombo = { label: string; buyId: string; sellId: string; tp: string; ts: string; maxDays: string };
  const PRESET_COMBOS: PresetCombo[] = [
    { label: '①逆張り+トレンド転換', buyId: 'preset-ai-rsi-enhanced', sellId: 'preset-sell-trend-reversal', tp: '8',  ts: '2', maxDays: '12' },
    { label: '②逆張り+利益確定',     buyId: 'preset-ai-rsi-enhanced', sellId: 'preset-sell-profit-take',   tp: '10', ts: '3', maxDays: '20' },
    { label: '③逆張り+弱気転換',     buyId: 'preset-ai-rsi-enhanced', sellId: 'preset-sell-bearish',       tp: '8',  ts: '2', maxDays: '15' },
  ];

  const applyCombo = useCallback((combo: PresetCombo) => {
    setSelectedRuleId(combo.buyId);
    setSellRuleId(combo.sellId);
    setTakeProfit(combo.tp);
    setTrailingStop(combo.ts);
    setMaxHoldDays(combo.maxDays);
    setResult(null);
    setMultiResults([]);
    setAiSuggestion(null);
  }, []);

  const selectedRule = rules.find(r => r.id === selectedRuleId);
  const hasResult = result !== null || multiResults.length > 0;
  const isPositive = (result?.totalReturn ?? 0) >= 0;
  const chartColor = isPositive ? '#10b981' : '#ef4444';

  // Multi-stock aggregates (全体平均)
  const avgReturn = multiResults.length > 0
    ? multiResults.reduce((s, r) => s + r.result.totalReturnPct, 0) / multiResults.length : 0;
  const avgSharpe = multiResults.length > 0
    ? multiResults.reduce((s, r) => s + r.result.sharpeRatio, 0) / multiResults.length : 0;
  const avgWinRate = multiResults.length > 0
    ? multiResults.reduce((s, r) => s + r.result.winRate, 0) / multiResults.length : 0;

  // Plus/minus breakdown
  const plusResults  = multiResults.filter(sr => sr.result.totalReturnPct > 0);
  const minusResults = multiResults.filter(sr => sr.result.totalReturnPct <= 0);
  const top3 = [...multiResults].sort((a, b) => b.result.totalReturnPct - a.result.totalReturnPct).slice(0, 3);
  const avgPlusReturn = plusResults.length > 0
    ? plusResults.reduce((s, r) => s + r.result.totalReturnPct, 0) / plusResults.length : 0;
  const avgPlusSharpe = plusResults.length > 0
    ? plusResults.reduce((s, r) => s + r.result.sharpeRatio, 0) / plusResults.length : 0;

  // Sorted + filtered card list
  const displayResults = useMemo(() => {
    let list = showPlusOnly ? multiResults.filter(sr => sr.result.totalReturnPct > 0) : multiResults;
    switch (sortBy) {
      case 'sharpe':  return [...list].sort((a, b) => b.result.sharpeRatio - a.result.sharpeRatio);
      case 'winrate': return [...list].sort((a, b) => b.result.winRate - a.result.winRate);
      default:        return [...list].sort((a, b) => b.result.totalReturnPct - a.result.totalReturnPct);
    }
  }, [multiResults, sortBy, showPlusOnly]);

  return (
    <div className="space-y-5">

      {/* ─── 設定パネル ─────────────────────────────── */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">バックテスト設定</p>
          <div className="flex items-center gap-3 flex-wrap">
            {/* データソーストグル */}
            <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5 border border-slate-700">
              {([
                { id: 'mock',     label: 'モック' },
                { id: 'real-1y',  label: 'リアル1年' },
                { id: 'real-3y',  label: 'リアル3年' },
                { id: 'real-5y',  label: 'リアル5年' },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setDataSourceMode(id)}
                  className={`text-[10px] px-2 py-1 rounded-md transition-colors font-medium whitespace-nowrap ${
                    dataSourceMode === id
                      ? id === 'mock'
                        ? 'bg-slate-600 text-slate-100'
                        : 'bg-emerald-700 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* 複数銘柄トグル */}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-slate-400">全銘柄同時テスト</span>
              <button
                onClick={() => setMultiMode(v => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors ${multiMode ? 'bg-blue-600' : 'bg-slate-700'}`}
                aria-label="全銘柄同時テスト切り替え"
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${multiMode ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </label>
          </div>
        </div>

        {/* リアルデータ状態表示 */}
        {isRealMode && (
          <div className={`rounded-lg px-3 py-2 text-xs border ${
            realDataError
              ? 'bg-red-950/40 border-red-900/60 text-red-400'
              : realDataLoading
              ? 'bg-slate-900 border-slate-700 text-slate-400'
              : activeData.length > 0
              ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
              : 'bg-slate-900 border-slate-700 text-slate-500'
          }`}>
            {realDataError
              ? realDataError
              : realDataLoading
              ? '履歴データを読み込み中...'
              : activeData.length > 0
              ? `リアルデータ — ${activeData[0]?.date} 〜 ${activeData[activeData.length - 1]?.date}（${activeData.length}日）`
              : 'データなし'}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">テスト対象ルール</label>
            {rules.length === 0 ? (
              <p className="text-xs text-slate-500">ルールがありません。売買ルールタブで作成してください。</p>
            ) : (
              <select value={selectedRuleId} onChange={e => setSelectedRuleId(e.target.value)} className={`w-full ${inputCls}`}>
                {rules.map(r => (
                  <option key={r.id} value={r.id}>{r.name}（{r.type === 'buy' ? '買い' : '売り'}）</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">初期資金（円）</label>
            <input type="number" value={initialCapital} min={100_000} step={100_000}
              onChange={e => setInitialCapital(Number(e.target.value))} className={`w-full ${inputCls}`} />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              ポジションサイズ: <span className="text-slate-300 font-semibold">{positionSize}%</span>
            </label>
            <input type="range" min={10} max={100} step={10} value={positionSize}
              onChange={e => setPositionSize(Number(e.target.value))} className="w-full accent-blue-500 mt-1" />
          </div>
        </div>

        {/* イグジット設定 */}
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
            イグジット設定<span className="normal-case ml-1 text-slate-700">（空欄で無効）</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 flex items-center mb-1">
                テイクプロフィット（%）
                <InfoTooltip text="買値からこの割合上昇したら自動利確。例: 5 → +5%で売り" />
              </label>
              <input type="number" value={takeProfit} min={0.1} step={0.5} placeholder="例: 5"
                onChange={e => setTakeProfit(e.target.value)} className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="text-xs text-slate-500 flex items-center mb-1">
                トレイリングストップ（%）
                <InfoTooltip text="保有中の最高値からこの割合下落したら損切り。例: 3 → 高値から-3%で売り" />
              </label>
              <input type="number" value={trailingStop} min={0.1} step={0.5} placeholder="例: 3"
                onChange={e => setTrailingStop(e.target.value)} className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="text-xs text-slate-500 flex items-center mb-1">
                最大保有日数（日）
                <InfoTooltip text="エントリーからこの日数を超えたら強制決済。他の条件より優先度は低いです。" />
              </label>
              <input type="number" value={maxHoldDays} min={1} step={1} placeholder="例: 20"
                onChange={e => setMaxHoldDays(e.target.value)} className={`w-full ${inputCls}`} />
            </div>
          </div>
        </div>

        {/* 売りルール選択 */}
        <div>
          <label className="text-xs text-slate-500 flex items-center mb-1">
            売りルール（オプション）
            <InfoTooltip text="買いルール使用時に有効。未選択の場合は有効な売りルールをすべて使用します。" />
          </label>
          <select
            value={sellRuleId}
            onChange={e => setSellRuleId(e.target.value)}
            className={`w-full ${inputCls}`}
          >
            <option value="">自動（有効な売りルールをすべて使用）</option>
            {rules.filter(r => r.type === 'sell').map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* 推奨コンビネーション */}
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">推奨コンビネーション</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_COMBOS.map(combo => {
              const active = selectedRuleId === combo.buyId && sellRuleId === combo.sellId;
              return (
                <button
                  key={combo.label}
                  onClick={() => applyCombo(combo)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    active
                      ? 'bg-blue-700 border-blue-600 text-white'
                      : 'bg-slate-900 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                  }`}
                >
                  {combo.label}
                </button>
              );
            })}
          </div>
        </div>

        {selectedRule && (
          <p className="text-[10px] text-slate-600">
            {selectedRule.type === 'buy'
              ? `エントリー: ${selectedRule.name}　／　イグジット: ${
                  sellRuleId
                    ? (rules.find(r => r.id === sellRuleId)?.name ?? '売りルール')
                    : '有効な売りルール'
                } or 期間終了`
              : `エントリー: 有効な買いルール　／　イグジット: ${selectedRule.name}`}
            {multiMode && `　／　対象: ${isRealMode ? `全${ALL_STOCKS.length - 1}銘柄（リアル）` : `全${STOCKS.length}銘柄（モック）`}`}
          </p>
        )}

        <button
          onClick={handleRun}
          disabled={rules.length === 0 || (!multiMode && activeData.length < 5) || multiLoading || (isRealMode && realDataLoading)}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {multiLoading ? '全銘柄データ取得中...' : 'バックテスト実行'}
        </button>
      </div>

      {/* ─── 全銘柄同時テスト結果 ───────────────────── */}
      {multiResults.length > 0 && (
        <>
          {/* 全体集計サマリー */}
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard label="平均リターン"
              value={`${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(2)}%`}
              positive={avgReturn >= 0} highlight />
            <SummaryCard label="平均シャープ比"
              value={avgSharpe.toFixed(2)}
              positive={avgSharpe > 0} />
            <SummaryCard label="平均勝率"
              value={`${avgWinRate.toFixed(1)}%`}
              positive={avgWinRate >= 50} />
          </div>

          {/* 🏆 注目銘柄（上位3） */}
          {top3.length > 0 && top3[0].result.totalReturnPct > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                🏆 注目銘柄（リターン上位3）
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {top3.map((sr, rank) => {
                  const r = sr.result;
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div
                      key={sr.stockCode}
                      className="rounded-xl p-4 border-2 relative overflow-hidden"
                      style={{ borderColor: sr.color, background: `${sr.color}10` }}
                    >
                      <span className="absolute top-2 right-2 text-xl">{medals[rank]}</span>
                      <div className="flex items-center gap-2 mb-1 pr-7">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sr.color }} />
                        <p className="text-xs font-semibold text-slate-200 truncate">{sr.stockLabel}</p>
                      </div>
                      <p className="text-2xl font-mono font-bold text-emerald-400 leading-none mb-2">
                        +{r.totalReturnPct}%
                      </p>
                      <div className="grid grid-cols-3 gap-1 text-[10px]">
                        <span className="text-slate-500">勝率<br/><span className="text-slate-300 font-medium">{r.winRate}%</span></span>
                        <span className="text-slate-500">シャープ<br/><span className="text-slate-300 font-medium">{r.sharpeRatio}</span></span>
                        <span className="text-slate-500">取引<br/><span className="text-slate-300 font-medium">{r.totalTrades}回</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* プラス銘柄サマリーパネル */}
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/60 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs font-semibold text-slate-300">プラス銘柄ピックアップ</p>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-800/60 font-semibold">
                  ＋ {plusResults.length}銘柄
                </span>
                <span className="px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800/50 font-semibold">
                  － {minusResults.length}銘柄
                </span>
              </div>
              {plusResults.length > 0 && (
                <div className="flex gap-3 text-[10px] text-slate-500 ml-auto">
                  <span>平均リターン <span className="text-emerald-400 font-semibold">+{avgPlusReturn.toFixed(2)}%</span></span>
                  <span>平均シャープ <span className="text-slate-300 font-semibold">{avgPlusSharpe.toFixed(2)}</span></span>
                </div>
              )}
            </div>
            {plusResults.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {[...plusResults]
                  .sort((a, b) => b.result.totalReturnPct - a.result.totalReturnPct)
                  .map(sr => (
                    <span
                      key={sr.stockCode}
                      className="text-[10px] px-2 py-1 rounded-lg font-medium border"
                      style={{
                        color: sr.color,
                        borderColor: `${sr.color}50`,
                        background: `${sr.color}15`,
                      }}
                    >
                      {sr.stockLabel}
                      <span className="ml-1 font-mono font-bold">+{sr.result.totalReturnPct}%</span>
                    </span>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">プラス銘柄なし（条件を緩和してみてください）</p>
            )}
          </div>

          {/* ソート・フィルターバー */}
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 mr-1">並び順:</span>
              {([
                { id: 'return',  label: 'リターン順' },
                { id: 'sharpe',  label: 'シャープ比順' },
                { id: 'winrate', label: '勝率順' },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setSortBy(id)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors font-medium border ${
                    sortBy === id
                      ? 'bg-slate-600 border-slate-500 text-slate-100'
                      : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <button
                onClick={() => setShowPlusOnly(v => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors ${showPlusOnly ? 'bg-emerald-600' : 'bg-slate-700'}`}
                aria-label="プラスのみ表示"
              >
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showPlusOnly ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <span className="text-[10px] text-slate-400">プラスのみ表示</span>
              <span className="text-[10px] text-slate-600">({displayResults.length}件)</span>
            </label>
          </div>

          {/* 銘柄別カードグリッド */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {displayResults.map(sr => <StockCard key={sr.stockCode} sr={sr} />)}
          </div>
          {displayResults.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-6">
              条件に一致する銘柄がありません
            </p>
          )}
        </>
      )}

      {/* ─── シングル銘柄結果 ────────────────────────── */}
      {result && !multiMode && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <SummaryCard label="最終資産" value={`¥${result.finalCapital.toLocaleString()}`} positive={isPositive} />
            <SummaryCard label="総リターン"
              value={`${result.totalReturn >= 0 ? '+' : ''}¥${result.totalReturn.toLocaleString()}`}
              sub={`${result.totalReturn >= 0 ? '+' : ''}${result.totalReturnPct}%`}
              positive={isPositive} highlight />
            <SummaryCard label="勝率" value={`${result.winRate}%`} positive={result.winRate >= 50} />
            <SummaryCard label="最大DD" value={`-${result.maxDrawdown}%`} positive={result.maxDrawdown < 10} />
            <SummaryCard label="シャープ比" value={`${result.sharpeRatio}`} positive={result.sharpeRatio > 0} />
            <SummaryCard label="取引回数" value={`${result.totalTrades}回`} positive={result.totalTrades > 0} />
          </div>

          {/* 決済理由の内訳 */}
          {result.totalTrades > 0 && (
            <div className="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-800/60">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">決済理由の内訳</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['takeProfit',   result.exitReasons.takeProfit],
                    ['trailingStop', result.exitReasons.trailingStop],
                    ['maxHoldDays',  result.exitReasons.maxHoldDays],
                    ['ruleExit',     result.exitReasons.ruleExit],
                  ] as [ExitReason, number][]
                )
                  .filter(([, c]) => c > 0)
                  .map(([reason, count]) => (
                    <span key={reason} className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${EXIT_REASON_STYLE[reason]}`}>
                      {EXIT_REASON_LABEL[reason]}　{count}回
                    </span>
                  ))}
                {Object.values(result.exitReasons).every(v => v === 0) && (
                  <span className="text-xs text-slate-600">期間終了のみ（ルール/イグジット条件未到達）</span>
                )}
              </div>
            </div>
          )}

          {/* 資産推移チャート */}
          {result.equityCurve.length > 1 && (
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <p className="text-xs font-semibold text-slate-400 mb-3">資産推移</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={result.equityCurve} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }}
                    tickFormatter={fmtDate} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }}
                    tickFormatter={v => `${Math.round(v / 10000)}万`} width={48} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    labelFormatter={l => fmtDate(String(l))}
                    formatter={v => [`¥${Number(v).toLocaleString()}`, '資産']} />
                  <ReferenceLine y={initialCapital} stroke="#475569" strokeDasharray="4 2"
                    label={{ value: '初期', position: 'insideTopLeft', fontSize: 9, fill: '#475569' }} />
                  <Area type="monotone" dataKey="capital" stroke={chartColor} strokeWidth={2}
                    fill="url(#equityGrad)" dot={false} activeDot={{ r: 4, fill: chartColor }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 取引履歴テーブル */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="text-xs font-semibold text-slate-400">取引履歴</p>
            </div>
            {result.trades.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">条件を満たす取引が発生しませんでした</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="px-4 py-2.5 text-left font-medium">日付</th>
                      <th className="px-4 py-2.5 text-left font-medium">種別</th>
                      <th className="px-4 py-2.5 text-right font-medium">価格</th>
                      <th className="px-4 py-2.5 text-right font-medium">株数</th>
                      <th className="px-4 py-2.5 text-right font-medium">損益</th>
                      <th className="px-4 py-2.5 text-right font-medium">資産合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((trade, i) => (
                      <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-slate-400">{trade.date}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              trade.type === 'buy' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
                            }`}>
                              {trade.type === 'buy' ? '買い' : '売り'}
                            </span>
                            {trade.exitReason && trade.exitReason !== 'periodEnd' && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${EXIT_REASON_STYLE[trade.exitReason]}`}>
                                {EXIT_REASON_LABEL[trade.exitReason]}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300">¥{trade.price.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400">{trade.shares.toLocaleString()}</td>
                        <td className={`px-4 py-2.5 text-right font-mono font-semibold ${
                          trade.type === 'sell'
                            ? trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                            : 'text-slate-700'
                        }`}>
                          {trade.type === 'sell'
                            ? `${trade.pnl >= 0 ? '+' : ''}¥${trade.pnl.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400">¥{trade.capital.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── AI最適化提案 ───────────────────────────── */}
      {hasResult && (
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
              <>✨ AIにパラメータ最適化を提案してもらう</>
            )}
          </button>

          {aiSuggestion && (
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-600 space-y-4">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">AI最適化提案</p>

              {/* 現状分析 */}
              <div>
                <p className="text-[10px] text-slate-500 mb-1">現状分析</p>
                <p className="text-sm text-slate-300 leading-relaxed">{aiSuggestion.analysis}</p>
              </div>

              {/* 推奨パラメータ */}
              <div>
                <p className="text-[10px] text-slate-500 mb-2">推奨パラメータ</p>
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
                  onClick={() => applyRecommendation(aiSuggestion.recommendations)}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-600 hover:bg-slate-500 transition-colors"
                >
                  この設定を反映する
                </button>
              </div>

              {/* 条件調整案 */}
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

              {/* 改善予測 */}
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
      )}

      {hasResult && (
        <p className="text-[10px] text-slate-700 text-center">
          ※ 過去の結果は将来を保証しません。バックテストは参考情報であり、投資助言ではありません。
        </p>
      )}
    </div>
  );
}
