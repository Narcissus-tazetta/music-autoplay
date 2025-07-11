# TODO - 開発タスク（2025/07/02時点）

## � 高優先度

- [x] **インポートパス一括修正**（新ディレクトリ構成に合わせて全ファイル修正）✅ 完了
- [x] **vite.config.ts/tsconfig.jsonのパスエイリアス修正**✅ 完了
- [x] **旧app/・time/ディレクトリ完全削除** ✅ 完了
- [x] **状態管理統一の最終レビュー**（Zustand/IndexedDB/ローカルストレージの一元化確認）✅ 完了
- [x] **admin認証方式の追加**（現状の"admin"文字列以外の認証手段を検討・実装）✅ 完了

## 🟡 中優先度

- [ ] **利用ルール策定**（音楽リクエスト・管理ガイドライン）

## 🔵 低優先度

- [ ] **PWA対応/モバイル最適化**
- [ ] **データベース移行検討**（将来的な拡張性）
- [ ] **パフォーマンスチューニング**（Lighthouse/Web Vitals計測）

## 🔒 セキュリティ

- [x] **DOMPurifyサニタイズ機能追加**（SafeHtmlコンポーネント・sanitize utility実装）✅ 完了
- [x] **依存パッケージ脆弱性チェック**（bun audit実行・脆弱性なし確認済み）✅ 完了
- [x] **依存パッケージアップデート**（React Router、ESLint、Tailwind等の安全な更新完了）✅ 完了
- [ ] **メジャーバージョンアップ検討**（dotenv17・react-day-picker9・recharts3・vite7等）
- [ ] **CSPヘッダー設定**（Content Security Policy追加）

---

## 🎉 完了済み

- 分割コンポーネントの動作テスト・リグレッション確認
- ログシステム（Winston）導入・構造化ログ
- any型の型安全化・TypeScript型定義徹底
- 状態管理の大部分統一・Zustand persist化
- ディレクトリ構成のドメイン駆動型移行
- **E2Eテスト/結合テスト**（Playwrightで主要フロー自動化・ネットワーク障害系もカバー）
- **ダークモードロード時のバグ修正**（ちらつき防止・状態同期改善・トランジション最適化）
- **本番環境DOM参照エラー修正**（Cannot read properties of null reading style解決・安全性チェック追加）

---

## 開発メモ

テスト用 YouTube URL:

- https://youtu.be/evtoG-4dLM4?si=Pe9U8kOOsEUVE_6T
- https://www.youtube.com/watch?v=evtoG-4dLM4&list=PLRjclqGHr0meRVsb96mZyooRM8qE_tdmf&index=1
- https://www.youtube.com/watch?v=evtoG-4dLM4
- https://youtu.be/evtoG-4dLM4?si=OI-vCGoIaZJkrM_5
- https://youtu.be/r2BbUBSWBAM?si=RGAbSevyA2uqYsyG
