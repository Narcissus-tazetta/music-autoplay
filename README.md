# Music Auto Play

## 🎵 機能

### 📤 音楽リクエスト

- YouTubeのURLを入力して楽曲をリクエスト
- 10分以内の音楽動画のみ登録可能
- リアルタイムで楽曲リストに反映

### 🎮 リアルタイム管理

- WebSocketによるリアルタイム同期
- 複数ユーザーが同時にアクセス可能
- 楽曲の追加・削除が即座に反映

### 🎛️ 管理機能

- 管理者モードでの楽曲削除
- 楽曲リストの一括管理
- YouTube Data APIによる動画情報取得

### 🌙 ユーザーインターフェース

- ダークモード・ライトモード切り替え
- レスポンシブデザイン
- ゲーミングカラーモード
- 設定パネル

### 🔗 YouTube連携

- YouTube拡張機能との連携
- 再生状態の監視・表示
- 動画の自動検証

## 🛠️ 技術スタック

- **Frontend**: Remix, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Socket.IO
- **State Management**: Zustand
- **API**: YouTube Data API v3
- **Logging**: Winston
- **UI Components**: shadcn/ui
- **Code Quality**: ESLint, Prettier
- **Development**: Vite, React Router

## 🚀 開発環境セットアップ

### 前提条件

- Node.js 18.0.0以上
- npm または yarn
- YouTube Data API v3 キー

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/Narcissus-tazetta/music-autoplay.git
cd music-autoplay

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env
# .envファイルにYOUTUBE_API_KEYを設定
```

### 開発サーバー起動

```bash
# 開発サーバーを起動
npm run dev

# 別ターミナルでTypeScriptの型チェック
npm run typecheck

# コードの品質チェック
npm run lint

# コードフォーマット
npm run format
```

### 利用可能なスクリプト

```bash
# 開発
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド
npm run start        # 本番サーバー起動

# コード品質
npm run lint         # ESLintチェック
npm run lint:fix     # ESLint自動修正
npm run format       # Prettierフォーマット
npm run format:check # フォーマットチェック
npm run typecheck    # TypeScript型チェック

# メンテナンス
npm run clean        # ビルドファイル削除
npm run fresh        # 依存関係再インストール
```

## 🎯 使用方法

1. **管理者権限取得**: 入力フィールドに "admin" と入力
2. **楽曲追加**: YouTubeのURLを入力して送信
3. **楽曲削除**: 管理者モードで削除ボタンをクリック
4. **設定変更**: 右上の設定ボタンからテーマ切り替え

## 🔧 開発ガイドライン

### コード品質

- **ESLint**: エラー0件を維持
- **Prettier**: 統一されたコードフォーマット
- **TypeScript**: 型安全性の確保
- **テスト**: 重要な機能はテスト記述推奨

### コミットメッセージ

```
🎨 UI改善
🐛 バグ修正  
✨ 新機能
🔧 設定変更
📝 ドキュメント更新
🧹 リファクタリング
```

### ブランチ戦略

- `main`: 本番用安定版
- `develop`: 開発用統合ブランチ
- `feature/*`: 機能開発用ブランチ

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 👥 コントリビューター

- [alinco8](https://github.com/alinco8) - メイン開発
- [Narcissus-tazetta](https://github.com/Narcissus-tazetta) - プロジェクト管理

## 🤝 コントリビューション

プルリクエストや機能提案を歓迎します！

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m '✨ Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📞 サポート

問題や質問がある場合は、GitHubのIssuesでお知らせください。
