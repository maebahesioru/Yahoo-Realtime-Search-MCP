# Yahoo Realtime Search MCP

Yahoo リアルタイム検索（X/Twitter）を検索できる MCP サーバー。

## ツール

### `search_realtime`

| 引数 | 型 | 必須 | 説明 |
|------|----|------|------|
| `query` | string | ✅ | 検索クエリ |
| `sort` | `popular` \| `recent` | | 話題順 / 新着順（デフォルト: `popular`） |
| `results` | number | | 取得件数（最大40、デフォルト: 20） |
| `media_only` | boolean | | 画像/動画付きのみ（デフォルト: `false`） |
| `cursor` | string | | ページネーション用カーソル |

## デプロイ

### Render

1. このリポジトリをフォーク
2. [render.com](https://render.com) で "New Web Service" を作成
3. 以下を設定：
   - Build Command: `npm install && npm run build`
   - Start Command: `node dist/index.js`

## ChatGPT への登録

MCP サーバーの URL に `https://<your-render-url>/sse` を入力、認証なしで登録。

## ローカルで起動

```bash
npm install
npm run build
node dist/index.js
# http://localhost:3000/sse
```
