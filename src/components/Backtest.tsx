'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ChartDataPoint, StockOption, TradeRule } from '@/types/stock';
import { loadRules } from '@/lib/ruleEngine';
import { runBacktest, type BacktestResult, type ExitReason } from '@/lib/backtest';

interface Props {
  data: ChartDataPoint[];
  stock: StockOption;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #1e293b',
  color: '#e2e8f0',
  borderRadius: '10px',
  fontSize: '12px',
};

function fmtDate(iso: string): string {
  const parts = iso.split('-');
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

const inputCls =
  'bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500';

const EXIT_REASON_LABEL: Record<ExitReason, string> = {
  takeProfit:   '利確',
  trailingStop: 'TStop',
  maxHoldDays:  '期間満了',
  ruleExit:     'ルール',
  periodEnd:    '期間終了',
};

const EXIT_REASON_STYLE: Record<ExitReason, string> = {
  takeProfit:   'bg-emerald-900/50 text-emerald-400 border-emerald-800/60',
  trailingStop: 'bg-amber-900/50 text-amber-400 border-amber-800/60',
  maxHoldDays:  'bg-blue-900/50 text-blue-400 border-blue-800/60',
  ruleExit:     'bg-slate-800 text-slate-400 border-slate-700',
  periodEnd:    'bg-slate-800/50 text-slate-600 border-slate-700/50',
};

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1">
      <span className="text-slate-600 text-[9px] cursor-help select-none leading-none">(?)</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 p-2 bg-slate-800 border border-slate-700 rounded-lg text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none whitespace-normal shadow-xl">
        {text}
      </span>
    </span>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  positive,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  positive: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 border ${
        highlight
          ? positive
            ? 'bg-emerald-950/40 border-emerald-900/60'
            : 'bg-red-950/40 border-red-900/60'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      <p className="text-[10px] text-slate-500 mb-1">{label}</p>
      <p
        className={`text-sm font-bold font-mono leading-none ${
          highlight
            ? positive
              ? 'text-emerald-400'
              : 'text-red-400'
            : positive
            ? 'text-slate-200'
            : 'text-red-400'
        }`}
      >
        {value}
      </p>
      {sub && (
        <p
          className={`text-[10px] font-mono mt-0.5 ${
            positive ? 'text-emerald-500' : 'text-red-500'
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

export default function Backtest({ data, stock }: Props) {
  const [rules] = useState<TradeRule[]>(() => loadRules());
  const [selectedRuleId, setSelectedRuleId] = useState<string>(rules[0]?.id ?? '');
  const [initialCapital, setInitialCapital] = useState(1_000_000);
  const [positionSize, setPositionSize] = useState(50);
  // イグジット設定（空文字 = 無効）
  const [takeProfit, setTakeProfit] = useState('5');
  const [trailingStop, setTrailingStop] = useState('3');
  const [maxHoldDays, setMaxHoldDays] = useState('20');
  const [result, setResult] = useState<BacktestResult | null>(null);

  useEffect(() => {
    setResult(null);
  }, [data, stock]);

  const handleRun = useCallback(() => {
    const rule = rules.find(r => r.id === selectedRuleId);
    if (!rule || data.length < 5) return;

    const takeProfitVal  = takeProfit  !== '' ? parseFloat(takeProfit)  / 100 : undefined;
    const trailingStopVal = trailingStop !== '' ? parseFloat(trailingStop) / 100 : undefined;
    const maxHoldDaysVal = maxHoldDays !== '' ? parseInt(maxHoldDays)        : undefined;

    const res = runBacktest(
      {
        rule,
        startDate: data[0].date,
        endDate: data[data.length - 1].date,
        initialCapital,
        positionSize: positionSize / 100,
        takeProfit:   takeProfitVal,
        trailingStop: trailingStopVal,
        maxHoldDays:  maxHoldDaysVal,
      },
      data,
      rules,
    );
    setResult(res);
  }, [rules, selectedRuleId, data, initialCapital, positionSize, takeProfit, trailingStop, maxHoldDays]);

  const selectedRule = rules.find(r => r.id === selectedRuleId);
  const isPositive = (result?.totalReturn ?? 0) >= 0;
  const chartColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <div className="space-y-5">
      {/* 設定パネル */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 space-y-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          バックテスト設定
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* ルール選択 */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">テスト対象ルール</label>
            {rules.length === 0 ? (
              <p className="text-xs text-slate-500">
                ルールがありません。売買ルールタブで作成してください。
              </p>
            ) : (
              <select
                value={selectedRuleId}
                onChange={e => setSelectedRuleId(e.target.value)}
                className={`w-full ${inputCls}`}
              >
                {rules.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}（{r.type === 'buy' ? '買い' : '売り'}）
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 初期資金 */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">初期資金（円）</label>
            <input
              type="number"
              value={initialCapital}
              min={100_000}
              step={100_000}
              onChange={e => setInitialCapital(Number(e.target.value))}
              className={`w-full ${inputCls}`}
            />
          </div>

          {/* ポジションサイズ */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              ポジションサイズ:{' '}
              <span className="text-slate-300 font-semibold">{positionSize}%</span>
            </label>
            <input
              type="range"
              min={10}
              max={100}
              step={10}
              value={positionSize}
              onChange={e => setPositionSize(Number(e.target.value))}
              className="w-full accent-blue-500 mt-1"
            />
          </div>
        </div>

        {/* イグジット設定 */}
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
            イグジット設定
            <span className="normal-case ml-1 text-slate-700">（空欄で無効）</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 flex items-center mb-1">
                テイクプロフィット（%）
                <InfoTooltip text="買値からこの割合上昇したら自動で利益確定します。例: 5 → +5%で売り" />
              </label>
              <input
                type="number"
                value={takeProfit}
                min={0.1}
                step={0.5}
                placeholder="例: 5"
                onChange={e => setTakeProfit(e.target.value)}
                className={`w-full ${inputCls}`}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 flex items-center mb-1">
                トレイリングストップ（%）
                <InfoTooltip text="保有中の最高値からこの割合下落したら損切りします。例: 3 → 高値から-3%で売り" />
              </label>
              <input
                type="number"
                value={trailingStop}
                min={0.1}
                step={0.5}
                placeholder="例: 3"
                onChange={e => setTrailingStop(e.target.value)}
                className={`w-full ${inputCls}`}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 flex items-center mb-1">
                最大保有日数（日）
                <InfoTooltip text="エントリーからこの日数を超えたら強制決済します。他の条件より優先度は低いです。" />
              </label>
              <input
                type="number"
                value={maxHoldDays}
                min={1}
                step={1}
                placeholder="例: 20"
                onChange={e => setMaxHoldDays(e.target.value)}
                className={`w-full ${inputCls}`}
              />
            </div>
          </div>
        </div>

        {selectedRule && (
          <p className="text-[10px] text-slate-600">
            {selectedRule.type === 'buy'
              ? `エントリー: ${selectedRule.name}　／　イグジット: 有効な売りルール or 期間終了`
              : `エントリー: 有効な買いルール　／　イグジット: ${selectedRule.name}`}
          </p>
        )}

        <button
          onClick={handleRun}
          disabled={rules.length === 0 || data.length < 5}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          バックテスト実行
        </button>
      </div>

      {/* 結果 */}
      {result && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <SummaryCard
              label="最終資産"
              value={`¥${result.finalCapital.toLocaleString()}`}
              positive={isPositive}
            />
            <SummaryCard
              label="総リターン"
              value={`${result.totalReturn >= 0 ? '+' : ''}¥${result.totalReturn.toLocaleString()}`}
              sub={`${result.totalReturn >= 0 ? '+' : ''}${result.totalReturnPct}%`}
              positive={isPositive}
              highlight
            />
            <SummaryCard
              label="勝率"
              value={`${result.winRate}%`}
              positive={result.winRate >= 50}
            />
            <SummaryCard
              label="最大DD"
              value={`-${result.maxDrawdown}%`}
              positive={result.maxDrawdown < 10}
            />
            <SummaryCard
              label="シャープ比"
              value={`${result.sharpeRatio}`}
              positive={result.sharpeRatio > 0}
            />
            <SummaryCard
              label="取引回数"
              value={`${result.totalTrades}回`}
              positive={result.totalTrades > 0}
            />
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
                  .filter(([, count]) => count > 0)
                  .map(([reason, count]) => (
                    <span
                      key={reason}
                      className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${EXIT_REASON_STYLE[reason]}`}
                    >
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
                <AreaChart
                  data={result.equityCurve}
                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#475569' }}
                    tickFormatter={fmtDate}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#475569' }}
                    tickFormatter={v => `${Math.round(v / 10000)}万`}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={label => fmtDate(String(label))}
                    formatter={(value) => [
                      `¥${Number(value).toLocaleString()}`,
                      '資産',
                    ]}
                  />
                  <ReferenceLine
                    y={initialCapital}
                    stroke="#475569"
                    strokeDasharray="4 2"
                    label={{ value: '初期', position: 'insideTopLeft', fontSize: 9, fill: '#475569' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="capital"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#equityGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: chartColor }}
                  />
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
              <p className="text-sm text-slate-500 text-center py-10">
                条件を満たす取引が発生しませんでした
              </p>
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
                      <tr
                        key={i}
                        className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-slate-400">
                          {trade.date}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                trade.type === 'buy'
                                  ? 'bg-emerald-900/50 text-emerald-400'
                                  : 'bg-red-900/50 text-red-400'
                              }`}
                            >
                              {trade.type === 'buy' ? '買い' : '売り'}
                            </span>
                            {trade.exitReason && trade.exitReason !== 'periodEnd' && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded border ${EXIT_REASON_STYLE[trade.exitReason]}`}
                              >
                                {EXIT_REASON_LABEL[trade.exitReason]}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                          ¥{trade.price.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                          {trade.shares.toLocaleString()}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono font-semibold ${
                            trade.type === 'sell'
                              ? trade.pnl >= 0
                                ? 'text-emerald-400'
                                : 'text-red-400'
                              : 'text-slate-700'
                          }`}
                        >
                          {trade.type === 'sell'
                            ? `${trade.pnl >= 0 ? '+' : ''}¥${trade.pnl.toLocaleString()}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                          ¥{trade.capital.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-700 text-center">
            ※ 過去の結果は将来を保証しません。バックテストは参考情報であり、投資助言ではありません。
          </p>
        </>
      )}
    </div>
  );
}
