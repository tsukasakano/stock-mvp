'use client';

import { useState, useEffect, useMemo } from 'react';
import type { StockOption } from '@/types/stock';
import { ALL_STOCKS, SECTOR_LIST } from '@/lib/stocks';
import type { ScreeningResult } from '@/app/api/screening/route';

export { ALL_STOCKS as STOCKS } from '@/lib/stocks';

interface Props {
  selected: StockOption;
  onSelect: (stock: StockOption) => void;
}

export default function StockSelector({ selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('');
  const [scores, setScores] = useState<Map<string, number>>(new Map());

  // スクリーニングスコアをバックグラウンドで取得
  useEffect(() => {
    fetch('/api/screening')
      .then(r => r.ok ? r.json() as Promise<ScreeningResult> : Promise.reject())
      .then(data => {
        const m = new Map<string, number>();
        data.candidates.forEach(c => m.set(c.symbol.replace('.T', ''), c.score));
        setScores(m);
      })
      .catch(() => { /* silent fail */ });
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return ALL_STOCKS.filter(s => {
      if (sector && s.sector !== sector) return false;
      if (q && !s.label.toLowerCase().includes(q) && !s.value.includes(q)) return false;
      return true;
    });
  }, [query, sector]);

  return (
    <div className="space-y-2.5">
      {/* 検索・フィルター行 */}
      <div className="flex gap-2 flex-wrap sm:flex-nowrap">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs select-none">🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="銘柄名・コードで検索"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
          />
        </div>
        <select
          value={sector}
          onChange={e => setSector(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500 shrink-0"
        >
          <option value="">セクター: 全て</option>
          {SECTOR_LIST.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(query || sector) && (
          <button
            onClick={() => { setQuery(''); setSector(''); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0 px-1"
          >
            ✕ クリア
          </button>
        )}
      </div>

      {/* 件数表示 */}
      <p className="text-[10px] text-slate-600">
        {filtered.length} 銘柄
        {scores.size > 0 && (
          <span className="ml-2 text-amber-600">★ スクリーニングスコア3以上</span>
        )}
      </p>

      {/* 銘柄ボタン */}
      <div className="flex overflow-x-auto scroll-hide gap-1.5 pb-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">該当銘柄なし</p>
        ) : (
          filtered.map(stock => {
            const isActive = selected.value === stock.value;
            const score = scores.get(stock.value) ?? 0;
            const hasHighScore = score >= 3;
            return (
              <button
                key={stock.value}
                onClick={() => onSelect(stock)}
                className="shrink-0 px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-150 hover:opacity-90 active:scale-95 relative"
                style={{
                  backgroundColor: isActive ? stock.color : '#0f172a',
                  color: isActive ? '#fff' : '#94a3b8',
                  border: `1px solid ${isActive ? stock.color : '#1e293b'}`,
                  boxShadow: isActive ? `0 0 10px ${stock.color}40` : 'none',
                }}
                title={`${stock.label} (${stock.value}) ${stock.sector ?? ''}`}
              >
                {hasHighScore && (
                  <span className="absolute -top-1 -right-1 text-[8px] text-amber-400 leading-none">★</span>
                )}
                <span className="block max-w-[80px] truncate">{stock.label}</span>
                <span className="block text-[9px] opacity-50 font-mono">{stock.value}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
