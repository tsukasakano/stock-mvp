# CLAUDE.md

## プロジェクト概要
株式キャピタルゲイン予測アプリ（MVP）

## 技術スタック
- Next.js / React / TypeScript
- recharts（チャート描画）
- Anthropic Claude API（AI分析）

## フェーズ管理
- Phase 1（完了）: チャート + テクニカル指標 + AI分析 + トレード日誌
- Phase 2（次）: リアル株価データ連携、ニュース感情分析
- Phase 3（予定）: 損益シミュレーター、NISA管理

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

## 変更履歴

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
