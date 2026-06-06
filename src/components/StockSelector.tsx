'use client';

import type { StockOption } from '@/types/stock';
import { STOCKS } from '@/lib/stocks';
export { STOCKS } from '@/lib/stocks';

interface Props {
  selected: StockOption;
  onSelect: (stock: StockOption) => void;
}

export default function StockSelector({ selected, onSelect }: Props) {
  return (
    <div className="flex overflow-x-auto scroll-hide gap-2 pb-0.5">
      {STOCKS.map(stock => {
        const isActive = selected.value === stock.value;
        return (
          <button
            key={stock.value}
            onClick={() => onSelect(stock)}
            className="shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: isActive ? stock.color : '#0f172a',
              color: isActive ? '#fff' : '#94a3b8',
              transform: isActive ? 'scale(1.03)' : 'scale(1)',
              border: `1px solid ${isActive ? stock.color : '#1e293b'}`,
              boxShadow: isActive ? `0 0 12px ${stock.color}40` : 'none',
            }}
          >
            {stock.label}
            <span className="ml-1 text-xs opacity-60">({stock.value})</span>
          </button>
        );
      })}
    </div>
  );
}
