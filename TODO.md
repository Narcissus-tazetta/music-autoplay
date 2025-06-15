# TODO - 開発タスク

## 🔥 緊急・高優先度

- [ ] **分割したコンポーネントの動作テスト** (リグレッション確認)
- [ ] **ログシステム導入** (console.log → 構造化ログ、レベル分け)

## 🔶 中優先度（コード品質）

- [ ] **any 型の型安全化** (clients: Map<any, any> → 適切な型定義)
- [ ] **リスト外の動画のstatus表示** (再生中の動画がリストにない場合の表示改善)
- [ ] **adminの別の方法追加** (現在の"admin"文字列入力以外のアクセス方法)

## 🔷 低優先度（最適化）

- [ ] **状態管理統一** (分散した状態の一元化)

## 📚 運用準備

- [ ] **QR コード生成** (学生向けアクセス手段)
- [ ] **利用ルール策定** (音楽リクエストガイドライン)
- [ ] **学校導入テスト** (実際の休み時間での検証)
- [ ] **Chrome 拡張機能との結合テスト**

---

## 🎯 次のアクション

1. **分割したコンポーネントの動作確認** - サーバー起動 → フロントエンド機能テスト
2. **ログシステム設計** - winston/pino 等の導入検討
3. **学校での実地テスト準備** - 運用ルール策定、QR コード作成

---

## 開発メモ

テスト用 YouTube URL:
- https://youtu.be/evtoG-4dLM4?si=Pe9U8kOOsEUVE_6T
- https://www.youtube.com/watch?v=evtoG-4dLM4&list=PLRjclqGHr0meRVsb96mZyooRM8qE_tdmf&index=1
- https://www.youtube.com/watch?v=evtoG-4dLM4
- https://youtu.be/evtoG-4dLM4?si=OI-vCGoIaZJkrM_5
- https://youtu.be/r2BbUBSWBAM?si=RGAbSevyA2uqYsyG




youtube data apiの使用回数がわかるように。（1日でリセット）