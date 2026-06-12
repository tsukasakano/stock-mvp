'use client';

import { useEffect, useState } from 'react';
import type { AlertEntry } from '@/types/stock';
import { requestNotificationPermission } from '@/lib/ruleEngine';

interface Props {
  alerts: AlertEntry[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return new Date(iso).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AlertPanel({ alerts, onMarkRead, onMarkAllRead, onClear }: Props) {
  const [notifState, setNotifState] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    if (!('Notification' in window)) {
      setNotifState('unsupported');
    } else {
      setNotifState(Notification.permission);
    }
  }, []);

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setNotifState(granted ? 'granted' : 'denied');
  };

  const unread = alerts.filter(a => !a.read).length;

  return (
    <div className="space-y-4">
      {/* 通知許可バナー */}
      {notifState === 'default' && (
        <div className="flex items-center justify-between gap-3 bg-blue-950/50 border border-blue-800/60 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-300">ブラウザ通知を有効にするとシグナル発動時に通知されます</p>
          <button
            onClick={handleRequestPermission}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-medium transition-colors"
          >
            許可する
          </button>
        </div>
      )}
      {notifState === 'granted' && (
        <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-950/30 border border-emerald-900/40 rounded-xl px-3 py-2">
          <span>●</span> ブラウザ通知 有効
        </div>
      )}
      {notifState === 'denied' && (
        <div className="text-xs text-slate-500 bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2">
          通知はブロックされています。ブラウザの設定から許可してください。
        </div>
      )}

      {/* ヘッダー操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">シグナル履歴</span>
          {unread > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white">
              {unread}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              すべて既読
            </button>
          )}
          {alerts.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-slate-600 hover:text-red-400 transition-colors"
            >
              クリア
            </button>
          )}
        </div>
      </div>

      {/* アラート一覧 */}
      {alerts.length === 0 ? (
        <div className="text-center py-10 text-slate-600 text-sm">
          シグナル履歴がありません
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              onClick={() => onMarkRead(alert.id)}
              className={`flex items-start gap-3 rounded-xl p-3 border cursor-pointer transition-colors ${
                alert.read
                  ? 'bg-slate-900/40 border-slate-800/40'
                  : alert.signal === 'buy'
                  ? 'bg-emerald-950/40 border-emerald-900/60 hover:bg-emerald-950/60'
                  : 'bg-red-950/40 border-red-900/60 hover:bg-red-950/60'
              }`}
            >
              {/* シグナルバッジ */}
              <span className={`shrink-0 mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                alert.signal === 'buy'
                  ? 'bg-emerald-700 text-emerald-100'
                  : 'bg-red-700 text-red-100'
              }`}>
                {alert.signal === 'buy' ? '買' : '売'}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${alert.read ? 'text-slate-400' : 'text-slate-100'}`}>
                    {alert.stockLabel}
                  </span>
                  <span className="text-xs text-slate-500">{alert.stockCode}</span>
                  <span className="font-mono text-xs text-slate-400">
                    ¥{alert.price.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{alert.ruleName}</p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[10px] text-slate-600">{timeAgo(alert.triggeredAt)}</p>
                {!alert.read && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 ml-auto mt-1" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
