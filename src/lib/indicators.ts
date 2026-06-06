import type { StockData, ChartDataPoint } from '@/types/stock';

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

export function calculateRSI(data: StockData[], period = 14): (number | undefined)[] {
  const closes = data.map(d => d.close);
  const result: (number | undefined)[] = [undefined];

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
      continue;
    }
    if (i > period - 1) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

export function calculateMACD(data: StockData[]): {
  macd: (number | undefined)[];
  signal: (number | undefined)[];
  histogram: (number | undefined)[];
} {
  const closes = data.map(d => d.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);

  const macdLine: (number | undefined)[] = closes.map((_, i) =>
    i >= 25 ? ema12[i] - ema26[i] : undefined
  );

  const validMacd = macdLine.filter((v): v is number => v !== undefined);
  const signalEma = ema(validMacd, 9);

  const signal: (number | undefined)[] = [];
  let idx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    signal.push(macdLine[i] !== undefined ? signalEma[idx++] : undefined);
  }

  const histogram = macdLine.map((m, i) =>
    m !== undefined && signal[i] !== undefined ? m - (signal[i] as number) : undefined
  );

  return { macd: macdLine, signal, histogram };
}

export function calculateBollingerBands(
  data: StockData[],
  period = 20,
  mult = 2
): {
  upper: (number | undefined)[];
  middle: (number | undefined)[];
  lower: (number | undefined)[];
} {
  const closes = data.map(d => d.close);

  const middle = closes.map((_, i) => {
    if (i < period - 1) return undefined;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });

  const upper = middle.map((m, i) => {
    if (m === undefined) return undefined;
    const slice = closes.slice(i - period + 1, i + 1);
    const sd = Math.sqrt(slice.reduce((sum, v) => sum + (v - m) ** 2, 0) / period);
    return m + mult * sd;
  });

  const lower = middle.map((m, i) => {
    if (m === undefined) return undefined;
    const slice = closes.slice(i - period + 1, i + 1);
    const sd = Math.sqrt(slice.reduce((sum, v) => sum + (v - m) ** 2, 0) / period);
    return m - mult * sd;
  });

  return { upper, middle, lower };
}

export function buildChartData(data: StockData[]): ChartDataPoint[] {
  const rsi = calculateRSI(data);
  const { macd, signal, histogram } = calculateMACD(data);
  const { upper, middle, lower } = calculateBollingerBands(data);

  return data.map((d, i) => ({
    ...d,
    rsi: rsi[i],
    macd: macd[i],
    signal: signal[i],
    histogram: histogram[i],
    upperBand: upper[i],
    middleBand: middle[i],
    lowerBand: lower[i],
  }));
}
