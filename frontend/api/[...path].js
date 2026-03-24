export const config = {
  api: {
    bodyParser: false,
  },
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const normalizeGatewayBase = (rawValue) => {
  const trimmedValue = String(rawValue ?? "").trim();
  if (!trimmedValue) return "";

  const withoutTrailingSlashes = trimmedValue.replace(/\/+$/, "");
  return withoutTrailingSlashes.endsWith("/api")
    ? withoutTrailingSlashes.slice(0, -4)
    : withoutTrailingSlashes;
};

const headerValue = (value) => {
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" ? value : "";
};

const copyRequestHeaders = (requestHeaders) => {
  const headers = new Headers();

  for (const [key, rawValue] of Object.entries(requestHeaders ?? {})) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "host" || HOP_BY_HOP_HEADERS.has(lowerKey)) {
      continue;
    }

    const value = headerValue(rawValue);
    if (!value) continue;
    headers.set(key, value);
  }

  return headers;
};

const readRequestBody = async (req) => {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
};

const writeResponseHeaders = (upstreamResponse, res) => {
  const setCookies =
    typeof upstreamResponse.headers.getSetCookie === "function"
      ? upstreamResponse.headers.getSetCookie()
      : [];
  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  }

  upstreamResponse.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === "set-cookie" ||
      lowerKey === "content-length" ||
      HOP_BY_HOP_HEADERS.has(lowerKey)
    ) {
      return;
    }

    res.setHeader(key, value);
  });
};

export default async function handler(req, res) {
  const gatewayBase = normalizeGatewayBase(process.env.NEXTPLAY_GATEWAY_URL);
  if (!gatewayBase) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error:
          "NEXTPLAY_GATEWAY_URL is not configured. Point it at the deployed gateway origin before using the Vercel frontend.",
      }),
    );
    return;
  }

  const upstreamUrl = new URL(req.url ?? "/api/health", `${gatewayBase}/`);
  const requestHeaders = copyRequestHeaders(req.headers);
  requestHeaders.set("x-forwarded-host", req.headers.host ?? "");
  requestHeaders.set(
    "x-forwarded-proto",
    req.headers["x-forwarded-proto"] ?? "https",
  );

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: requestHeaders,
      body: await readRequestBody(req),
      redirect: "manual",
    });

    res.statusCode = upstreamResponse.status;
    writeResponseHeaders(upstreamResponse, res);

    if (
      req.method === "HEAD" ||
      upstreamResponse.status === 204 ||
      upstreamResponse.status === 304
    ) {
      res.end();
      return;
    }

    const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
    res.end(buffer);
  } catch {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "Gateway upstream is unavailable.",
      }),
    );
  }
}