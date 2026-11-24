# ACTION OS（MVP / Phase 1）

タスクを管理するアプリではなく、タスクを実行できる人間になるためのアプリ。

## 起動

```powershell
npm install
npm run dev      # http://localhost:3000
npm test         # Vitest（ドメインロジック）
npm run build
```

### AIタスク分解（任意）

`.env.local` に `ANTHROPIC_API_KEY=...` を置き、アプリの「設定 → AIタスク分解を使う」をオンにする。
送信されるのはタスク名と詳細のみ（感情・心理記録は送らない）。キー未設定・失敗時はルールベース分解にフォールバックし、画面にその旨を表示する。
モデルは `claude-opus-5-5`（`src/app/api/decompose/route.ts`）。

## 公開・保守（無料）

GitHub Pages で静的サイトとして公開している。

- `main` に push すると GitHub Actions（`.github/workflows/deploy.yml`）が lint → テスト → 静的ビルド → 公開 を自動で行う。テストが落ちたら公開されない。
- Pull Request ではビルドとテストのみ実行（公開しない）。
- Dependabot（`.github/dependabot.yml`）が月1回、依存パッケージの更新 PR を作る。CI が通ればマージするだけでよい。
- 静的書き出しのため API ルート（AIタスク分解）は公開版に含まれない。公開版でAIをオンにしてもルールベース分解に切り替わる。
- 利用者のデータは各自のブラウザ（localStorage）にのみ保存され、サーバーには送られない。

## 構成

| パス | 内容 |
|---|---|
| `src/lib/domain/` | UIに依存しない純粋なドメインロジック（状態遷移・XP・KPI・優先度・心理テクニック） |
| `src/lib/store.ts` | localStorage 永続化。Supabase 連携時はここを差し替える |
| `src/app/*` | 画面：ホーム / タスク / 集中 / 習慣 / if-then / 心理支援 / 分析 / 設定 |
| `src/app/api/decompose` | AIタスク分解 API（サーバー側でキー管理・入力検証・簡易レート制限） |

## 実装状況

実装済み：タスクCRUD、3段階目標、30秒アクション、1タップ着手、集中タイマー（カウントアップ/ダウン/ポモドーロ・一時停止）、中断理由と復帰モード、着手遅延の記録、行動できない理由→心理テクニック提示（要件18.3の選択ルール）、if-thenルールと実行率・改善提案、極小習慣（途切れても実績は消えない）、冪等なXP・レベル、日/週/月のKPI（分母0は「データなし」）、延期・撤回・休息、JSONエクスポート・全削除。

未実装（画面上でも未実装と表示）：

- **Notion 同期・RAG**：テクニックの手順は要件定義書の記述に基づく一般的な内容で、Notion 本文は取得・照合していない。出典リンクには「未同期」と表示している。
- **認証・端末間同期（Supabase）**：現在はブラウザ内の localStorage のみ（暗号化なし）。
- Service Worker によるオフライン対応、Web Push、Phase 2 以降（CBT思考記録、ACTワーク、価値観、ジャーナル、スキルツリー、クエスト等）。
