import type { StockOption, StockData } from '@/types/stock';

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// 260 calendar days ≈ 186 business days (3 phases × ~60 business days)
export function generateMockData(stock: StockOption): StockData[] {
  const rand = seededRandom(parseInt(stock.value));
  const data: StockData[] = [];
  let price = stock.basePrice;
  const today = new Date('2026-06-06');
  let businessDay = 0;

  for (let i = 259; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    businessDay++;

    let drift: number;
    let noise: number;
    let volumeBase: number;

    if (businessDay <= 60) {
      // Phase 1: 上昇トレンド（買い手優勢・出来高増加）
      drift = (rand() - 0.38) * 0.022;
      noise = rand() * 0.010;
      volumeBase = rand() * 2_800_000 + 500_000;
    } else if (businessDay <= 120) {
      // Phase 2: 横ばい・レンジ（膠着・低出来高）
      drift = (rand() - 0.50) * 0.011;
      noise = rand() * 0.007;
      volumeBase = rand() * 1_200_000 + 200_000;
    } else {
      // Phase 3: 下落・調整（売り手優勢・パニック売り）
      drift = (rand() - 0.60) * 0.020;
      noise = rand() * 0.013;
      volumeBase = rand() * 2_300_000 + 400_000;
    }

    const open = price;
    const close = Math.max(price * (1 + drift), stock.basePrice * 0.35);
    const high = Math.max(open, close) * (1 + noise);
    const low  = Math.min(open, close) * (1 - noise);
    const volume = Math.floor(volumeBase);

    price = close;

    data.push({
      date:   d.toISOString().split('T')[0],
      open:   Math.round(open),
      close:  Math.round(close),
      high:   Math.round(high),
      low:    Math.round(low),
      volume,
    });
  }

  return data;
}
