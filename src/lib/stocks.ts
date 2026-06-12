import type { StockOption } from '@/types/stock';

export const SECTOR_COLORS: Record<string, string> = {
  '自動車':           '#ef4444',
  '電機・電子':       '#3b82f6',
  '半導体・精密':     '#8b5cf6',
  '商社':             '#f59e0b',
  '金融':             '#10b981',
  '通信':             '#06b6d4',
  'ゲーム・エンタメ': '#ec4899',
  '製薬・医療':       '#14b8a6',
  '小売':             '#f97316',
  '素材・重工':       '#94a3b8',
  '鉄道':             '#84cc16',
  '不動産':           '#a78bfa',
  '食品・タバコ':     '#fb923c',
};

export const SECTOR_LIST = [
  '自動車', '電機・電子', '半導体・精密', '商社', '金融', '通信',
  'ゲーム・エンタメ', '製薬・医療', '小売', '素材・重工', '鉄道', '不動産', '食品・タバコ',
];

type StockDef = {
  symbol: string;
  name: string;
  sector: string;
  basePrice: number;
  color?: string; // override sector color for specific stocks
};

const STOCK_DEFS: StockDef[] = [
  // ── 自動車 ──────────────────────────────────────────
  { symbol: '7203', name: 'トヨタ自動車',       sector: '自動車',           basePrice: 2776,  color: '#ef4444' },
  { symbol: '7267', name: 'ホンダ',             sector: '自動車',           basePrice: 1411 },
  { symbol: '6902', name: 'デンソー',           sector: '自動車',           basePrice: 1854 },
  { symbol: '6201', name: '豊田自動織機',       sector: '自動車',           basePrice: 20450 },
  { symbol: '7261', name: 'マツダ',             sector: '自動車',           basePrice: 1132 },
  // ── 電機・電子 ────────────────────────────────────────
  { symbol: '6758', name: 'ソニーグループ',     sector: '電機・電子',       basePrice: 3292,  color: '#3b82f6' },
  { symbol: '6367', name: 'ダイキン工業',       sector: '電機・電子',       basePrice: 23030 },
  { symbol: '6971', name: '京セラ',             sector: '電機・電子',       basePrice: 3671 },
  { symbol: '7751', name: 'キヤノン',           sector: '電機・電子',       basePrice: 4273 },
  { symbol: '6752', name: 'パナソニック',       sector: '電機・電子',       basePrice: 3800 },
  { symbol: '6501', name: '日立製作所',         sector: '電機・電子',       basePrice: 4657 },
  { symbol: '6645', name: 'オムロン',           sector: '電機・電子',       basePrice: 5490 },
  { symbol: '6503', name: '三菱電機',           sector: '電機・電子',       basePrice: 5545 },
  { symbol: '6702', name: '富士通',             sector: '電機・電子',       basePrice: 3260 },
  { symbol: '6764', name: '三洋電機（廃止）',   sector: '電機・電子',       basePrice: 1000 },
  // ── 半導体・精密 ──────────────────────────────────────
  { symbol: '8035', name: '東京エレクトロン',   sector: '半導体・精密',     basePrice: 68000 },
  { symbol: '6861', name: 'キーエンス',         sector: '半導体・精密',     basePrice: 72620 },
  { symbol: '6954', name: 'ファナック',         sector: '半導体・精密',     basePrice: 6950 },
  { symbol: '7741', name: 'HOYA',               sector: '半導体・精密',     basePrice: 26420 },
  { symbol: '7733', name: 'オリンパス',         sector: '半導体・精密',     basePrice: 1703 },
  // ── 通信 ──────────────────────────────────────────────
  { symbol: '9984', name: 'ソフトバンクG',      sector: '通信',             basePrice: 6472,  color: '#f59e0b' },
  { symbol: '9432', name: 'NTT',                sector: '通信',             basePrice: 148 },
  { symbol: '9433', name: 'KDDI',               sector: '通信',             basePrice: 2769 },
  // ── ゲーム・エンタメ ──────────────────────────────────
  { symbol: '7974', name: '任天堂',             sector: 'ゲーム・エンタメ', basePrice: 7174,  color: '#10b981' },
  { symbol: '4661', name: 'オリエンタルランド', sector: 'ゲーム・エンタメ', basePrice: 2264 },
  { symbol: '7832', name: 'バンダイナムコ',     sector: 'ゲーム・エンタメ', basePrice: 3666 },
  { symbol: '9602', name: '東宝',               sector: 'ゲーム・エンタメ', basePrice: 1312 },
  // ── 商社 ──────────────────────────────────────────────
  { symbol: '8001', name: '伊藤忠商事',         sector: '商社',             basePrice: 1876 },
  { symbol: '8058', name: '三菱商事',           sector: '商社',             basePrice: 4683 },
  { symbol: '8031', name: '三井物産',           sector: '商社',             basePrice: 4886 },
  { symbol: '8053', name: '住友商事',           sector: '商社',             basePrice: 6259 },
  // ── 金融 ──────────────────────────────────────────────
  { symbol: '8306', name: '三菱UFJ',            sector: '金融',             basePrice: 3162 },
  { symbol: '8316', name: '三井住友FG',         sector: '金融',             basePrice: 6406 },
  { symbol: '8411', name: 'みずほFG',           sector: '金融',             basePrice: 7563 },
  { symbol: '8766', name: '東京海上HD',         sector: '金融',             basePrice: 7325 },
  // ── 製薬・医療 ────────────────────────────────────────
  { symbol: '4502', name: '武田薬品',           sector: '製薬・医療',       basePrice: 5082 },
  { symbol: '4519', name: '中外製薬',           sector: '製薬・医療',       basePrice: 7450 },
  { symbol: '4568', name: '第一三共',           sector: '製薬・医療',       basePrice: 2500 },
  { symbol: '4543', name: 'テルモ',             sector: '製薬・医療',       basePrice: 2200 },
  // ── 素材・重工 ────────────────────────────────────────
  { symbol: '4063', name: '信越化学',           sector: '素材・重工',       basePrice: 7188 },
  { symbol: '4183', name: '三井化学',           sector: '素材・重工',       basePrice: 2060 },
  { symbol: '5401', name: '日本製鉄',           sector: '素材・重工',       basePrice: 552 },
  { symbol: '6301', name: 'コマツ',             sector: '素材・重工',       basePrice: 6525 },
  // ── 鉄道 ──────────────────────────────────────────────
  { symbol: '9020', name: '東日本旅客鉄道',     sector: '鉄道',             basePrice: 3404 },
  { symbol: '9021', name: '西日本旅客鉄道',     sector: '鉄道',             basePrice: 2578 },
  { symbol: '9022', name: '東海旅客鉄道',       sector: '鉄道',             basePrice: 3365 },
  // ── 不動産 ────────────────────────────────────────────
  { symbol: '8802', name: '三菱地所',           sector: '不動産',           basePrice: 4196 },
  // ── 小売 ──────────────────────────────────────────────
  { symbol: '3382', name: 'セブン&アイ',        sector: '小売',             basePrice: 1946 },
  { symbol: '9983', name: 'ファーストリテイリング', sector: '小売',         basePrice: 80530 },
  // ── 食品・タバコ ──────────────────────────────────────
  { symbol: '2914', name: 'JT',                 sector: '食品・タバコ',     basePrice: 6177 },
];

export const ALL_STOCKS: StockOption[] = STOCK_DEFS.map(d => ({
  value:     d.symbol,
  label:     d.name,
  color:     d.color ?? SECTOR_COLORS[d.sector] ?? '#94a3b8',
  basePrice: d.basePrice,
  sector:    d.sector,
}));

// Original 4 stocks — kept for backward compatibility
export const STOCKS: StockOption[] = ALL_STOCKS.filter(s =>
  ['7203', '6758', '9984', '7974'].includes(s.value),
);
