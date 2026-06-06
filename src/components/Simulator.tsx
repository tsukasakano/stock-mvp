'use client';

import { useState, useEffect } from 'react';
import type { StockOption } from '@/types/stock';

interface Props {
  stock: StockOption;
  currentPrice: number;
}

const TAX_RATE = 0.20315;

function fmt(n: number) {
  return n.toLocaleString('ja-JP');
}

function ResultRow({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  const color =
    positive === undefined
      ? 'text-slate-200'
      : positive
      ? 'text-emerald-400'
      : 'text-red-400';
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-slate-800 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`font-mono font-semibold ${color}`}>
        {value}
        {sub && <span className="ml-1 text-xs opacity-70">{sub}</span>}
      </span>
    </div>
  );
}

export default function Simulator({ stock, currentPrice }: Props) {
  const [buyPrice, setBuyPrice] = useState(currentPrice || 0);
  const [quantity, setQuantity] = useState(100);
  const [targetPrice, setTargetPrice] = useState(Math.round((currentPrice || 0) * 1.1));
  const [stopLossPrice, setStopLossPrice] = useState(Math.round((currentPrice || 0) * 0.95));
  const [accountType, setAccountType] = useState<'regular' | 'nisa'>('regular');

  useEffect(() => {
    if (!currentPrice) return;
    setBuyPrice(currentPrice);
    setTargetPrice(Math.round(currentPrice * 1.1));
    setStopLossPrice(Math.round(currentPrice * 0.95));
  }, [currentPrice]);

  const totalBuy = buyPrice * quantity;
  const grossProfit = (targetPrice - buyPrice) * quantity;
  const tax =
    accountType === 'regular' && grossProfit > 0
      ? Math.floor(grossProfit * TAX_RATE)
      : 0;
  const netProfit = grossProfit - tax;
  const profitPct = totalBuy > 0 ? (grossProfit / totalBuy) * 100 : 0;
  const netProfitPct = totalBuy > 0 ? (netProfit / totalBuy) * 100 : 0;

  const stopLossAmount = (stopLossPrice - buyPrice) * quantity;
  const stopLossPct = totalBuy > 0 ? (stopLossAmount / totalBuy) * 100 : 0;

  const inputCls =
    'w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 font-mono';

  return (
    <div className="space-y-6">
      {/* 入力フォーム */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="text-xs text-slate-500 block mb-1">買値（円）</label>
          <input
            type="number"
            value={buyPrice}
            onChange={e => setBuyPrice(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">株数</label>
          <input
            type="number"
            value={quantity}
            onChange={e => setQuantity(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">目標価格（円）</label>
          <input
            type="number"
            value={targetPrice}
            onChange={e => setTargetPrice(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">損切りライン（円）</label>
          <input
            type="number"
            value={stopLossPrice}
            onChange={e => setStopLossPrice(Number(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>

      {/* 口座種別 */}
      <div className="flex gap-3">
        {(['regular', 'nisa'] as const).map(type => (
          <button
            key={type}
            onClick={() => setAccountType(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              accountType === type
                ? type === 'nisa'
                  ? 'bg-emerald-700 border-emerald-600 text-white'
                  : 'bg-slate-600 border-slate-500 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {type === 'nisa' ? 'NISA口座（非課税）' : '通常口座（課税）'}
          </button>
        ))}
      </div>

      {/* 結果 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 利益シミュレーション */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: stock.color }}
          >
            目標達成時
          </p>
          <ResultRow label="投資元本" value={`¥${fmt(totalBuy)}`} />
          <ResultRow
            label="粗利益"
            value={`¥${fmt(grossProfit)}`}
            sub={`(${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%)`}
            positive={grossProfit >= 0}
          />
          {accountType === 'regular' && (
            <ResultRow label={`税金 (${(TAX_RATE * 100).toFixed(3)}%)`} value={`-¥${fmt(tax)}`} />
          )}
          {accountType === 'nisa' && (
            <ResultRow label="税金" value="¥0（非課税）" positive />
          )}
          <ResultRow
            label="手取り利益"
            value={`¥${fmt(netProfit)}`}
            sub={`(${netProfitPct >= 0 ? '+' : ''}${netProfitPct.toFixed(2)}%)`}
            positive={netProfit >= 0}
          />
        </div>

        {/* 損切りシミュレーション */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">
            損切り時
          </p>
          <ResultRow label="投資元本" value={`¥${fmt(totalBuy)}`} />
          <ResultRow label="損切りライン" value={`¥${fmt(stopLossPrice)}`} />
          <ResultRow
            label="損失額"
            value={`¥${fmt(stopLossAmount)}`}
            sub={`(${stopLossPct.toFixed(2)}%)`}
            positive={stopLossAmount >= 0}
          />
          <ResultRow label="税金（損失時）" value="¥0" />
          <ResultRow
            label="損失後残高"
            value={`¥${fmt(totalBuy + stopLossAmount)}`}
            positive={false}
          />
        </div>
      </div>

      <p className="text-xs text-slate-600">
        ※ 税額は概算です（復興特別所得税込20.315%）。実際の税額は証券会社・税務署にご確認ください。投資助言ではありません。
      </p>
    </div>
  );
}
