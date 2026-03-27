import {
  buildUpstreamUrl,
  copyRequestHeaders,
  gatewayRequestTimeoutMs,
  normalizeGatewayBase,
  readRequestBody,
  writeResponseHeaders,
} from "./proxy.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const gatewayBase = normalizeGatewayBase(process.env.NEXTPLAY_GATEWAY_URL);
  if (gatewayBase.error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: gatewayBase.error,
      }),
    );
    return;
  }

  const upstreamUrl = buildUpstreamUrl(gatewayBase.url, req.url);
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
      signal: AbortSignal.timeout(gatewayRequestTimeoutMs()),
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
  } catch (error) {
    const isAbort =
      error?.name === "AbortError" || error?.name === "TimeoutError";

    console.error("Gateway proxy request failed", {
      error: error instanceof Error ? error.message : String(error),
      method: req.method,
      upstreamUrl: upstreamUrl.toString(),
    });

    res.statusCode = isAbort ? 504 : 502;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: isAbort
          ? "Gateway upstream timed out."
          : "Gateway upstream is unavailable.",
      }),
    );
  }
}
