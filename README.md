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
