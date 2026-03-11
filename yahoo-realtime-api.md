# Yahoo リアルタイム検索 API 調査メモ

認証不要で叩けるAPIの調査結果。

---

## エンドポイント

```
GET https://search.yahoo.co.jp/realtime/api/v1/pagination
```

---

## パラメータ

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `p` | 文字列 | 検索クエリ（URLエンコード） |
| `md` | `h` / `t` | ソート順。`h`=話題順、`t`または省略=新着順 |
| `results` | 数値 | 取得件数。**最大40**（50以上はエラー） |
| `mtype` | `image` | メディア（画像/動画）付きツイートのみ |
| `oldestTweetId` | ツイートID | ページネーション用カーソル。前ページの最後のツイートIDを渡す |

### 無効・非推奨パラメータ
以下は値を変えても結果が変わらない（全て検証済み）：
- `rkf` — ログ用途と思われる
- `b` — オフセット指定を試みたが無効
- `span` — 自動更新の表示期間設定（秒）。絞り込みには効かない
- `interval` — 自動更新間隔（秒）。絞り込みには効かない
- `lang` — 言語指定。効かない
- `safe` — セーフサーチ。効かない
- 期間指定パラメータ — 存在しない

---

## レスポンス構造

```json
{
  "timeline": {
    "head": {
      "totalResultsAvailable": 14000,
      "totalResultsReturned": 40,
      "oldestTweetId": "..."  // 新着順のときのみ存在。人気順(md=h)では返ってこない
    },
    "entry": [
      {
        "id": "ツイートID",
        "url": "https://x.com/...",
        "displayTextBody": "ツイート本文（\tSTART\tキーワード\tEND\t形式でハイライト）",
        "createdAt": 1234567890,  // Unixタイムスタンプ
        "likesCount": 123,
        "rtCount": 45,
        "replyCount": 6,
        "qtCount": 7,
        "possiblySensitive": false,
        "screenName": "username",
        "name": "表示名",
        "profileImage": "https://rts-pctr.c.yimg.jp/...",
        "hashtags": [{ "text": "イラスト", "indices": [0, 5] }],
        "media": [
          {
            "type": "image",  // "image" | "animatedGif" | "video"
            "item": {
              "mediaUrl": "https://rts-pctr.c.yimg.jp/...",
              "thumbnailImageUrl": "https://rts-pctr.c.yimg.jp/...",
              "sizes": {
                "viewer": { "width": 800, "height": 1200 }
              }
            }
          }
        ]
      }
    ]
  }
}
```

---

## ページネーション

### 人気順（`md=h`）
- `oldestTweetId` がレスポンスの `head` に含まれない
- 代わりに **最後のエントリのID** を次リクエストの `oldestTweetId` に渡すと次ページが取れる
- 重複なしで動作確認済み

### 新着順（`md=h` なし）
- `head.oldestTweetId` が返ってくる場合がある
- 同様に最後のエントリIDでもページネーション可能

---

## 注意事項

- `totalResultsAvailable` は1万件以上と表示されるが、実際に取得できるのはページネーションで数百件程度
- `mtype=image` を付けると40件全部メディアあり。付けないと20件中6件程度しかメディアなし
- `displayTextBody` のキーワードハイライトは `\tSTART\t` と `\tEND\t` で囲まれる（除去が必要）
- プロフィール画像URLは `rts-pctr.c.yimg.jp` ドメイン（next.config.tsのremotePatternsに要追加）
- User-Agentを一般的なブラウザに偽装しないとブロックされる場合がある

---

## 使用例

```typescript
const params = new URLSearchParams({
  p: query,
  md: "h",           // 人気順
  results: "40",
  mtype: "image",
  ...(cursor ? { oldestTweetId: cursor } : {}),
});

const res = await fetch(`https://search.yahoo.co.jp/realtime/api/v1/pagination?${params}`, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://search.yahoo.co.jp/realtime/search",
  },
});

const data = await res.json();
const entries = data.timeline.entry;
const nextCursor = data.timeline.head?.oldestTweetId ?? entries.at(-1)?.id ?? null;
```
