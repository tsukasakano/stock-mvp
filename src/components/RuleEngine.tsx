'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  ChartDataPoint,
  TradeRule,
  RuleCondition,
  RuleIndicator,
  RuleOperator,
  RuleSignal,
  AlertEntry,
  StockOption,
} from '@/types/stock';
import {
  evaluateRules,
  loadRules,
  saveRules,
  DEFAULT_RULES,
  sendNotification,
} from '@/lib/ruleEngine';

interface Props {
  data: ChartDataPoint[];
  stock: StockOption;
  onNewAlerts: (alerts: AlertEntry[]) => void;
}

const INDICATOR_LABELS: Record<RuleIndicator, string> = {
  rsi:      'RSI(14)',
  macd:     'MACD',
  price:    '株価',
  ma5:      'MA5',
  ma25:     'MA25',
  volume:   '出来高',
  bbUpper:  'BB上限',
  bbLower:  'BB下限',
  bbMid:    'BB中央',
  bbWidth:  'BBバンド幅',
  volumeMA: '出来高MA20',
};

const INDICATOR_HINTS: Partial<Record<RuleIndicator, string>> = {
  bbUpper:  '価格がこの水準を超えると買われ過ぎ',
  bbLower:  '価格がこの水準を下回ると売られ過ぎ',
  bbWidth:  'バンド幅が小さいほどスクイーズ（大きな動き前兆）',
  volumeMA: '直近20日平均出来高との比較に使用',
};

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  '>':         'より大きい',
  '<':         'より小さい',
  '>=':        '以上',
  '<=':        '以下',
  crossover:   '上抜け（クロス）',
  crossunder:  '下抜け（クロス）',
};

const EMPTY_CONDITION: RuleCondition = { indicator: 'rsi', operator: '<', value: 30 };

function SignalBadge({ signal }: { signal: RuleSignal }) {
  if (!signal.triggered) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
        未発動
      </span>
    );
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse ${
      signal.type === 'buy'
        ? 'bg-emerald-700 text-emerald-100'
        : 'bg-red-700 text-red-100'
    }`}>
      {signal.type === 'buy' ? '買いシグナル発動中' : '売りシグナル発動中'}
    </span>
  );
}

export default function RuleEngine({ data, stock, onNewAlerts }: Props) {
  const [rules, setRules] = useState<TradeRule[]>([]);
  const [signals, setSignals] = useState<RuleSignal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'buy' as 'buy' | 'sell',
    conditions: [{ ...EMPTY_CONDITION }] as RuleCondition[],
    logic: 'AND' as 'AND' | 'OR',
  });

  // ルール読み込み
  useEffect(() => {
    setRules(loadRules());
  }, []);

  // ルール評価（データ変更時）
  const evaluate = useCallback((currentRules: TradeRule[], currentData: ChartDataPoint[]) => {
    if (currentData.length < 2) return;
    const result = evaluateRules(currentRules, currentData);
    setSignals(result);

    const triggered = result.filter(s => s.triggered);
    if (triggered.length === 0) return;

    const latest = currentData[currentData.length - 1];
    const newAlerts: AlertEntry[] = triggered.map(s => ({
      id: `${Date.now()}-${s.ruleId}`,
      stockCode: stock.value,
      stockLabel: stock.label,
      ruleName: s.ruleName,
      signal: s.type,
      price: latest.close,
      triggeredAt: new Date().toISOString(),
      read: false,
    }));

    onNewAlerts(newAlerts);
    triggered.forEach(s => {
      sendNotification(
        `${s.type === 'buy' ? '買' : '売'}シグナル: ${stock.label}`,
        `${s.ruleName} が発動しました (¥${latest.close.toLocaleString()})`,
      );
    });
  }, [stock, onNewAlerts]);

  useEffect(() => {
    if (rules.length > 0) evaluate(rules, data);
  }, [data, rules, evaluate]);

  const updateRules = (next: TradeRule[]) => {
    setRules(next);
    saveRules(next);
  };

  const toggleEnabled = (id: string) => {
    updateRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteRule = (id: string) => {
    updateRules(rules.filter(r => r.id !== id));
  };

  const resetToDefault = () => {
    updateRules(DEFAULT_RULES);
  };

  const handleSave = () => {
    if (!form.name.trim() || form.conditions.length === 0) return;
    const newRule: TradeRule = {
      id: `rule-${Date.now()}`,
      name: form.name.trim(),
      type: form.type,
      conditions: form.conditions,
      logic: form.logic,
      enabled: true,
    };
    updateRules([...rules, newRule]);
    setForm({ name: '', type: 'buy', conditions: [{ ...EMPTY_CONDITION }], logic: 'AND' });
    setShowForm(false);
  };

  const addCondition = () => {
    setForm(f => ({ ...f, conditions: [...f.conditions, { ...EMPTY_CONDITION }] }));
  };

  const removeCondition = (idx: number) => {
    setForm(f => ({ ...f, conditions: f.conditions.filter((_, i) => i !== idx) }));
  };

  const updateCondition = (idx: number, patch: Partial<RuleCondition>) => {
    setForm(f => ({
      ...f,
      conditions: f.conditions.map((c, i) => i === idx ? { ...c, ...patch } : c),
    }));
  };

  // 発動中シグナルのサマリー
  const activeSignals = signals.filter(s => s.triggered);
  const hasBuy  = activeSignals.some(s => s.type === 'buy');
  const hasSell = activeSignals.some(s => s.type === 'sell');

  const inputCls = 'bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500';

  return (
    <div className="space-y-5">
      {/* 発動シグナルサマリー */}
      {data.length >= 2 && (
        <div className="bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/60">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
            現在のシグナル評価 — {stock.label}
          </p>
          {activeSignals.length === 0 ? (
            <p className="text-sm text-slate-500">発動中のシグナルはありません</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hasBuy && (
                <span className="text-sm font-bold px-3 py-1 rounded-lg bg-emerald-900/60 text-emerald-300 border border-emerald-800 animate-pulse">
                  ● 買いシグナル発動中
                </span>
              )}
              {hasSell && (
                <span className="text-sm font-bold px-3 py-1 rounded-lg bg-red-900/60 text-red-300 border border-red-800 animate-pulse">
                  ● 売りシグナル発動中
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ルール一覧ヘッダー */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">
          ルール一覧
          <span className="ml-2 text-xs font-normal text-slate-500">({rules.length}件)</span>
        </span>
        <div className="flex gap-2">
          <button
            onClick={resetToDefault}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            初期化
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              showForm
                ? 'bg-slate-700 text-slate-300'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            {showForm ? 'キャンセル' : '+ ルール追加'}
          </button>
        </div>
      </div>

      {/* ルールカード一覧 */}
      <div className="space-y-2">
        {rules.map(rule => {
          const sig = signals.find(s => s.ruleId === rule.id);
          return (
            <div
              key={rule.id}
              className={`rounded-xl p-3.5 border transition-colors ${
                sig?.triggered
                  ? rule.type === 'buy'
                    ? 'border-emerald-800/80 bg-emerald-950/30'
                    : 'border-red-800/80 bg-red-950/30'
                  : 'border-slate-800/60 bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* トグル */}
                <button
                  onClick={() => toggleEnabled(rule.id)}
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                    rule.enabled ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                  aria-label={rule.enabled ? '無効化' : '有効化'}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    rule.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-medium ${rule.enabled ? 'text-slate-200' : 'text-slate-500'}`}>
                      {rule.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      rule.type === 'buy'
                        ? 'bg-emerald-900/50 text-emerald-400'
                        : 'bg-red-900/50 text-red-400'
                    }`}>
                      {rule.type === 'buy' ? '買い' : '売り'}
                    </span>
                    {sig && <SignalBadge signal={sig} />}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {rule.conditions.map(c =>
                      `${INDICATOR_LABELS[c.indicator]} ${OPERATOR_LABELS[c.operator]} ${
                        c.compareIndicator ? INDICATOR_LABELS[c.compareIndicator] : c.value
                      }`
                    ).join(` ${rule.logic} `)}
                  </p>
                </div>

                <button
                  onClick={() => deleteRule(rule.id)}
                  className="shrink-0 text-slate-700 hover:text-red-400 transition-colors text-sm px-1"
                  aria-label="削除"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 新規ルールフォーム */}
      {showForm && (
        <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">新規ルール</p>

          {/* ルール名 */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">ルール名</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="例: MACD上昇反転買い"
              className={`w-full ${inputCls}`}
            />
          </div>

          {/* 買い/売り */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">種別</label>
            <div className="flex gap-2">
              {(['buy', 'sell'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    form.type === t
                      ? t === 'buy'
                        ? 'bg-emerald-700 border-emerald-600 text-white'
                        : 'bg-red-700 border-red-600 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {t === 'buy' ? '買い' : '売り'}
                </button>
              ))}
            </div>
          </div>

          {/* 条件 */}
          <div>
            <label className="text-xs text-slate-500 block mb-2">条件</label>
            <div className="space-y-2">
              {form.conditions.map((cond, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex gap-2 items-center flex-wrap">
                  <select
                    value={cond.indicator}
                    onChange={e => updateCondition(idx, { indicator: e.target.value as RuleIndicator })}
                    className={inputCls}
                  >
                    {(Object.entries(INDICATOR_LABELS) as [RuleIndicator, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={e => updateCondition(idx, { operator: e.target.value as RuleOperator })}
                    className={inputCls}
                  >
                    {(Object.entries(OPERATOR_LABELS) as [RuleOperator, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={cond.value}
                    onChange={e => updateCondition(idx, { value: Number(e.target.value) })}
                    className={`w-20 ${inputCls}`}
                  />
                  {form.conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(idx)}
                      className="text-slate-600 hover:text-red-400 transition-colors text-sm"
                    >
                      ✕
                    </button>
                  )}
                  </div>
                  {INDICATOR_HINTS[cond.indicator] && (
                    <p className="text-[10px] text-slate-600 pl-0.5">
                      ※ {INDICATOR_HINTS[cond.indicator]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addCondition}
              className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              + 条件を追加
            </button>
          </div>

          {/* AND / OR */}
          {form.conditions.length > 1 && (
            <div>
              <label className="text-xs text-slate-500 block mb-1">条件ロジック</label>
              <div className="flex gap-2">
                {(['AND', 'OR'] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => setForm(f => ({ ...f, logic: l }))}
                    className={`px-4 py-1.5 rounded-lg text-sm font-mono font-semibold transition-colors border ${
                      form.logic === l
                        ? 'bg-slate-600 border-slate-500 text-slate-100'
                        : 'bg-slate-900 border-slate-700 text-slate-500'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 保存 */}
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ルールを保存
          </button>
        </div>
      )}

      <p className="text-[10px] text-slate-700">
        ※ このシグナルは投資助言ではありません。投資判断は自己責任でお願いします。
      </p>
    </div>
  );
}
