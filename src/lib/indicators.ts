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

export function calcSMA(data: StockData[], period: number): (number | undefined)[] {
  const closes = data.map(d => d.close);
  return closes.map((_, i) => {
    if (i < period - 1) return undefined;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

export function calcATR(data: StockData[], period = 14): (number | undefined)[] {
  if (data.length < 2) return data.map(() => undefined);

  const trValues: number[] = [data[0].high - data[0].low];
  for (let i = 1; i < data.length; i++) {
    const hl = data[i].high - data[i].low;
    const hc = Math.abs(data[i].high - data[i - 1].close);
    const lc = Math.abs(data[i].low  - data[i - 1].close);
    trValues.push(Math.max(hl, hc, lc));
  }

  const result: (number | undefined)[] = [];
  let atr = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
    } else if (i === period - 1) {
      result.push(atr);
    } else {
      atr = (atr * (period - 1) + trValues[i]) / period;
      result.push(atr);
    }
  }

  return result;
}

export function calcStochastic(
  data: StockData[],
  kPeriod = 14,
  dPeriod = 3,
): {
  stochK: (number | undefined)[];
  stochD: (number | undefined)[];
  stochSlowK: (number | undefined)[];
  stochSlowD: (number | undefined)[];
} {
  const rawK: (number | undefined)[] = data.map((_, i) => {
    if (i < kPeriod - 1) return undefined;
    const slice = data.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...slice.map(d => d.high));
    const lowest  = Math.min(...slice.map(d => d.low));
    return highest === lowest ? 50 : ((data[i].close - lowest) / (highest - lowest)) * 100;
  });

  // %D = SMA(rawK, dPeriod)
  const stochD: (number | undefined)[] = rawK.map((_, i) => {
    const slice = rawK.slice(Math.max(0, i - dPeriod + 1), i + 1).filter((v): v is number => v !== undefined);
    if (slice.length < dPeriod) return undefined;
    return slice.reduce((a, b) => a + b, 0) / dPeriod;
  });

  // SlowK = %D, SlowD = SMA(SlowK, dPeriod)
  const stochSlowK = stochD;
  const stochSlowD: (number | undefined)[] = stochSlowK.map((_, i) => {
    const slice = stochSlowK.slice(Math.max(0, i - dPeriod + 1), i + 1).filter((v): v is number => v !== undefined);
    if (slice.length < dPeriod) return undefined;
    return slice.reduce((a, b) => a + b, 0) / dPeriod;
  });

  return { stochK: rawK, stochD, stochSlowK, stochSlowD };
}

export function calcIchimoku(data: StockData[]): {
  tenkan:  (number | undefined)[];
  kijun:   (number | undefined)[];
  span1:   (number | undefined)[];
  span2:   (number | undefined)[];
  lagging: (number | undefined)[];
} {
  const n = data.length;

  function midHL(arr: StockData[], i: number, period: number): number | undefined {
    if (i < period - 1) return undefined;
    const slice = arr.slice(i - period + 1, i + 1);
    const h = Math.max(...slice.map(d => d.high));
    const l = Math.min(...slice.map(d => d.low));
    return (h + l) / 2;
  }

  const tenkan: (number | undefined)[] = data.map((_, i) => midHL(data, i, 9));
  const kijun:  (number | undefined)[] = data.map((_, i) => midHL(data, i, 26));

  // Span1 and Span2 are plotted 26 periods ahead — store at index i+26
  const span1Raw: (number | undefined)[] = data.map((_, i) => {
    const t = tenkan[i], k = kijun[i];
    return t !== undefined && k !== undefined ? (t + k) / 2 : undefined;
  });
  const span2Raw: (number | undefined)[] = data.map((_, i) => midHL(data, i, 52));

  // Shift forward by 26 into output arrays of the same length
  const span1: (number | undefined)[] = Array(n).fill(undefined);
  const span2: (number | undefined)[] = Array(n).fill(undefined);
  for (let i = 0; i < n; i++) {
    if (i + 26 < n) {
      span1[i + 26] = span1Raw[i];
      span2[i + 26] = span2Raw[i];
    }
  }

  // Lagging span = close shifted back 26 periods
  const lagging: (number | undefined)[] = Array(n).fill(undefined);
  for (let i = 26; i < n; i++) {
    lagging[i - 26] = data[i].close;
  }

  return { tenkan, kijun, span1, span2, lagging };
}

export function buildChartData(data: StockData[]): ChartDataPoint[] {
  const rsi = calculateRSI(data);
  const { macd, signal, histogram } = calculateMACD(data);
  const { upper, middle, lower } = calculateBollingerBands(data);
  const ma75  = calcSMA(data, 75);
  const ma200 = calcSMA(data, 200);
  const atrArr = calcATR(data);
  const { stochK, stochD, stochSlowK, stochSlowD } = calcStochastic(data);
  const { tenkan, kijun, span1, span2, lagging } = calcIchimoku(data);

  return data.map((d, i) => {
    const atrVal = atrArr[i];
    return {
      ...d,
      rsi: rsi[i],
      macd: macd[i],
      signal: signal[i],
      histogram: histogram[i],
      upperBand: upper[i],
      middleBand: middle[i],
      lowerBand: lower[i],
      ma75: ma75[i],
      ma200: ma200[i],
      atr: atrVal,
      atrPct: atrVal !== undefined && d.close > 0 ? (atrVal / d.close) * 100 : undefined,
      stochK: stochK[i],
      stochD: stochD[i],
      stochSlowK: stochSlowK[i],
      stochSlowD: stochSlowD[i],
      ichimokuTenkan:  tenkan[i],
      ichimokuKijun:   kijun[i],
      ichimokuSpan1:   span1[i],
      ichimokuSpan2:   span2[i],
      ichimokuLagging: lagging[i],
    };
  });
}
