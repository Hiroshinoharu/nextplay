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

const INTERNAL_SERVICE_HOSTS = new Set([
  "gateway",
  "game",
  "localhost",
  "recommender",
  "user",
]);

const DEFAULT_GATEWAY_TIMEOUT_MS = 15_000;

/**
 * Returns a string representation of the given value.
 * If the value is an array, joins the elements with a comma separator.
 * If the value is a string, returns the string as-is.
 * Otherwise, returns an empty string.
 * @param {Any} value The value to convert to a string.
 * @returns {string} The string representation of the given value.
 */
const headerValue = (value) => {
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" ? value : "";
};

/**
 * Returns true if the given hostname is a valid RFC 1918 private IP address.
 * Valid addresses include those in the 10.0.0.0/8, 172.16.0.0/12, and 192.168.0.0/16 ranges.
 * @param {string} hostname The hostname to validate.
 * @returns {boolean} True if the hostname is a valid RFC 1918 private IP address, false otherwise.
 */
const isRFC1918Hostname = (hostname) => {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;

  const match = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!match) return false;

  const secondOctet = Number.parseInt(match[1], 10);
  return secondOctet >= 16 && secondOctet <= 31;
};

/**
 * Removes the trailing "/api" segment from a given pathname.
 * If the pathname does not end with "/api", returns the original pathname.
 * If the resulting pathname is empty or just a single slash, returns a single slash.
 * @param {string} pathname The pathname to process.
 * @returns {string} The processed pathname.
 */
const removeTrailingAPISegment = (pathname) => {
  const trimmedPath = pathname.replace(/\/+$/, "");
  if (!trimmedPath || trimmedPath === "/") return "/";
  if (!trimmedPath.endsWith("/api")) return trimmedPath;

  const withoutAPI = trimmedPath.slice(0, -4);
  return withoutAPI || "/";
};

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Normalizes a given NEXTPLAY_GATEWAY_URL value.
 * The function will return an error if the value is empty, not an absolute URL, or points to a
 * non-publicly reachable gateway when the frontend runs on Vercel.
 * Otherwise, the function will return a normalized URL object where the hash, search, and trailing
 * "/api" segments are removed.
 * @param {string} rawValue The value to normalize.
 * @returns {{ error: string } | { url: URL }}
 */
/*******  790c7a44-c501-46b4-b221-1b594b6fe0c7  *******/
export const normalizeGatewayBase = (rawValue) => {
  const trimmedValue = String(rawValue ?? "").trim();
  if (!trimmedValue) {
    return { error: "NEXTPLAY_GATEWAY_URL is not configured." };
  }

  let parsed;
  try {
    parsed = new URL(trimmedValue);
  } catch {
    return {
      error:
        "NEXTPLAY_GATEWAY_URL must be an absolute URL like https://gateway.example.com.",
    };
  }

  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = removeTrailingAPISegment(parsed.pathname);

  const hostname = parsed.hostname.trim().toLowerCase();
  if (
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    INTERNAL_SERVICE_HOSTS.has(hostname) ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    isRFC1918Hostname(hostname)
  ) {
    return {
      error:
        "NEXTPLAY_GATEWAY_URL must point to a publicly reachable gateway when the frontend runs on Vercel.",
    };
  }

  parsed.pathname = parsed.pathname.endsWith("/")
    ? parsed.pathname
    : `${parsed.pathname}/`;

  return { url: parsed };
};

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Builds a URL that points to a resource on the Gateway service.
 * The function takes two parameters: the base URL of the Gateway service and the URL of the request as seen by the frontend.
 * The function will return a new URL object that contains the relative path of the request URL appended to the Gateway base URL.
 * The function will preserve the query string of the original request URL.
 * @param {URL|string} gatewayBaseUrl The base URL of the Gateway service.
 * @param {string} requestUrl The URL of the request as seen by the frontend.
 * @returns {URL} The built URL object that points to a resource on the Gateway service.
 */
/*******  cbbe911e-e766-479d-8990-6e04dc01f981  *******/
export const buildUpstreamUrl = (gatewayBaseUrl, requestUrl) => {
  const rawRequestUrl = String(requestUrl ?? "/api/health").trim();
  const incomingUrl = new URL(rawRequestUrl, "http://nextplay.local");
  const relativePath = incomingUrl.pathname.replace(/^\/+/, "") || "api/health";
  const upstreamUrl = new URL(relativePath, gatewayBaseUrl);

  upstreamUrl.search = incomingUrl.search;
  return upstreamUrl;
};

export const copyRequestHeaders = (requestHeaders) => {
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

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Reads the request body of a given request into a single Buffer.
 * If the request method is GET or HEAD, the function will return undefined.
 * @param {http.IncomingMessage} req The request to read the body from.
 * @returns {Promise<Buffer|undefined>} A promise that resolves to the request body as a single Buffer, or undefined if the request method is GET or HEAD.
/*******  dc31bcf3-067f-4dce-b9bf-db03f81b6692  *******/
export const readRequestBody = async (req) => {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
};

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Copies the response headers from an upstream response to a given response object.
 * This function will preserve the Set-Cookie header from the upstream response, and will ignore the Content-Length and HOP-by-HOP headers.
 * @param {http.IncomingMessage} upstreamResponse The upstream response to copy headers from.
 * @param {http.ServerResponse} res The response object to copy headers to.
 */
/*******  10296c29-8c87-4d85-8523-eafdb61340d0  *******/
export const writeResponseHeaders = (upstreamResponse, res) => {
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

const parseTimeoutMs = (rawValue) => {
  const trimmedValue = String(rawValue ?? "").trim();
  if (!trimmedValue) return DEFAULT_GATEWAY_TIMEOUT_MS;

  const parsedValue = Number.parseInt(trimmedValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_GATEWAY_TIMEOUT_MS;
  }

  return parsedValue;
};

export const gatewayRequestTimeoutMs = () =>
  parseTimeoutMs(process.env.NEXTPLAY_GATEWAY_TIMEOUT_MS);
