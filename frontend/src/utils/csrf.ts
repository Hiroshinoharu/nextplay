export const CSRF_COOKIE_NAME = "nextplay_csrf";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const getCookieValue = (
  name: string,
  cookieSource = typeof document !== "undefined" ? document.cookie : "",
): string => {
  const prefix = `${name}=`;
  for (const segment of cookieSource.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed.startsWith(prefix)) continue;
    return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return "";
};

export const getCSRFCookieValue = (cookieSource?: string) =>
  getCookieValue(CSRF_COOKIE_NAME, cookieSource);

export const isCSRFProtectedMethod = (method?: string) =>
  !SAFE_METHODS.has((method ?? "GET").trim().toUpperCase());

export const shouldAttachCSRFToken = (
  requestUrl: string,
  method: string | undefined,
  allowedOrigins: string[],
  baseOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost",
) => {
  if (!isCSRFProtectedMethod(method)) return false;

  try {
    const resolvedUrl = new URL(requestUrl, baseOrigin);
    return allowedOrigins.some((origin) => resolvedUrl.origin === new URL(origin, baseOrigin).origin);
  } catch {
    return false;
  }
};
