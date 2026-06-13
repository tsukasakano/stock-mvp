export interface StockData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartDataPoint extends StockData {
  rsi?: number;
  macd?: number;
  signal?: number;
  histogram?: number;
  upperBand?: number;
  middleBand?: number;
  lowerBand?: number;
  // Extended indicators (v0.9.18)
  ma75?: number;
  ma200?: number;
  atr?: number;
  atrPct?: number;
  stochK?: number;
  stochD?: number;
  stochSlowK?: number;
  stochSlowD?: number;
  ichimokuTenkan?: number;
  ichimokuKijun?: number;
  ichimokuSpan1?: number;
  ichimokuSpan2?: number;
  ichimokuLagging?: number;
}

export interface TradeJournalEntry {
  id: string;
  date: string;
  stock: string;
  stockLabel: string;
  action: 'buy' | 'sell';
  price: number;
  quantity: number;
  memo: string;
}

export interface AnalysisResult {
  content: string;
  timestamp: string;
}

export interface StockOption {
  value: string;
  label: string;
  color: string;
  basePrice: number;
  sector?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  source: string;
  publishedAt: string;
  impact: 'high' | 'medium' | 'low';
}

export interface NewsSentimentResult {
  news: NewsItem[];
  overallSentiment: 'positive' | 'neutral' | 'negative';
  overallScore: number;
}

export type RuleIndicator =
  | 'rsi' | 'macd' | 'signal' | 'price' | 'ma5' | 'ma25' | 'volume'
  | 'bbUpper' | 'bbLower' | 'bbMid' | 'bbWidth' | 'volumeMA'
  | 'rsiDivergence' | 'priceVsMA20' | 'volumeRatio'
  | 'ma75' | 'ma200' | 'atr' | 'atrPct' | 'stochK' | 'stochD' | 'ichimokuCloud';
export type RuleOperator = '>' | '<' | '>=' | '<=' | 'crossover' | 'crossunder';

export interface RuleCondition {
  indicator: RuleIndicator;
  operator: RuleOperator;
  value: number;
  compareIndicator?: RuleIndicator; // 別の指標と動的比較する場合に指定
}

export interface TradeRule {
  id: string;
  name: string;
  type: 'buy' | 'sell';
  conditions: RuleCondition[];
  logic: 'AND' | 'OR';
  enabled: boolean;
}

export interface RuleSignal {
  ruleId: string;
  ruleName: string;
  type: 'buy' | 'sell';
  triggered: boolean;
}

export interface AlertEntry {
  id: string;
  stockCode: string;
  stockLabel: string;
  ruleName: string;
  signal: 'buy' | 'sell';
  price: number;
  triggeredAt: string;
  read: boolean;
}
