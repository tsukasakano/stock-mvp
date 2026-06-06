import type { StockOption, StockData } from '@/types/stock';

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateMockData(stock: StockOption): StockData[] {
  const rand = seededRandom(parseInt(stock.value));
  const data: StockData[] = [];
  let price = stock.basePrice;
  const today = new Date('2026-06-06');

  for (let i = 119; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const drift = (rand() - 0.49) * 0.018;
    const noise = rand() * 0.012;

    const open = price;
    const close = Math.max(price * (1 + drift), stock.basePrice * 0.4);
    const high = Math.max(open, close) * (1 + noise);
    const low = Math.min(open, close) * (1 - noise);
    const volume = Math.floor(rand() * 2000000 + 300000);

    price = close;

    data.push({
      date: d.toISOString().split('T')[0],
      open: Math.round(open),
      close: Math.round(close),
      high: Math.round(high),
      low: Math.round(low),
      volume,
    });
  }

  return data;
}
