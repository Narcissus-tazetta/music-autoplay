このリポジトリ向けの簡易 CI 説明

- GitHub Actions ワークフロー: `.github/workflows/ci.yml`
  - ブランチ: `main`, `renew`
  - 実行内容: 依存インストール（bun）、型チェック、lint、Playwright E2E（ブラウザのインストールを含む）

ローカルで E2E を実行する手順（macOS zsh）

1. bun をインストール（既にある場合はスキップ）:

```bash
curl -fsSL https://bun.sh/install | bash -s -- -y
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

2. 依存をインストール:

```bash
bun install
```

3. Playwright ブラウザをインストールしてテスト実行:

```bash
bunx playwright install --with-deps
bunx playwright test --config=playwright.config.ts
```

CI では `VITE_WS_PORT` 環境変数を設定して Vite の WebSocket ポートを固定できます（デフォルトは Vite が自動割当）。
