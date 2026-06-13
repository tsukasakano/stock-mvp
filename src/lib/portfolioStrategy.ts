export type StockStrategy = {
  symbol: string;
  name: string;
  buyRuleId: string;
  sellRuleId?: string;
  takeProfit: number;
  trailingStop: number;
  maxHoldDays: number;
  reason: string;
};

export const DEFAULT_STRATEGIES: StockStrategy[] = [
  {
    symbol: '4063',
    name: '信越化学',
    buyRuleId: 'preset-ai-rsi-enhanced',
    sellRuleId: 'preset-sell-profit-take',
    takeProfit: 10,
    trailingStop: 3,
    maxHoldDays: 20,
    reason: '逆張りRSI強化版+利益確定売り。テクニカル反転時の優位性が高い素材株',
  },
  {
    symbol: '6367',
    name: 'ダイキン工業',
    buyRuleId: 'preset-ai-rsi-enhanced',
    sellRuleId: 'preset-sell-profit-take',
    takeProfit: 10,
    trailingStop: 3,
    maxHoldDays: 20,
    reason: '安定した業績背景で逆張り戦略が有効。利益確定売りと相性が良い',
  },
  {
    symbol: '9984',
    name: 'ソフトバンクG',
    buyRuleId: 'preset-ai-rsi-enhanced',
    sellRuleId: 'preset-sell-profit-take',
    takeProfit: 10,
    trailingStop: 3,
    maxHoldDays: 20,
    reason: 'ボラティリティが高く逆張り戦略のリターンが大きい。早期利確が重要',
  },
  {
    symbol: '6201',
    name: '豊田自動織機',
    buyRuleId: 'preset-ai-rsi-enhanced',
    sellRuleId: 'preset-sell-profit-take',
    takeProfit: 10,
    trailingStop: 3,
    maxHoldDays: 20,
    reason: 'トレンドの転換点でRSIダイバージェンスが機能しやすい自動車関連株',
  },
  {
    symbol: '6758',
    name: 'ソニーグループ',
    buyRuleId: 'preset-ai-rsi-enhanced',
    sellRuleId: 'preset-sell-profit-take',
    takeProfit: 10,
    trailingStop: 3,
    maxHoldDays: 20,
    reason: '多角経営で安定。逆張り+利益確定の組み合わせがリスク管理に優れる',
  },
  {
    symbol: '7974',
    name: '任天堂',
    buyRuleId: 'preset-rsi-buy',
    sellRuleId: undefined,
    takeProfit: 5,
    trailingStop: 3,
    maxHoldDays: 20,
    reason: 'RSI単体の単純逆張りが効果的。過去検証でシャープ比1.88を記録',
  },
  {
    symbol: '5401',
    name: '日本製鉄',
    buyRuleId: 'preset-ai-rsi-enhanced',
    sellRuleId: 'preset-sell-profit-take',
    takeProfit: 10,
    trailingStop: 3,
    maxHoldDays: 20,
    reason: '景気循環株としてRSI売られ過ぎ時の反発が鋭い',
  },
  {
    symbol: '4519',
    name: '中外製薬',
    buyRuleId: 'preset-ai-rsi-enhanced',
    sellRuleId: 'preset-sell-profit-take',
    takeProfit: 10,
    trailingStop: 3,
    maxHoldDays: 20,
    reason: 'ディフェンシブ製薬株。逆張りでの安定したリターンが期待できる',
  },
];

export function getStrategy(symbol: string): StockStrategy | undefined {
  return DEFAULT_STRATEGIES.find(s => s.symbol === symbol);
}
