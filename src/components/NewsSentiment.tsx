'use client';

import { useState } from 'react';
import type { NewsItem, NewsSentimentResult, StockOption } from '@/types/stock';
import { fetchNewsSentiment } from '@/lib/api';

interface Props {
  stock: StockOption;
  onResult?: (result: NewsSentimentResult) => void;
}

const SENTIMENT_CONFIG = {
  positive: { label: 'ポジティブ', bg: 'bg-emerald-900/60', text: 'text-emerald-300', border: 'border-emerald-800', bar: 'bg-emerald-500' },
  neutral:  { label: 'ニュートラル', bg: 'bg-slate-800/60',   text: 'text-slate-400',   border: 'border-slate-700',   bar: 'bg-slate-500'   },
  negative: { label: 'ネガティブ',   bg: 'bg-red-900/60',     text: 'text-red-400',     border: 'border-red-800',     bar: 'bg-red-500'     },
} as const;

const IMPACT_CONFIG = {
  high:   { label: '影響大', bg: 'bg-amber-900/50', text: 'text-amber-400' },
  medium: { label: '影響中', bg: 'bg-blue-900/50',  text: 'text-blue-400'  },
  low:    { label: '影響小', bg: 'bg-slate-800',     text: 'text-slate-500' },
} as const;

function SkeletonCard() {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-800 space-y-2.5 animate-pulse">
      <div className="flex justify-between gap-3">
        <div className="h-4 bg-slate-700 rounded flex-1" />
        <div className="h-4 w-16 bg-slate-700 rounded shrink-0" />
      </div>
      <div className="h-3 bg-slate-700/70 rounded w-4/5" />
      <div className="h-2 bg-slate-700/50 rounded-full w-full" />
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-slate-700/50 rounded-full" />
        <div className="h-5 w-12 bg-slate-700/50 rounded-full" />
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const s = SENTIMENT_CONFIG[item.sentiment];
  const imp = IMPACT_CONFIG[item.impact];

  return (
    <div className={`rounded-xl p-4 border ${s.border} bg-slate-900/60 space-y-2.5 hover:bg-slate-900/80 transition-colors`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-200 leading-snug flex-1">{item.title}</h3>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
          {s.label}
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">{item.summary}</p>

      {/* スコアバー */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${s.bar}`}
            style={{ width: `${item.score}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{item.score}</span>
      </div>

      {/* メタ情報 */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className={`px-2 py-0.5 rounded-full font-medium ${imp.bg} ${imp.text}`}>
          {imp.label}
        </span>
        <span className="text-slate-600">{item.source}</span>
        <span className="text-slate-700">·</span>
        <span className="text-slate-600">{item.publishedAt}</span>
      </div>
    </div>
  );
}

export default function NewsSentiment({ stock, onResult }: Props) {
  const [result, setResult] = useState<NewsSentimentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNewsSentiment(stock.value, stock.label);
      setResult(data);
      onResult?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ニュース生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const overall = result ? SENTIMENT_CONFIG[result.overallSentiment] : null;

  return (
    <div className="space-y-4">
      {/* 全体サマリー */}
      {result && overall && (
        <div className={`rounded-xl p-4 border ${overall.border} ${overall.bg} flex items-center justify-between gap-4`}>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">総合感情スコア</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-mono font-bold ${overall.text}`}>
                {result.overallScore}
              </span>
              <span className={`text-sm font-semibold ${overall.text}`}>/ 100</span>
              <span className={`text-sm font-medium ${overall.text}`}>— {overall.label}</span>
            </div>
          </div>
          <div className="w-24 h-24 relative flex-shrink-0">
            <svg viewBox="0 0 36 36" className="rotate-[-90deg]">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={result.overallSentiment === 'positive' ? '#10b981' : result.overallSentiment === 'negative' ? '#ef4444' : '#64748b'}
                strokeWidth="3"
                strokeDasharray={`${result.overallScore} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${overall.text}`}>
              {result.overallScore}
            </span>
          </div>
        </div>
      )}

      {/* 生成ボタン */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-3 px-4 rounded-xl font-semibold text-white text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98]"
        style={{ backgroundColor: result ? '#334155' : stock.color }}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            ニュースを生成中...
          </>
        ) : result ? (
          '再生成する'
        ) : (
          'ニュースを生成する'
        )}
      </button>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ニュース一覧 */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && result && (
        <div className="space-y-3">
          {result.news.map(item => <NewsCard key={item.id} item={item} />)}
        </div>
      )}

      {!loading && !result && (
        <div className="text-center py-12 text-slate-600 text-sm">
          ボタンを押すと{stock.label}の関連ニュースをAIが生成します
        </div>
      )}

      <p className="text-[10px] text-slate-700">
        ※ AIが生成したサンプルニュースです。実際のニュースではありません。投資判断の根拠にしないでください。
      </p>
    </div>
  );
}
