'use client';

import { useState, useEffect, useCallback } from 'react';
import { ALL_STOCKS } from '@/lib/stocks';
import {
  buildMarketConditionMap,
  getLatestCondition,
  type MarketCondition,
} from '@/lib/marketFilter';
import type { ScreeningCandidate, ScreeningResult } from '@/app/api/screening/route';
import type { StockOption, StockData } from '@/types/stock';

interface Props {
  onAnalyze: (stock: StockOption) => void;
}

// ── Market condition banner ─────────────────────────────────────────────────

const TREND_STYLE = {
  bull:    { bg: 'bg-emerald-950/40 border-emerald-900/60', text: 'text-emerald-300', badge: 'bg-emerald-900/60 text-emerald-300', label: '強気' },
  bear:    { bg: 'bg-red-950/30 border-red-900/50',         text: 'text-red-300',     badge: 'bg-red-900/50 text-red-300',         label: '弱気' },
  neutral: { bg: 'bg-amber-950/20 border-amber-900/40',     text: 'text-amber-300',   badge: 'bg-amber-900/40 text-amber-300',     label: '中立' },
};

function MarketConditionBanner({ cond }: { cond: MarketCondition }) {
  const st = TREND_STYLE[cond.trend];
  return (
    <div className={`rounded-xl px-4 py-3 border ${st.bg}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.badge}`}>
            {st.label}相場
          </span>
          <span className="text-[10px] text-slate-400">現在の市場環境（日経平均）</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="text-slate-400">
            日経平均 <span className={`font-bold ${st.text}`}>¥{cond.close.toLocaleString()}</span>
          </span>
          <span className="text-slate-500">MA25 <span className="text-slate-300">{cond.ma25.toLocaleString()}</span></span>
          <span className="text-slate-500">MA75 <span className="text-slate-300">{cond.ma75.toLocaleString()}</span></span>
          <span className={`${cond.rsi < 30 ? 'text-red-400' : cond.rsi > 70 ? 'text-amber-400' : 'text-slate-300'}`}>
            RSI <span className="font-bold">{cond.rsi}</span>
          </span>
        </div>
      </div>
      <p className="text-[10px] text-slate-600 mt-1.5">
        {cond.trend === 'bull' && '↑ 上昇トレンド中 — 買いシグナルを優先的に活用できる局面です'}
        {cond.trend === 'bear' && '↓ 下降トレンド中 — 買いシグナルには慎重に対応することをお勧めします'}
        {cond.trend === 'neutral' && '→ トレンドが定まらない局面 — 個別銘柄の状況を重視してください'}
      </p>
    </div>
  );
}

// ── Stock card & helpers ────────────────────────────────────────────────────

const SIGNAL_STYLE: Record<string, string> = {
  'RSI売られ過ぎ':  'bg-red-900/40 text-red-400 border-red-800/60',
  'MACD上昇':       'bg-blue-900/40 text-blue-400 border-blue-800/60',
  '上昇トレンド':   'bg-emerald-900/40 text-emerald-400 border-emerald-800/60',
  '出来高増加':     'bg-amber-900/40 text-amber-400 border-amber-800/60',
  'BB中央より上':   'bg-purple-900/40 text-purple-400 border-purple-800/60',
};

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full flex-1 transition-colors ${
            i < score ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
        />
      ))}
      <span className="text-xs font-mono text-slate-400 ml-1 shrink-0">{score}/5</span>
    </div>
  );
}

function CandidateCard({
  candidate,
  onAnalyze,
}: {
  candidate: ScreeningCandidate;
  onAnalyze: (stock: StockOption) => void;
}) {
  const code = candidate.symbol.replace('.T', '');
  const matchStock = ALL_STOCKS.find(s => s.value === code);

  return (
    <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800/60 hover:border-slate-700 transition-colors space-y-3">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-200 leading-tight">{candidate.name}</p>
          <p className="text-[10px] text-slate-600 font-mono mt-0.5">{candidate.symbol}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-mono font-bold text-slate-100">
            ¥{candidate.price.toLocaleString()}
          </p>
        </div>
      </div>

      {/* スコアバー */}
      <ScoreBar score={candidate.score} />

      {/* テクニカル指標 */}
      <div className="grid grid-cols-3 gap-1 text-[10px]">
        <div className="bg-slate-800/60 rounded-lg p-1.5 text-center">
          <p className="text-slate-600">RSI</p>
          <p className={`font-mono font-semibold ${candidate.rsi < 30 ? 'text-red-400' : candidate.rsi > 70 ? 'text-amber-400' : 'text-slate-300'}`}>
            {candidate.rsi.toFixed(1)}
          </p>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-1.5 text-center">
          <p className="text-slate-600">MACD</p>
          <p className={`font-mono font-semibold ${candidate.macd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {candidate.macd >= 0 ? '+' : ''}{candidate.macd.toFixed(1)}
          </p>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-1.5 text-center">
          <p className="text-slate-600">出来高比</p>
          <p className={`font-mono font-semibold ${candidate.volume_ratio > 1.2 ? 'text-amber-400' : 'text-slate-300'}`}>
            {candidate.volume_ratio.toFixed(2)}x
          </p>
        </div>
      </div>

      {/* シグナルバッジ */}
      {candidate.signals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {candidate.signals.map(sig => (
            <span
              key={sig}
              className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${SIGNAL_STYLE[sig] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}
            >
              {sig}
            </span>
          ))}
        </div>
      )}

      {/* 分析ボタン */}
      <button
        onClick={() => matchStock && onAnalyze(matchStock)}
        disabled={!matchStock}
        className="w-full py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:bg-slate-800 disabled:text-slate-600"
        title={matchStock ? `${candidate.name}を分析` : ''}
      >
        この銘柄を分析 →
      </button>
    </div>
  );
}

export default function Screening({ onAnalyze }: Props) {
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketCond, setMarketCond] = useState<MarketCondition | null>(null);

  // 日経平均トレンド取得（ページロード時1回）
  useEffect(() => {
    fetch('/api/historical/N225')
      .then(r => r.ok ? r.json() : null)
      .then((raw: StockData[] | null) => {
        if (!raw) return;
        const condMap = buildMarketConditionMap(raw);
        setMarketCond(getLatestCondition(condMap));
      })
      .catch(() => { /* N225データなしは無視 */ });
  }, []);

  const fetchResult = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/screening');
      if (!res.ok) {
        if (res.status === 404) {
          setError('スクリーニングデータがありません。\npython scripts/screen_stocks.py を実行してください。');
        } else {
          setError('データ取得に失敗しました');
        }
        return;
      }
      setResult(await res.json() as ScreeningResult);
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResult(); }, [fetchResult]);

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">本日の注目銘柄</h2>
          {result && (
            <p className={`text-[10px] mt-0.5 ${result.stale ? 'text-amber-500' : 'text-slate-600'}`}>
              {result.stale
                ? `⚠ データが古い可能性があります（最終更新: ${result.updatedAt}）`
                : `最終更新: ${result.updatedAt}`}
            </p>
          )}
        </div>
        <button
          onClick={fetchResult}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? '更新中...' : '↺ 再取得'}
        </button>
      </div>

      {/* 市場環境バナー */}
      {marketCond && <MarketConditionBanner cond={marketCond} />}

      {/* データ更新案内 */}
      <div className="bg-slate-800/40 rounded-xl px-4 py-2.5 border border-slate-700/60 text-[10px] text-slate-500">
        データを更新するには:&nbsp;
        <code className="font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
          python scripts/fetch_historical.py
        </code>
        &nbsp;→&nbsp;
        <code className="font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
          python scripts/screen_stocks.py
        </code>
      </div>

      {/* エラー */}
      {error && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-4 text-sm text-slate-400 whitespace-pre-line">
          {error}
        </div>
      )}

      {/* ローディング */}
      {loading && !result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-52 rounded-xl" />
          ))}
        </div>
      )}

      {/* スクリーニング結果 */}
      {result && (
        <>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">
              スコア上位 <span className="text-slate-300 font-semibold">{result.candidates.length}</span> 銘柄
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />スコア5
              <span className="w-2 h-2 rounded-full bg-emerald-700 inline-block ml-1" />スコア3+
              <span className="w-2 h-2 rounded-full bg-slate-700 inline-block ml-1" />未達成
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {result.candidates.map(c => (
              <CandidateCard key={c.symbol} candidate={c} onAnalyze={onAnalyze} />
            ))}
          </div>
        </>
      )}

      <p className="text-[10px] text-slate-700">
        ※ スクリーニング結果は投資助言ではありません。投資判断は自己責任でお願いします。
      </p>
    </div>
  );
}
