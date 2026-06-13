'use client';

import { useEffect, useState } from 'react';
import type { DataStatusResponse } from '@/app/api/update/route';
import type { DataSource } from '@/lib/api';

export type { DataStatusResponse };

interface Props {
  dataSource?: DataSource;
  stockLabel?: string;
}

const SOURCE_LABEL: Record<DataSource, string> = {
  yfinance: 'yfinance',
  jquants:  'J-Quants',
  mock:     'モック',
};

const SOURCE_STYLE: Record<DataSource, string> = {
  yfinance: 'bg-emerald-950 text-emerald-400 border-emerald-900',
  jquants:  'bg-blue-950 text-blue-400 border-blue-900',
  mock:     'bg-slate-800 text-slate-500 border-slate-700',
};

function formatDate(updatedAt: string): string {
  const [datePart, timePart] = updatedAt.split(' ');
  if (!datePart) return updatedAt;
  const d = datePart.replace(/-/g, '/');
  if (!timePart) return d;
  const [hh, mm] = timePart.split(':');
  return `${d} ${hh}:${mm}`;
}

function isStale(updatedAt: string | null): boolean {
  if (!updatedAt) return false;
  const updated = new Date(updatedAt.replace(' ', 'T'));
  return Date.now() - updated.getTime() > 24 * 60 * 60 * 1000;
}

export default function DataStatus({ dataSource, stockLabel }: Props) {
  const [status, setStatus] = useState<DataStatusResponse | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetch('/api/update')
      .then(res => res.json())
      .then((data: DataStatusResponse) => setStatus(data))
      .catch(() => { /* API 未起動時は無視 */ });
  }, []);

  const stale = isStale(status?.updatedAt ?? null);
  const hoursAgo = status?.hoursAgo;
  const nextUpdateIn = status?.nextUpdateIn;
  const onCooldown = nextUpdateIn !== undefined && nextUpdateIn > 0;

  const dotColor = status?.updatedAt == null
    ? 'bg-slate-500'
    : stale
    ? 'bg-amber-400'
    : 'bg-emerald-400';

  const executeUpdate = async (force = false) => {
    setShowConfirm(false);
    setUpdating(true);
    setError(null);
    try {
      const url = force ? '/api/update?force=true' : '/api/update';
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json() as DataStatusResponse & { error?: string };

      if (!res.ok && data.error) {
        setError(data.error);
        setUpdating(false);
        return;
      }

      if (data.skipped) {
        setStatus(data);
        setUpdating(false);
        setError(`クールダウン中のため更新をスキップしました（次回: ${data.nextUpdateIn?.toFixed(1)}時間後）`);
        return;
      }

      setStatus(data);
      setUpdating(false);
      if (data.success === true) {
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップデートに失敗しました');
      setUpdating(false);
    }
  };

  const handleButtonClick = () => {
    if (onCooldown) return;
    setShowConfirm(true);
  };

  return (
    <>
      <div className="border-b border-slate-800/60 bg-slate-900/80 text-xs">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
          {/* 左側: 更新日時 + 古さ警告 */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
              <span>
                データ更新:{' '}
                {status?.updatedAt ? (
                  <span className="text-slate-300">{formatDate(status.updatedAt)}</span>
                ) : (
                  <span className="text-slate-500">未取得</span>
                )}
              </span>
              {hoursAgo !== undefined && (
                <span className="text-slate-600">
                  ({hoursAgo < 1 ? '1時間以内' : `${hoursAgo.toFixed(0)}時間前`})
                </span>
              )}
            </div>

            {stale && (
              <span className="text-amber-400">⚠ データが古くなっています（24時間以上）</span>
            )}

            {/* 銘柄別データソースバッジ */}
            {dataSource && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${SOURCE_STYLE[dataSource]}`}>
                {stockLabel ? `${stockLabel}: ` : ''}{SOURCE_LABEL[dataSource]}
              </span>
            )}
          </div>

          {/* 右側: 更新ボタン */}
          <div className="flex items-center gap-2">
            {onCooldown && !updating && (
              <span className="text-[10px] text-slate-600">
                次回更新可能: {nextUpdateIn! < 1 ? 'まもなく' : `${nextUpdateIn!.toFixed(1)}時間後`}
              </span>
            )}
            <button
              onClick={handleButtonClick}
              disabled={updating || onCooldown}
              title={onCooldown ? `クールダウン中（次回: ${nextUpdateIn?.toFixed(1)}時間後）` : 'Yahoo Financeからデータを更新'}
              className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                updating
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : onCooldown
                  ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-700/50'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {updating && (
                <svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {updating ? '更新中...' : onCooldown ? '更新済み' : 'データを更新する'}
            </button>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 pb-1.5 text-[10px] text-amber-400">
            {error}
          </div>
        )}
      </div>

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4">
            <p className="text-sm font-semibold text-slate-200">データを更新しますか？</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Yahoo Finance から全銘柄のデータを取得します。<br />
              取得には数分かかります。<br />
              <span className="text-amber-400">短時間での連続実行はお控えください。</span>
            </p>
            <p className="text-[10px] text-slate-600">
              次回更新可能になるまで 6時間 のクールダウンが適用されます。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => executeUpdate(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 transition-colors"
              >
                更新する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
