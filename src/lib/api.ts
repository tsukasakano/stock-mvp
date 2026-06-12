import type { ChartDataPoint, AnalysisResult, StockOption, StockData, NewsSentimentResult } from '@/types/stock';

export type DataSource = 'jquants' | 'mock' | 'historical';

export async function fetchStockData(
  code: string,
): Promise<{ data: StockData[]; source: DataSource }> {
  const res = await fetch(`/api/stocks?code=${code}`);
  if (!res.ok) throw new Error('株価データの取得に失敗しました');
  return res.json() as Promise<{ data: StockData[]; source: DataSource }>;
}

export async function fetchNewsSentiment(
  stockCode: string,
  stockName: string,
): Promise<NewsSentimentResult> {
  const res = await fetch('/api/news', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stockCode, stockName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'ニュース生成に失敗しました' }));
    throw new Error((err as { error?: string }).error ?? 'ニュース生成に失敗しました');
  }
  return res.json() as Promise<NewsSentimentResult>;
}

export async function analyzeStock(
  stock: StockOption,
  data: ChartDataPoint[],
  newsResult?: NewsSentimentResult,
): Promise<AnalysisResult> {
  const recent = data.slice(-20);
  const latest = recent[recent.length - 1];
  const oldest = recent[0];
  const priceChange = ((latest.close - oldest.close) / oldest.close * 100).toFixed(2);

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stockCode: stock.value,
      stockName: stock.label,
      latestClose: latest.close,
      latestRSI: latest.rsi,
      latestMACD: latest.macd,
      latestSignal: latest.signal,
      upperBand: latest.upperBand,
      lowerBand: latest.lowerBand,
      middleBand: latest.middleBand,
      priceChange,
      newsOverallSentiment: newsResult?.overallSentiment,
      newsOverallScore: newsResult?.overallScore,
      newsHeadlines: newsResult?.news
        .filter(n => n.impact === 'high')
        .slice(0, 3)
        .map(n => `「${n.title}」(${n.sentiment})`)
        .join('、'),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '分析に失敗しました' }));
    throw new Error((err as { error?: string }).error ?? '分析に失敗しました');
  }

  const result = await res.json() as { content: string };
  return {
    content: result.content,
    timestamp: new Date().toISOString(),
  };
}
