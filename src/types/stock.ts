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

export type RuleIndicator = 'rsi' | 'macd' | 'price' | 'ma5' | 'ma25' | 'volume';
export type RuleOperator = '>' | '<' | '>=' | '<=' | 'crossover' | 'crossunder';

export interface RuleCondition {
  indicator: RuleIndicator;
  operator: RuleOperator;
  value: number;
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
