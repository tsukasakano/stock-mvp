import type { StockData, ChartDataPoint } from '@/types/stock';

export type RealPeriod = 'real-1y' | 'real-3y' | 'real-5y';

export async function fetchHistoricalData(symbol: string): Promise<StockData[] | null> {
  try {
    const res = await fetch(`/api/historical/${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    return (await res.json()) as StockData[];
  } catch {
    return null;
  }
}

export function filterByPeriod(data: ChartDataPoint[], mode: RealPeriod): ChartDataPoint[] {
  const years = mode === 'real-1y' ? 1 : mode === 'real-3y' ? 3 : 5;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return data.filter(d => d.date >= cutoffStr);
}
