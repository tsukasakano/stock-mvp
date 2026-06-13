# CLAUDE.md

## プロジェクト概要
株式キャピタルゲイン予測アプリ（MVP）

## 技術スタック
- Next.js / React / TypeScript
- recharts（チャート描画）
- Anthropic Claude API（AI分析）

## フェーズ管理
- Phase 1（完了）: チャート + テクニカル指標 + AI分析 + トレード日誌
- Phase 2（完了）: リアル株価データ連携（yfinance）、ニュース感情分析
- Phase 3（完了）: 損益シミュレーター、NISA管理
- Phase 4（完了）: バックテスト・ルールエンジン・ウォークフォワード検証（v0.8.0〜v0.9.19）
- Phase 5（次）: 証券会社API連携・自動売買（ペーパートレード3ヶ月実績確認後）

## フォルダ構成
src/components/ → 各コンポーネント
src/lib/        → 計算ロジック・API呼び出し
src/types/      → 型定義

## コーディングルール
- コンポーネントはsrc/components/配下に分割
- API呼び出しはsrc/lib/api.ts に集約
- 型定義はsrc/types/に配置

## 注意事項
- APIキーは .env.local で管理（gitにコミットしない）
- 投資助言にならないよう免責文言を必ず表示

## 現在のベスト戦略
- 買い：シンプルRSIルール（RSI < 35）
- 売り：利益確定売りルール（RSI > 65 AND MACD < シグナル）
- TP：10% / TSP：3% / 最大保有日数：20日
- 相場環境フィルター：オン（日経平均強気時のみ買い）
- 対象：全49銘柄

## ウォークフォワード検証結果（参考）
- 条件：全49銘柄・学習252日・検証63日
- 一貫性スコア：−0.11（過学習の可能性あり）
- 平均検証リターン：+0.27%（3ヶ月）
- 平均勝率：51.2%
- 15窓中13窓プラス（86.7%）
- 年率換算：約+3.6%（取引コスト控除後）
- 課題：一貫性スコアが低いため引き続きルール改善が必要

## 変更履歴

### v0.9.x — バックテスト・分析精度向上（完了）
- v0.9.0: バックテスト機能（勝率・最大DD・シャープ比）
- v0.9.1: BB・出来高条件追加
- v0.9.2: テイクプロフィット・トレイリングストップ追加
- v0.9.3: モックデータ180日拡張・複数銘柄テスト・AI最適化提案
- v0.9.4: ダイバージェンス・MA20・出来高比率条件追加
- v0.9.5: AI提案緩和版RSIルール追加
- v0.9.6: yfinance5年データ取得・日経225銘柄スクリーニング
- v0.9.7: 全銘柄チャート対応・リアルデータバックテスト
- v0.9.8: バックテスト結果ソート・プラス銘柄フィルター
- v0.9.9: AI提案厳格化版RSIルール追加
- v0.9.10: 売りルール追加・買い売り組み合わせ戦略
- v0.9.11: 銘柄ごと最適戦略・ポートフォリオバックテスト
- v0.9.12: データ自動更新・取引コスト・ウォークフォワード検証
- v0.9.13: yfinance全面切り替え・過負荷防止・キャッシュ制御
- v0.9.14: ウォークフォワード検証実装
- v0.9.15: 複数銘柄ウォークフォワード検証追加
- v0.9.16: 相場環境フィルター（日経平均トレンド）追加
- v0.9.17: シンプルRSIルール追加
- v0.9.18: 一目均衡表・ATR・ストキャスティクス・MA75/200追加
- v0.9.19: ウォークフォワード全49銘柄対応

### v0.9.19 - ウォークフォワード全49銘柄対応
- walkForward.ts: AggregatedWindow / AggregatedWalkForwardResult 型追加
- walkForward.ts: runWalkForwardAggregated() 追加（各ウィンドウで全銘柄取引を合算評価）
- WalkForward.tsx: 複数銘柄モードに「ポートフォリオ8銘柄 / 全49銘柄」サブトグル追加
- 全49銘柄モード: 共通買いルール・TP/TSP設定、ウィンドウごとの合計取引回数表示

### v0.9.18 - 一目均衡表・ATR・ストキャスティクス・MA75/200追加
- types/stock.ts: ChartDataPoint に13フィールド追加、RuleIndicator に7値追加
- indicators.ts: calcSMA / calcATR / calcStochastic / calcIchimoku 関数追加
- ruleEngine.ts / backtest.ts: ma75・ma200・atr・atrPct・stochK・stochD・ichimokuCloud 対応
- ruleEngine.ts: 一目ブレイク・ストキャス底打ち・ATRフィルター・長期MAフォローの4プリセット追加
- Chart.tsx: MA75/200トグル・一目均衡表ライン・MACD/ストキャスサブチャート切替追加
- Analysis.tsx: ATR%・Stoch・vs MA75/200・雲位置・転換基準の6バッジ追加

### v0.9.17 - シンプルRSIプリセット追加
- ruleEngine.ts: 「シンプルRSIルール（RSI<35）」「超シンプルRSIルール（RSI<40）」追加

### v0.9.16 - 相場環境フィルター（日経平均トレンド）
- scripts/fetch_nikkei.py: 日経平均（^N225）5年データ取得スクリプト追加
- src/lib/marketFilter.ts: MA25/MA75/RSIによる bull/bear/neutral 判定ロジック
- backtest.ts: 弱気相場では買いシグナルを無効化するフィルター実装
- Backtest.tsx / WalkForward.tsx: 相場環境フィルタートグル追加
- Screening.tsx: 市場環境バナー（MarketConditionBanner）追加

### v0.9.15 - 複数銘柄同時ウォークフォワード検証
- walkForward.ts: StockWalkForwardInput / MultiWalkForwardResult 型追加
- walkForward.ts: runWalkForwardMultiple() 追加
- WalkForward.tsx: 複数銘柄モード（ConsistencyGauge・StockResultCard・MultiVerdictSection）実装

### v0.9.14 - ウォークフォワード検証 UI強化（同コミットに含む）
- WalkForward.tsx: 大型 ConsistencyGauge・乖離ウィンドウ赤丸・VerdictSection追加
- walkForward.ts: WalkForwardWindow に windowIndex / isReliable を追加

### v0.9.13 - yfinance全面切り替え・過負荷防止・キャッシュ制御
- scripts/fetch_historical.py: yfinance切り替え・リトライ3回・30秒タイムアウト・当日キャッシュ
- src/app/api/update/route.ts: dataSource を 'yfinance' | 'jquants' | 'mock' で管理
- DataStatus.tsx: データ取得状況モニタリング UI 強化

### v0.9.12 - データ自動更新・取引コスト・ウォークフォワード検証（初版）
- scripts/auto_update.py: 全銘柄データ自動更新スクリプト
- src/app/api/update/route.ts: データ更新 API ルート追加
- DataStatus.tsx: 更新状況表示コンポーネント追加
- WalkForward.tsx / walkForward.ts: ウォークフォワード検証初版実装
- backtest.ts: 手数料・スリッページ・commissionRate / slippage 対応

### v0.9.11 - 銘柄ごと最適戦略・ポートフォリオバックテスト
- src/lib/portfolioStrategy.ts: DEFAULT_STRATEGIES（8銘柄×最適パラメータ）定義
- PortfolioStrategy.tsx: 銘柄別戦略カード・ポートフォリオバックテスト実行 UI
- src/app/api/portfolio-backtest/route.ts: 複数銘柄合算バックテスト API

### v0.9.10 - 売りルール追加・買い売り組み合わせ戦略
- ruleEngine.ts: トレンド転換売り・利益確定売り・弱気転換売りの3プリセット追加
- Backtest.tsx: 買いルール＋売りルールの組み合わせ選択 UI

### v0.9.9 - AI提案厳格化版RSIルール追加
- ruleEngine.ts: RSI<25 + ダイバージェンス≥2 + 出来高比率>2.0 の厳格版プリセット追加

### v0.9.8 - バックテスト結果ソート・プラス銘柄フィルター
- Backtest.tsx: 結果をリターン降順ソート・プラスリターン銘柄のみ表示フィルター追加

### v0.9.7 - 全銘柄チャート対応・リアルデータバックテスト
- src/lib/stocks.ts: 49銘柄定義（ALL_STOCKS）・セクター色マップ追加
- StockSelector.tsx: セクター別グループ表示・全49銘柄選択対応
- Backtest.tsx: リアルデータ（yfinance JSONファイル）でのバックテスト実装
- src/lib/historicalData.ts: /api/historical/{symbol} からのデータ取得

### v0.9.6 - yfinance 5年データ取得・スクリーニング
- scripts/fetch_historical.py: 全49銘柄の5年分株価データ取得（yfinance）
- scripts/screen_stocks.py: RSI・MACD・出来高比・BB位置でスクリーニング
- src/app/api/screening/route.ts: スクリーニング結果 API
- Screening.tsx: 注目銘柄カード表示（ScoreBar・シグナルバッジ）

### v0.9.5 - AI提案緩和版RSIルール追加
- ruleEngine.ts: priceVsMA20<1.05 + volumeRatio>1.2 の緩和版プリセット追加

### v0.9.4 - AI提案条件追加（ダイバージェンス・MA20・出来高比率）
- types/stock.ts: rsiDivergence / priceVsMA20 / volumeRatio を RuleIndicator に追加
- ruleEngine.ts / backtest.ts: 新指標の indicatorValue 実装
- ruleEngine.ts: AI提案強化版RSIルール（RSI<30 + ダイバージェンス + MA20比 + 出来高比）追加

### v0.9.3 - モックデータ拡張・複数銘柄テスト・AI最適化提案
- src/lib/mockData.ts: 8銘柄分のモックデータ生成対応
- src/app/api/optimize/route.ts: Claude API によるルール最適化提案エンドポイント
- Backtest.tsx: 複数銘柄一括バックテスト・AI最適化提案 UI

### v0.9.2 - テイクプロフィット・トレイリングストップ・最大保有日数
- backtest.ts: takeProfit / trailingStop / maxHoldDays オプション追加
- backtest.ts: ExitReason 型・exitReasons 集計追加
- Backtest.tsx: パラメータ入力 UI・退出理由内訳表示追加

### v0.9.1 - ルールエンジンにBB・出来高条件を追加
- types/stock.ts: bbUpper / bbLower / bbMid / bbWidth / volumeMA を RuleIndicator に追加
- ruleEngine.ts: BBバンド下限割れ逆張り・トレンドフォロー複合プリセット追加
- backtest.ts: 新指標の indicatorValue 対応

### v0.9.0 - バックテスト機能追加
- src/lib/backtest.ts: BacktestConfig / BacktestResult / runBacktest() 実装
- src/components/Backtest.tsx: 初版バックテスト UI（エクイティカーブ・取引一覧）
- backtest.ts: クロスオーバー・crossunder 演算子対応

### v0.8.0 - 売買ルールエンジン・アラート通知
- src/lib/ruleEngine.ts: evaluateRules() 実装・DEFAULT_RULES（RSI/GC/BB逆張りプリセット）
- src/components/RuleEngine.tsx: ルール一覧・カスタムルール追加フォーム
- src/components/AlertPanel.tsx: アラートパネル・未読バッジ
- ブラウザ通知（Notification API）対応

### v0.5.0 - ニュース感情分析
- src/app/api/news/route.ts: モックニュース生成・感情スコア算出 API
- src/components/NewsSentiment.tsx: ニュースカード・センチメント集計 UI
- Analysis.tsx: ニュース考慮バッジ・AI分析へのセンチメント反映
- types/stock.ts: NewsItem / NewsSentimentResult 型追加

### v0.3.0 - UIブラッシュアップ
- モバイル対応（レスポンシブ）
- ダークテーマ改善・ホバーエフェクト追加
- ローディングスケルトン・アニメーション追加

### v0.2.0 - Phase 3
- 損益シミュレーター追加（通常口座/NISA課税計算）
- NISA管理機能追加（つみたて枠・成長投資枠）

### v0.1.0 - Phase 2
- J-Quants API連携（src/lib/jquants.ts）
- APIルート追加（src/app/api/stocks/route.ts）
- デモデータフォールバック実装

### v0.0.1 - Phase 1（MVP）
- 株価チャート（ボリンジャーバンド・RSI・MACD）
- AI分析機能（Claude API）
- トレード日誌
- 銘柄選択（トヨタ・ソニー・ソフトバンク・任天堂）

## 次のフェーズ
- v1.0.0: 証券会社API連携・自動売買
- 実施条件：ペーパートレードで3ヶ月以上の実績確認後
