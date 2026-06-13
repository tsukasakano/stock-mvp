'use client';

import { useEffect, useState } from 'react';
import type { DataStatusResponse } from '@/app/api/update/route';

export type { DataStatusResponse };

function formatDate(updatedAt: string): string {
  // Input: "2026-06-13 14:30:00" → Output: "2026/06/13 14:30"
  const [datePart, timePart] = updatedAt.split(' ');
  if (!datePart) return updatedAt;
  const formattedDate = datePart.replace(/-/g, '/');
  if (!timePart) return formattedDate;
  const [hh, mm] = timePart.split(':');
  return `${formattedDate} ${hh}:${mm}`;
}

function isStale(updatedAt: string | null): boolean {
  if (!updatedAt) return false;
  const updated = new Date(updatedAt.replace(' ', 'T'));
  const now = new Date();
  return now.getTime() - updated.getTime() > 24 * 60 * 60 * 1000;
}

export default function DataStatus() {
  const [status, setStatus] = useState<DataStatusResponse | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/update')
      .then((res) => res.json())
      .then((data: DataStatusResponse) => setStatus(data))
      .catch(() => {
        // API not available yet — silently ignore
      });
  }, []);

  const stale = isStale(status?.updatedAt ?? null);

  const dotColor =
    status?.updatedAt == null
      ? 'bg-slate-500'
      : stale
      ? 'bg-amber-400'
      : 'bg-green-400';

  const handleUpdate = async () => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch('/api/update', { method: 'POST' });
      const data = (await res.json()) as DataStatusResponse & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? 'アップデートに失敗しました');
        setUpdating(false);
        return;
      }
      setStatus(data);
      setUpdating(false);
      if (data.success === true) {
        window.location.reload();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'アップデートに失敗しました';
      setError(message);
      setUpdating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-slate-900/80 border-b border-slate-800/60 text-xs">
        {/* Left: dot + label */}
        <div className="flex items-center gap-2 text-slate-400">
          <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <span>
            データ更新:{' '}
            {status?.updatedAt ? (
              <span className="text-slate-300">{formatDate(status.updatedAt)}</span>
            ) : (
              <span className="text-slate-500">データ未取得</span>
            )}
          </span>
          {stale && (
            <span className="text-amber-400 ml-1">⚠ データが古くなっています</span>
          )}
        </div>

        {/* Right: update button */}
        <button
          onClick={handleUpdate}
          disabled={updating}
          className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
            updating
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          {updating && (
            <svg
              className="animate-spin w-2.5 h-2.5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          )}
          {updating ? '更新中...' : 'データを更新する'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-1 text-[10px] text-amber-400 bg-slate-900/80">
          {error}
        </div>
      )}
    </div>
  );
}
