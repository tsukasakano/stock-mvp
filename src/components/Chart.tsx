'use client';

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

export default function Chart({ data, color }: Props) {
  if (data.length === 0) return null;

  const interval = Math.max(Math.floor(data.length / 6) - 1, 0);
  const margin = { top: 4, right: 4, bottom: 0, left: 0 };

  return (
    <div className="space-y-3">
      {/* 価格 + ボリンジャーバンド */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="text-slate-400">価格 / BB(20日,±2σ)</span>
          <span className="text-slate-600">-- 上下限 &nbsp;- - 中央</span>
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
                };
                const v = typeof value === 'number' ? formatPrice(value) : String(value ?? '');
                return [v, labels[String(name)] ?? String(name)];
              }}
            />
            <Line type="monotone" dataKey="upperBand" stroke="#334155" strokeWidth={1}
              dot={false} strokeDasharray="5 3" connectNulls={false} name="upperBand" />
            <Line type="monotone" dataKey="middleBand" stroke="#3b4a5e" strokeWidth={1}
              dot={false} strokeDasharray="8 4" connectNulls={false} name="middleBand" />
            <Line type="monotone" dataKey="lowerBand" stroke="#334155" strokeWidth={1}
              dot={false} strokeDasharray="5 3" connectNulls={false} name="lowerBand" />
            <Line type="monotone" dataKey="close" stroke={color} strokeWidth={2}
              dot={false} name="close" />
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
            <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={1.5}
              dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* MACD */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5 flex gap-x-3 flex-wrap">
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
            <Line type="monotone" dataKey="macd" stroke="#60a5fa" strokeWidth={1.5}
              dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="signal" stroke="#fb923c" strokeWidth={1.5}
              dot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
