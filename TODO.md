# TODO - 開発タスク

## 🔥 緊急・高優先度

- [x] **socketHandlers.ts 分割** (168 行 → 機能別ファイル分割)
- [x] **UI コンポーネント分割** (sidebar.tsx 681 行、chart.tsx 308 行、menubar.tsx 234 行 → モジュール化完了)
- [x] **プロジェクトファイル整理** (不要ファイル削除、ディレクトリ構造最適化)
- [ ] **分割したコンポーネントの動作テスト** (リグレッション確認)
- [ ] **ログシステム導入** (console.log → 構造化ログ、レベル分け)

## 🔶 中優先度（コード品質）

- [x] **HomeForm.tsx 分割** (136 行 → 複数コンポーネント)
- [x] **home.tsx 分割** (126 行 → 複数コンポーネント)
- [x] **dropdown-menu.tsx 分割** (219 行 → 複数コンポーネント)
- [x] **carousel.tsx 分割** (223 行 → 複数コンポーネント)
- [x] **context-menu.tsx 分割** (211 行 → 複数コンポーネント)
- [x] **select.tsx 分割** (158 行 → 複数コンポーネント)
- [x] **navigation-menu.tsx 分割** (149 行 → 複数コンポーネント)
- [ ] **any 型の型安全化** (clients: Map<any, any> → 適切な型定義)

## 🔷 低優先度（最適化）

- [ ] **状態管理統一** (分散した状態の一元化)
- [ ] **残りの中規模 UI コンポーネント分割** (必要に応じて他のコンポーネントも対応)

## 📚 運用準備

- [ ] **QR コード生成** (学生向けアクセス手段)
- [ ] **利用ルール策定** (音楽リクエストガイドライン)
- [ ] **学校導入テスト** (実際の休み時間での検証)
- [ ] **Chrome 拡張機能との結合テスト**

---

## 📋 完了済み

- [x] 依存関係エラー修正 (minimatch, minipass)
- [x] 環境ファイル移植 (.env, .nvmrc, .vscode)
- [x] YouTube API 認証修正 (process.env.YOUTUBE_API_KEY)
- [x] GitHub リポジトリ同期
- [x] プロジェクト文書化 (README.md, TECHNICAL.md, DEVELOPMENT.md)
- [x] socketHandlers.ts 分割完了
- [x] HomeForm.tsx 分割完了 (formValidation.ts, useVideoAssets.ts)
- [x] home.tsx 分割完了 (music-table.tsx, home-header.tsx, home-settings.tsx)
- [x] sidebar.tsx 分割完了 (sidebar-context.tsx, sidebar-core.tsx, sidebar-menu.tsx, sidebar-layout.tsx)
- [x] chart.tsx 分割完了 (chart-context.tsx, chart-container.tsx, chart-tooltip.tsx, chart-legend.tsx)
- [x] menubar.tsx 分割完了 (menubar-core.tsx, menubar-items.tsx, menubar-sub.tsx)
- [x] dropdown-menu.tsx 分割完了 (dropdown-menu-core.tsx, dropdown-menu-items.tsx, dropdown-menu-sub.tsx)
- [x] carousel.tsx 分割完了 (carousel-context.tsx, carousel-core.tsx, carousel-navigation.tsx)
- [x] context-menu.tsx 分割完了 (context-menu-core.tsx, context-menu-items.tsx, context-menu-sub.tsx)
- [x] select.tsx 分割完了 (select-core.tsx, select-items.tsx)
- [x] navigation-menu.tsx 分割完了 (navigation-menu-core.tsx, navigation-menu-items.tsx)
- [x] プロジェクトファイル整理完了 (不要ファイル削除、.gitignore 更新)

---

## 🎯 次のアクション

1. **分割したコンポーネントの動作確認** - サーバー起動 → フロントエンド機能テスト
2. **ログシステム設計** - winston/pino 等の導入検討
3. **残りの大きなファイル分割** - carousel.tsx, context-menu.tsx 等
4. **学校での実地テスト準備** - 運用ルール策定、QR コード作成

---

## 開発メモ

テスト用 YouTube URL:

- https://youtu.be/evtoG-4dLM4?si=Pe9U8kOOsEUVE_6T
- https://www.youtube.com/watch?v=evtoG-4dLM4&list=PLRjclqGHr0meRVsb96mZyooRM8qE_tdmf&index=1
- https://www.youtube.com/watch?v=evtoG-4dLM4
- https://youtu.be/evtoG-4dLM4?si=OI-vCGoIaZJkrM_5
- https://youtu.be/r2BbUBSWBAM?si=RGAbSevyA2uqYsyG

