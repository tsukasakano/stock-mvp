'use client';

import { useState } from 'react';
import {
  ComposedChart,
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { ChartDataPoint } from '@/types/stock';

interface Props {
  data: ChartDataPoint[];
  color: string;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #1e293b',
  color: '#e2e8f0',
  borderRadius: '10px',
  fontSize: '12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
};

const GRID_STROKE = '#1e293b';
const AXIS_TICK = { fill: '#475569', fontSize: 10 };
const Y_WIDTH = 60;

function formatDate(d: string) {
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatPrice(v: number) {
  return `¥${v.toLocaleString()}`;
}

function ToggleBtn({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
        active
          ? 'border-transparent text-slate-900 font-semibold'
          : 'border-slate-700 text-slate-500 bg-transparent hover:border-slate-600'
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      {children}
    </button>
  );
}

type SubChart = 'macd' | 'stoch';

export default function Chart({ data, color }: Props) {
  const [showMA75,    setShowMA75]    = useState(false);
  const [showMA200,   setShowMA200]   = useState(false);
  const [showIchimoku, setShowIchimoku] = useState(false);
  const [subChart,    setSubChart]    = useState<SubChart>('macd');

  if (data.length === 0) return null;

  const interval = Math.max(Math.floor(data.length / 6) - 1, 0);
  const margin = { top: 4, right: 4, bottom: 0, left: 0 };

  return (
    <div className="space-y-3">
      {/* Toggle bar */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[10px] text-slate-600 mr-1">表示:</span>
        <ToggleBtn active={showMA75}    color="#8b5cf6" onClick={() => setShowMA75(v => !v)}>MA75</ToggleBtn>
        <ToggleBtn active={showMA200}   color="#f97316" onClick={() => setShowMA200(v => !v)}>MA200</ToggleBtn>
        <ToggleBtn active={showIchimoku} color="#06b6d4" onClick={() => setShowIchimoku(v => !v)}>一目均衡表</ToggleBtn>
      </div>

      {/* 価格 + ボリンジャーバンド + 追加MA + 一目均衡表 */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="text-slate-400">価格 / BB(20日,±2σ)</span>
          {showMA75  && <span style={{ color: '#8b5cf6' }}>— MA75</span>}
          {showMA200 && <span style={{ color: '#f97316' }}>— MA200</span>}
          {showIchimoku && (
            <>
              <span style={{ color: '#06b6d4' }}>— 転換</span>
              <span style={{ color: '#f43f5e' }}>— 基準</span>
              <span style={{ color: '#22d3ee' }} className="opacity-60">-- 先行1/2</span>
            </>
          )}
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} syncId="stock" margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={AXIS_TICK} interval={interval} />
            <YAxis tickFormatter={formatPrice} tick={AXIS_TICK} domain={['auto', 'auto']} width={Y_WIDTH} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={l => `${l}`}
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  close: '終値', upperBand: 'BB上限', middleBand: 'BB中央', lowerBand: 'BB下限',
                  ma75: 'MA75', ma200: 'MA200',
                  ichimokuTenkan: '転換線', ichimokuKijun: '基準線',
                  ichimokuSpan1: '先行スパン1', ichimokuSpan2: '先行スパン2',
                };
                const v = typeof value === 'number' ? formatPrice(value) : String(value ?? '');
                return [v, labels[String(name)] ?? String(name)];
              }}
            />
            <Line type="monotone" dataKey="upperBand"  stroke="#334155" strokeWidth={1} dot={false} strokeDasharray="5 3" connectNulls={false} name="upperBand" />
            <Line type="monotone" dataKey="middleBand" stroke="#3b4a5e" strokeWidth={1} dot={false} strokeDasharray="8 4" connectNulls={false} name="middleBand" />
            <Line type="monotone" dataKey="lowerBand"  stroke="#334155" strokeWidth={1} dot={false} strokeDasharray="5 3" connectNulls={false} name="lowerBand" />
            {showMA75  && <Line type="monotone" dataKey="ma75"  stroke="#8b5cf6" strokeWidth={1.5} dot={false} connectNulls={false} name="ma75" />}
            {showMA200 && <Line type="monotone" dataKey="ma200" stroke="#f97316" strokeWidth={1.5} dot={false} connectNulls={false} name="ma200" />}
            {showIchimoku && (
              <>
                <Line type="monotone" dataKey="ichimokuTenkan" stroke="#06b6d4" strokeWidth={1.5} dot={false} connectNulls={false} name="ichimokuTenkan" />
                <Line type="monotone" dataKey="ichimokuKijun"  stroke="#f43f5e" strokeWidth={1.5} dot={false} connectNulls={false} name="ichimokuKijun" />
                <Line type="monotone" dataKey="ichimokuSpan1"  stroke="#22d3ee" strokeWidth={1} dot={false} strokeDasharray="4 3" connectNulls={false} name="ichimokuSpan1" />
                <Line type="monotone" dataKey="ichimokuSpan2"  stroke="#818cf8" strokeWidth={1} dot={false} strokeDasharray="4 3" connectNulls={false} name="ichimokuSpan2" />
              </>
            )}
            <Line type="monotone" dataKey="close" stroke={color} strokeWidth={2} dot={false} name="close" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* RSI */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5 flex gap-x-3 flex-wrap">
          <span className="text-slate-400">RSI (14)</span>
          <span className="text-red-500/70">— 70 買われすぎ</span>
          <span className="text-blue-500/70">— 30 売られすぎ</span>
        </p>
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={data} syncId="stock" margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={AXIS_TICK} interval={interval} />
            <YAxis domain={[0, 100]} tick={AXIS_TICK} ticks={[0, 30, 50, 70, 100]} width={Y_WIDTH}
              tickFormatter={v => String(v)} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={l => `${l}`}
              formatter={(value) => [typeof value === 'number' ? value.toFixed(1) : 'N/A', 'RSI']} />
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.5} />
            <ReferenceLine y={30} stroke="#3b82f6" strokeDasharray="4 2" strokeOpacity={0.5} />
            <ReferenceLine y={50} stroke="#334155" strokeDasharray="2 4" strokeOpacity={0.5} />
            <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={1.5} dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sub-chart selector: MACD / Stochastics */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <button
            onClick={() => setSubChart('macd')}
            className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${subChart === 'macd' ? 'bg-slate-600 border-slate-500 text-slate-100' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}
          >
            MACD
          </button>
          <button
            onClick={() => setSubChart('stoch')}
            className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${subChart === 'stoch' ? 'bg-slate-600 border-slate-500 text-slate-100' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}
          >
            ストキャスティクス
          </button>
        </div>

        {subChart === 'macd' ? (
          <>
            <p className="text-xs text-slate-500 mb-1 flex gap-x-3 flex-wrap">
              <span className="text-slate-400">MACD (12,26,9)</span>
              <span className="text-blue-400/70">— MACD</span>
              <span className="text-orange-400/70">— シグナル</span>
            </p>
            <ResponsiveContainer width="100%" height={110}>
              <ComposedChart data={data} syncId="stock" margin={margin}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={AXIS_TICK} interval={interval} />
                <YAxis tick={AXIS_TICK} width={Y_WIDTH} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={l => `${l}`}
                  formatter={(value, name) => {
                    const labels: Record<string, string> = { macd: 'MACD', signal: 'シグナル', histogram: 'ヒスト' };
                    const v = typeof value === 'number' ? value.toFixed(2) : 'N/A';
                    return [v, labels[String(name)] ?? String(name)];
                  }} />
                <ReferenceLine y={0} stroke="#334155" />
                <Bar dataKey="histogram" isAnimationActive={false} maxBarSize={5}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={(entry.histogram ?? 0) >= 0 ? '#059669' : '#dc2626'} fillOpacity={0.8} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="macd"   stroke="#60a5fa" strokeWidth={1.5} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="signal" stroke="#fb923c" strokeWidth={1.5} dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-1 flex gap-x-3 flex-wrap">
              <span className="text-slate-400">スローストキャスティクス (14,3,3)</span>
              <span className="text-yellow-400/70">— %K</span>
              <span className="text-rose-400/70">— %D</span>
            </p>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={data} syncId="stock" margin={margin}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={AXIS_TICK} interval={interval} />
                <YAxis domain={[0, 100]} tick={AXIS_TICK} ticks={[0, 20, 50, 80, 100]} width={Y_WIDTH}
                  tickFormatter={v => String(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={l => `${l}`}
                  formatter={(value, name) => {
                    const labels: Record<string, string> = { stochSlowK: '%K', stochSlowD: '%D' };
                    return [typeof value === 'number' ? value.toFixed(1) : 'N/A', labels[String(name)] ?? String(name)];
                  }} />
                <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.5} />
                <ReferenceLine y={20} stroke="#3b82f6" strokeDasharray="4 2" strokeOpacity={0.5} />
                <ReferenceLine y={50} stroke="#334155" strokeDasharray="2 4" strokeOpacity={0.5} />
                <Line type="monotone" dataKey="stochSlowK" stroke="#facc15" strokeWidth={1.5} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="stochSlowD" stroke="#fb7185" strokeWidth={1.5} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
}
