import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from "node:http";

const YAHOO_API = "https://search.yahoo.co.jp/realtime/api/v1/pagination";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function createServer() {
  const server = new Server(
    { name: "yahomcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search_realtime",
        description: "Yahoo リアルタイム検索でツイートを検索する",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "検索クエリ" },
            sort: {
              type: "string",
              enum: ["popular", "recent"],
              description: "popular=話題順, recent=新着順（デフォルト: popular）",
            },
            results: {
              type: "number",
              description: "取得件数（最大40、デフォルト: 40）",
            },
            media_only: {
              type: "boolean",
              description: "画像/動画付きツイートのみ取得（デフォルト: false）",
            },
            cursor: {
              type: "string",
              description: "ページネーション用カーソル（前ページの最後のツイートID）",
            },
          },
          required: ["query"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name !== "search_realtime") {
      throw new Error(`Unknown tool: ${req.params.name}`);
    }

    const { query, sort = "popular", results = 40, media_only = false, cursor } =
      req.params.arguments as {
        query: string;
        sort?: string;
        results?: number;
        media_only?: boolean;
        cursor?: string;
      };

    const params = new URLSearchParams({
      p: query,
      results: String(Math.min(results, 40)),
      ...(sort === "popular" ? { md: "h" } : {}),
      ...(media_only ? { mtype: "image" } : {}),
      ...(cursor ? { oldestTweetId: cursor } : {}),
    });

    const res = await fetch(`${YAHOO_API}?${params}`, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        Referer: "https://search.yahoo.co.jp/realtime/search",
      },
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    const entries: any[] = data.timeline?.entry ?? [];
    const nextCursor: string | null =
      data.timeline?.head?.oldestTweetId ?? entries.at(-1)?.id ?? null;

    const tweets = entries.map((e: any) => ({
      id: e.id,
      url: e.url,
      text: e.displayTextBody?.replace(/\tSTART\t|\tEND\t/g, "") ?? "",
      createdAt: new Date(e.createdAt * 1000).toISOString(),
      user: { screenName: e.screenName, name: e.name },
      stats: { likes: e.likesCount, retweets: e.rtCount, replies: e.replyCount, quotes: e.qtCount },
      ...(e.media?.length ? { media: e.media.map((m: any) => ({ type: m.type, url: m.item?.mediaUrl })) } : {}),
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ tweets, nextCursor, total: data.timeline?.head?.totalResultsAvailable }, null, 2),
        },
      ],
    };
  });

  return server;
}

// SSE HTTP サーバー
const transports = new Map<string, SSEServerTransport>();

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/sse") {
    const transport = new SSEServerTransport("/message", res);
    transports.set(transport.sessionId, transport);
    res.on("close", () => transports.delete(transport.sessionId));
    const server = createServer();
    await server.connect(transport);
    return;
  }

  if (req.method === "POST" && url.pathname === "/message") {
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const transport = transports.get(sessionId);
    if (!transport) {
      res.writeHead(404).end("Session not found");
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      await transport.handlePostMessage(req, res, JSON.parse(body));
    });
    return;
  }

  res.writeHead(404).end();
});

const PORT = process.env.PORT ?? 3000;
httpServer.listen(PORT, () => {
  console.error(`yahomcp SSE server running on http://localhost:${PORT}/sse`);
});
