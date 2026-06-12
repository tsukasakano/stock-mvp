'use client';

import { useState, useEffect, useCallback } from 'react';
import StockSelector from '@/components/StockSelector';
import { STOCKS } from '@/lib/stocks';
import Chart from '@/components/Chart';
import Analysis from '@/components/Analysis';
import Journal from '@/components/Journal';
import Simulator from '@/components/Simulator';
import NisaManager from '@/components/NisaManager';
import NewsSentiment from '@/components/NewsSentiment';
import RuleEngine from '@/components/RuleEngine';
import AlertPanel from '@/components/AlertPanel';
import Backtest from '@/components/Backtest';
import Screening from '@/components/Screening';
import { buildChartData } from '@/lib/indicators';
import { fetchStockData, type DataSource } from '@/lib/api';
import { loadAlerts, saveAlerts } from '@/lib/ruleEngine';
import type { ChartDataPoint, StockOption, NewsSentimentResult, AlertEntry } from '@/types/stock';

type Tab = 'screening' | 'chart' | 'journal' | 'simulator' | 'nisa' | 'news' | 'rules' | 'backtest';

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: 'screening', label: '🔍 スクリーニング',  short: '🔍' },
  { id: 'chart',     label: 'チャート・分析',    short: 'チャート' },
  { id: 'journal',   label: 'トレード日誌',       short: '日誌' },
  { id: 'simulator', label: '損益シミュレーター', short: '損益' },
  { id: 'nisa',      label: 'NISA管理',           short: 'NISA' },
  { id: 'news',      label: 'ニュース分析',        short: 'ニュース' },
  { id: 'rules',     label: '売買ルール',          short: 'ルール' },
  { id: 'backtest',  label: 'バックテスト',        short: 'BT' },
];

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <div className="skeleton h-[260px]" />
      <div className="skeleton h-[100px]" />
      <div className="skeleton h-[110px]" />
    </div>
  );
}

export default function Home() {
  const [stock, setStock] = useState<StockOption>(STOCKS[0]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>('mock');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('chart');
  const [newsResult, setNewsResult] = useState<NewsSentimentResult | null>(null);
  const [alerts, setAlerts] = useState<AlertEntry[]>(() => {
    if (typeof window !== 'undefined') return loadAlerts();
    return [];
  });

  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  const handleAnalyze = useCallback((s: StockOption) => {
    setStock(s);
    setActiveTab('chart');
  }, []);

  const handleNewAlerts = useCallback((newAlerts: AlertEntry[]) => {
    setAlerts(prev => {
      const existingIds = new Set(prev.map(a => a.id));
      const deduplicated = newAlerts.filter(a => !existingIds.has(a.id));
      if (deduplicated.length === 0) return prev;
      return [...deduplicated, ...prev];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    setNewsResult(null);

    fetchStockData(stock.value)
      .then(({ data, source }) => {
        if (cancelled) return;
        setChartData(buildChartData(data));
        setDataSource(source);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'データ取得に失敗しました');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [stock]);

  const latest = chartData[chartData.length - 1];
  const prev = chartData[chartData.length - 2];
  const priceChange = latest && prev ? latest.close - prev.close : 0;
  const pricePct = prev ? (priceChange / prev.close) * 100 : 0;
  const isUp = priceChange >= 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ヘッダー */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">株式テクニカル分析</h1>
            <p className="text-[10px] text-slate-600 mt-0.5">Capital Gain Prediction MVP</p>
          </div>
          {latest ? (
            <div className="text-right">
              <div className="text-lg font-mono font-bold leading-none" style={{ color: stock.color }}>
                ¥{latest.close.toLocaleString()}
              </div>
              <div className={`text-xs font-mono mt-0.5 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {isUp ? '+' : ''}{priceChange.toLocaleString()}&nbsp;
                ({isUp ? '+' : ''}{pricePct.toFixed(2)}%)
              </div>
            </div>
          ) : loading ? (
            <div className="skeleton h-9 w-28" />
          ) : null}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">

        {/* 銘柄選択 */}
        <div className="bg-slate-900 rounded-2xl px-4 py-3.5 border border-slate-800/60">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2.5">銘柄</p>
          <StockSelector selected={stock} onSelect={setStock} />
        </div>

        {/* エラー */}
        {error && (
          <div className="bg-red-950/60 border border-red-800/60 rounded-2xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* タブナビ */}
        <div className="flex overflow-x-auto scroll-hide gap-1 bg-slate-900 p-1.5 rounded-2xl border border-slate-800/60">
          {TABS.map(tab => {
            const unreadCount = tab.id === 'rules' ? alerts.filter(a => !a.read).length : 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative shrink-0 sm:flex-1 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-slate-700 text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full bg-red-600 text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* タブコンテンツ */}
        <div key={activeTab} className="tab-content">

          {activeTab === 'screening' && (
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800/60">
              <Screening onAnalyze={handleAnalyze} />
            </div>
          )}

          {activeTab === 'chart' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* チャート */}
              <div className="lg:col-span-2 bg-slate-900 rounded-2xl p-4 border border-slate-800/60">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-sm font-semibold text-slate-200">{stock.label}</h2>
                  <span className="text-xs text-slate-600">({stock.value})</span>
                  {loading ? (
                    <span className="text-xs text-slate-600 animate-pulse">読込中</span>
                  ) : (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                      dataSource === 'jquants'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}>
                      {dataSource === 'jquants' ? 'リアルデータ' : 'デモデータ'}
                    </span>
                  )}
                </div>
                {loading ? <ChartSkeleton /> : <Chart data={chartData} color={stock.color} />}
              </div>

              {/* AI分析 */}
              <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800/60">
                <h2 className="text-sm font-semibold text-slate-200 mb-4">AI分析</h2>
                <Analysis stock={stock} data={chartData} newsResult={newsResult ?? undefined} />
              </div>
            </div>
          )}

          {activeTab === 'journal' && (
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800/60">
              <Journal currentStock={stock} currentPrice={latest?.close ?? 0} />
            </div>
          )}

          {activeTab === 'simulator' && (
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800/60">
              <div className="flex items-baseline gap-2 mb-5">
                <h2 className="text-sm font-semibold text-slate-200">損益シミュレーター</h2>
                <span className="text-xs text-slate-600">{stock.label}（{stock.value}）</span>
              </div>
              <Simulator stock={stock} currentPrice={latest?.close ?? 0} />
            </div>
          )}

          {activeTab === 'nisa' && (
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800/60">
              <h2 className="text-sm font-semibold text-slate-200 mb-5">NISA管理</h2>
              <NisaManager />
            </div>
          )}

          {activeTab === 'news' && (
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800/60">
              <div className="flex items-baseline gap-2 mb-5">
                <h2 className="text-sm font-semibold text-slate-200">ニュース感情分析</h2>
                <span className="text-xs text-slate-600">{stock.label}（{stock.value}）</span>
              </div>
              <NewsSentiment stock={stock} onResult={setNewsResult} />
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800/60">
                <div className="flex items-baseline gap-2 mb-4">
                  <h2 className="text-sm font-semibold text-slate-200">売買ルールエンジン</h2>
                  <span className="text-xs text-slate-600">{stock.label}（{stock.value}）</span>
                </div>
                <RuleEngine
                  data={chartData}
                  stock={stock}
                  onNewAlerts={handleNewAlerts}
                />
              </div>
              <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800/60">
                <h2 className="text-sm font-semibold text-slate-200 mb-4">アラート履歴</h2>
                <AlertPanel
                  alerts={alerts}
                  onMarkRead={id => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))}
                  onMarkAllRead={() => setAlerts(prev => prev.map(a => ({ ...a, read: true })))}
                  onClear={() => setAlerts([])}
                />
              </div>
            </div>
          )}

          {activeTab === 'backtest' && (
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800/60">
              <div className="flex items-baseline gap-2 mb-5">
                <h2 className="text-sm font-semibold text-slate-200">バックテスト</h2>
                <span className="text-xs text-slate-600">{stock.label}（{stock.value}）</span>
              </div>
              <Backtest data={chartData} stock={stock} />
            </div>
          )}

        </div>

        <p className="text-center text-[10px] text-slate-700 pb-2">
          ※ 投資判断は自己責任でお願いします。このアプリは投資助言を行うものではありません。
        </p>
      </main>
    </div>
  );
}
