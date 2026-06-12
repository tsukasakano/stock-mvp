import type { StockData } from '@/types/stock';

export async function fetchHistoricalData(symbol: string): Promise<StockData[] | null> {
  try {
    const res = await fetch(`/api/historical/${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    return (await res.json()) as StockData[];
  } catch {
    return null;
  }
}
