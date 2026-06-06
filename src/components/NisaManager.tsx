'use client';

import { useState, useEffect } from 'react';
import { STOCKS } from '@/lib/stocks';

interface NisaHolding {
  id: string;
  stockCode: string;
  stockLabel: string;
  accountType: 'tsumitate' | 'seicho' | 'tokutei';
  amount: number;
}

const STORAGE_KEY = 'stock-nisa-holdings';
const TSUMITATE_LIMIT = 1_200_000;
const SEICHO_LIMIT = 2_400_000;

const ACCOUNT_LABELS: Record<NisaHolding['accountType'], string> = {
  tsumitate: 'つみたて枠',
  seicho: '成長投資枠',
  tokutei: '特定口座',
};

const ACCOUNT_COLORS: Record<NisaHolding['accountType'], string> = {
  tsumitate: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  seicho: 'bg-blue-900/60 text-blue-300 border-blue-700',
  tokutei: 'bg-slate-700/60 text-slate-400 border-slate-600',
};

function ProgressBar({
  label,
  used,
  limit,
  color,
}: {
  label: string;
  used: number;
  limit: number;
  color: string;
}) {
  const pct = Math.min((used / limit) * 100, 100);
  const remaining = Math.max(limit - used, 0);
  const over = used > limit;

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <span className="text-xs text-slate-500">
          ¥{used.toLocaleString()} / ¥{limit.toLocaleString()}
        </span>
      </div>
      <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color} ${over ? 'opacity-50' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className={`text-xs ${over ? 'text-red-400' : 'text-slate-500'}`}>
          {over ? '⚠ 上限超過' : `残り ¥${remaining.toLocaleString()}`}
        </span>
        <span className="text-xs text-slate-600">{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function NisaManager() {
  const [holdings, setHoldings] = useState<NisaHolding[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    stockCode: STOCKS[0].value,
    accountType: 'seicho' as NisaHolding['accountType'],
    amount: '',
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHoldings(JSON.parse(saved) as NisaHolding[]);
    } catch {
      // ignore parse errors
    }
  }, []);

  const persist = (updated: NisaHolding[]) => {
    setHoldings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const tsumitateUsed = holdings
    .filter(h => h.accountType === 'tsumitate')
    .reduce((sum, h) => sum + h.amount, 0);

  const seichoUsed = holdings
    .filter(h => h.accountType === 'seicho')
    .reduce((sum, h) => sum + h.amount, 0);

  const nisaTotal = tsumitateUsed + seichoUsed;
  const nisaLimit = TSUMITATE_LIMIT + SEICHO_LIMIT;

  const handleAdd = () => {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return;
    const stock = STOCKS.find(s => s.value === form.stockCode) ?? STOCKS[0];
    const entry: NisaHolding = {
      id: Date.now().toString(),
      stockCode: stock.value,
      stockLabel: stock.label,
      accountType: form.accountType,
      amount: amt,
    };
    persist([entry, ...holdings]);
    setForm(f => ({ ...f, amount: '' }));
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    persist(holdings.filter(h => h.id !== id));
  };

  const handleChangeType = (id: string, accountType: NisaHolding['accountType']) => {
    persist(holdings.map(h => (h.id === id ? { ...h, accountType } : h)));
  };

  return (
    <div className="space-y-6">
      {/* NISA枠サマリー */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">2024年 新NISA 年間枠</h3>
          <span className="text-xs text-slate-500">
            合計 ¥{nisaTotal.toLocaleString()} / ¥{nisaLimit.toLocaleString()}
          </span>
        </div>
        <ProgressBar
          label="つみたて投資枠（年間120万円）"
          used={tsumitateUsed}
          limit={TSUMITATE_LIMIT}
          color="bg-emerald-500"
        />
        <ProgressBar
          label="成長投資枠（年間240万円）"
          used={seichoUsed}
          limit={SEICHO_LIMIT}
          color="bg-blue-500"
        />
      </div>

      {/* 保有銘柄 */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-200">保有銘柄</h3>
          <button
            onClick={() => setShowForm(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors ${
              showForm ? 'bg-slate-600' : 'bg-blue-700 hover:bg-blue-600'
            }`}
          >
            {showForm ? 'キャンセル' : '+ 銘柄を追加'}
          </button>
        </div>

        {showForm && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">銘柄</label>
                <select
                  value={form.stockCode}
                  onChange={e => setForm(f => ({ ...f, stockCode: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200"
                >
                  {STOCKS.map(s => (
                    <option key={s.value} value={s.value}>
                      {s.label}（{s.value}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">口座種別</label>
                <select
                  value={form.accountType}
                  onChange={e =>
                    setForm(f => ({ ...f, accountType: e.target.value as NisaHolding['accountType'] }))
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200"
                >
                  <option value="seicho">成長投資枠（NISA）</option>
                  <option value="tsumitate">つみたて投資枠（NISA）</option>
                  <option value="tokutei">特定口座</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">投資額（円）</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="例: 500000"
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleAdd}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600 transition-colors"
              >
                追加する
              </button>
            </div>
          </div>
        )}

        {holdings.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">
            保有銘柄が登録されていません
          </p>
        ) : (
          <div className="space-y-2">
            {holdings.map(h => (
              <div
                key={h.id}
                className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-200">{h.stockLabel}</span>
                    <span className="text-xs text-slate-500">{h.stockCode}</span>
                    <span className="font-mono text-sm text-slate-300">
                      ¥{h.amount.toLocaleString()}
                    </span>
                  </div>
                  <select
                    value={h.accountType}
                    onChange={e =>
                      handleChangeType(h.id, e.target.value as NisaHolding['accountType'])
                    }
                    className={`text-xs px-2 py-0.5 rounded border font-medium bg-transparent ${ACCOUNT_COLORS[h.accountType]}`}
                  >
                    <option value="seicho">成長投資枠</option>
                    <option value="tsumitate">つみたて枠</option>
                    <option value="tokutei">特定口座</option>
                  </select>
                </div>
                <button
                  onClick={() => handleDelete(h.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors text-xs px-1 flex-shrink-0"
                  aria-label="削除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-600">
        ※ NISA枠は概算です。実際の利用可能枠は証券会社・国税庁のサイトでご確認ください。投資助言ではありません。
      </p>
    </div>
  );
}
