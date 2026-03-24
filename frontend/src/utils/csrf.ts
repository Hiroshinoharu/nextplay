export const CSRF_COOKIE_NAME = "nextplay_csrf";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Retrieves a cookie value from the given cookie source.
 * @param {string} name The name of the cookie to retrieve.
 * @param {string} [cookieSource] The source of the cookies. Defaults to `document.cookie`.
 * @returns {string} The value of the cookie, or an empty string if not found.
 */
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

/**
 * Retrieves the value of the CSRF cookie.
 * @param {string} [cookieSource] The source of the cookies. Defaults to `document.cookie`.
 * @returns {string} The value of the CSRF cookie, or an empty string if not found.
 */
export const getCSRFCookieValue = (cookieSource?: string) =>
  getCookieValue(CSRF_COOKIE_NAME, cookieSource);

/**
 * Returns true if the given HTTP method is protected by CSRF, false otherwise.
 * @param {string} [method] The HTTP method to check. Defaults to "GET".
 * @returns {boolean} True if the method is protected, false otherwise.
 */
export const isCSRFProtectedMethod = (method?: string) =>
  !SAFE_METHODS.has((method ?? "GET").trim().toUpperCase());

/**
 * Returns true if the given request should have a CSRF token attached,
 * false otherwise. This is determined by checking if the request method
 * is protected by CSRF and if the request URL origin matches one
 * of the allowed origins.
 * @param {string} requestUrl The URL of the request.
 * @param {string} [method] The HTTP method of the request. Defaults to "GET".
 * @param {string[]} allowedOrigins The list of allowed origins.
 * @param {string} [baseOrigin] The base origin used for resolving the request URL.
 * Defaults to `window.location.origin` if available, or "http://localhost" otherwise.
 * @returns {boolean} True if the request should have a CSRF token attached, false otherwise.
 */
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
