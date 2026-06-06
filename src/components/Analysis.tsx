'use client';

import { useState } from 'react';
import type { ChartDataPoint, AnalysisResult, StockOption } from '@/types/stock';
import { analyzeStock } from '@/lib/api';

interface Props {
  stock: StockOption;
  data: ChartDataPoint[];
}

function MetricBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-900 rounded-lg p-3 border border-slate-800/80">
      <dt className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</dt>
      <dd className={`font-mono font-semibold text-sm ${color ?? 'text-slate-100'}`}>{value}</dd>
    </div>
  );
}

function renderContent(content: string) {
  const lines = content.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const m = line.match(/^(\d+)[.．]\s*(.+)/);
        if (m) {
          return (
            <div key={i} className="flex items-start gap-2.5 pt-2 first:pt-0">
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5"
                style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}
              >
                {m[1]}
              </span>
              <p className="text-sm font-semibold text-slate-200 leading-snug">{m[2]}</p>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm text-slate-400 leading-relaxed pl-7">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export default function Analysis({ stock, data }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = data[data.length - 1];

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeStock(stock, data);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const rsiVal = latest?.rsi ?? 50;
  const rsiColor =
    rsiVal > 70 ? 'text-red-400' : rsiVal < 30 ? 'text-blue-400' : 'text-emerald-400';

  const macdColor = (latest?.macd ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400';

  const bbPos = (() => {
    if (!latest?.upperBand || !latest.middleBand || !latest.lowerBand) return null;
    const range = latest.upperBand - latest.middleBand;
    if (range === 0) return null;
    const pct = ((latest.close - latest.middleBand) / range) * 100;
    return { value: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`, color: pct > 80 ? 'text-red-400' : pct < -80 ? 'text-blue-400' : 'text-slate-200' };
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* 現在の指標 */}
      {latest ? (
        <dl className="grid grid-cols-2 gap-2">
          <MetricBadge
            label="終値"
            value={`¥${latest.close.toLocaleString()}`}
          />
          <MetricBadge
            label="RSI (14)"
            value={latest.rsi?.toFixed(1) ?? 'N/A'}
            color={rsiColor}
          />
          <MetricBadge
            label="MACD"
            value={latest.macd?.toFixed(2) ?? 'N/A'}
            color={macdColor}
          />
          <MetricBadge
            label="BB位置"
            value={bbPos?.value ?? 'N/A'}
            color={bbPos?.color}
          />
        </dl>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      )}

      {/* 分析ボタン */}
      <button
        onClick={handleAnalyze}
        disabled={loading || data.length === 0}
        className="w-full py-3 px-4 rounded-xl font-semibold text-white text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98]"
        style={{ backgroundColor: stock.color }}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            AI分析中...
          </>
        ) : (
          'AI分析を実行'
        )}
      </button>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI分析結果</span>
            <span className="text-xs text-slate-600">
              {new Date(result.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {renderContent(result.content)}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <p className="text-xs text-slate-600">
              この分析は投資助言ではありません。投資判断は自己責任でお願いします。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
