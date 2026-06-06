'use client';

import { useState, useEffect } from 'react';
import type { TradeJournalEntry, StockOption } from '@/types/stock';

interface Props {
  currentStock: StockOption;
  currentPrice: number;
}

const STORAGE_KEY = 'stock-journal-entries';

export default function Journal({ currentStock, currentPrice }: Props) {
  const [entries, setEntries] = useState<TradeJournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: '2026-06-06',
    action: 'buy' as 'buy' | 'sell',
    price: currentPrice,
    quantity: 100,
    memo: '',
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setEntries(JSON.parse(saved));
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    setForm(prev => ({ ...prev, price: currentPrice }));
  }, [currentPrice]);

  const persist = (updated: TradeJournalEntry[]) => {
    setEntries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleAdd = () => {
    if (!form.price || !form.quantity) return;
    const entry: TradeJournalEntry = {
      id: Date.now().toString(),
      date: form.date,
      action: form.action,
      price: form.price,
      quantity: form.quantity,
      memo: form.memo,
      stock: currentStock.value,
      stockLabel: currentStock.label,
    };
    persist([entry, ...entries]);
    setForm(prev => ({ ...prev, memo: '' }));
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    persist(entries.filter(e => e.id !== id));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-slate-200 font-semibold">トレード日誌</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: showForm ? '#475569' : currentStock.color }}
        >
          {showForm ? 'キャンセル' : '+ 記録を追加'}
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">日付</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">売買</label>
              <select
                value={form.action}
                onChange={e =>
                  setForm(p => ({ ...p, action: e.target.value as 'buy' | 'sell' }))
                }
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200"
              >
                <option value="buy">買い</option>
                <option value="sell">売り</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">価格（円）</label>
              <input
                type="number"
                value={form.price}
                onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))}
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">数量（株）</label>
              <input
                type="number"
                value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))}
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-slate-500 block mb-1">メモ</label>
            <textarea
              value={form.memo}
              onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              rows={2}
              placeholder="売買理由、気づきなど..."
              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 resize-none"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">
              {currentStock.label} — 合計:{' '}
              <span className="font-mono text-slate-300">
                ¥{(form.price * form.quantity).toLocaleString()}
              </span>
            </span>
            <button
              onClick={handleAdd}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: currentStock.color }}
            >
              記録する
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">記録がありません</p>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-start gap-3"
            >
              <div
                className={`mt-0.5 px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${
                  entry.action === 'buy'
                    ? 'bg-emerald-900/60 text-emerald-400'
                    : 'bg-red-900/60 text-red-400'
                }`}
              >
                {entry.action === 'buy' ? '買' : '売'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <span className="text-slate-200 font-medium">{entry.stockLabel}</span>
                  <span className="text-slate-500 text-xs">{entry.date}</span>
                  <span className="text-slate-300 font-mono">
                    ¥{entry.price.toLocaleString()} × {entry.quantity}株
                  </span>
                  <span className="text-slate-400 font-mono text-xs">
                    = ¥{(entry.price * entry.quantity).toLocaleString()}
                  </span>
                </div>
                {entry.memo && (
                  <p className="text-slate-400 text-xs mt-1 truncate">{entry.memo}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(entry.id)}
                className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 text-xs px-1"
                aria-label="削除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
