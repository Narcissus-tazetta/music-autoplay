# TypeScript × React コード品質向上

## 実装完了

### 型安全性の向上

- `src/types/` - 共通型定義と Chrome API 型拡張
- `any` の使用を最小限に抑制

### 定数の集約

- `src/constants/` - マジックストリング・マジックナンバーを定数化

### ユーティリティ関数の整理

- `src/utils/youtube.ts` - YouTube 関連ユーティリティ
- `src/utils/chrome.ts` - Chrome API ラッパー (Promise ベース)

### カスタムフックの実装

- `useChromeStorage` - Chrome Storage を型安全に扱う
- `useChromeMessage` - メッセージ送受信
- `useYouTubeControls` - YouTube コントロールロジック
- `useUrlList` - URL リスト管理

### コンポーネントの分割

- Presentational Component パターン
- 単一責務の原則に基づく分割
- `React.memo` によるパフォーマンス最適化

### ESLint 強化

- `eslint-plugin-react-hooks` 追加
- React Hooks ルール有効化
- `@typescript-eslint/no-explicit-any` 警告化
- `consistent-type-imports` 強制

## ディレクトリ構造

```
src/
├── components/       # UI コンポーネント
├── hooks/           # カスタムフック
├── types/           # 型定義
├── utils/           # ユーティリティ関数
├── constants/       # 定数
├── popup/           # Popup 関連
├── bg/              # Background スクリプト
├── content/         # Content スクリプト
└── styles/          # スタイル
```

## コーディング規約

### Import の順序

1. 型 import (`import type`)
2. React/外部ライブラリ
3. 内部モジュール
4. コンポーネント

### 命名規則

- コンポーネント: `PascalCase`
- フック: `useCamelCase`
- 型: `PascalCase`
- 定数: `UPPER_SNAKE_CASE`
- 関数: `camelCase`

### 型の使用

- `any` は避け、`unknown` を使用
- Union Type を活用
- 型推論を信頼し、必要な箇所のみ明示

## カスタムフックの使用例

```tsx
import { useChromeStorage, useYouTubeControls } from '../hooks';

function MyComponent() {
    const [autoTab, setAutoTab] = useChromeStorage('manualAutoPlayEnabled', true);
    const { handleControl } = useYouTubeControls(urls);
}
```

## 今後の改善

1. 状態管理ライブラリ (Zustand/Jotai)
2. React Query による Server State 管理
3. Code Splitting (Suspense/React.lazy)
4. テストの充実
5. エラーバウンダリの実装
