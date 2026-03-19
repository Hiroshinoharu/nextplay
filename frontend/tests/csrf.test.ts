import { describe, expect, it } from "vitest";

import {
  CSRF_COOKIE_NAME,
  getCSRFCookieValue,
  getCookieValue,
  isCSRFProtectedMethod,
  shouldAttachCSRFToken,
} from "../src/utils/csrf";

describe("getCookieValue", () => {
  it("reads named cookies from a cookie string", () => {
    expect(getCookieValue("theme", "theme=dark; session=abc123")).toBe("dark");
  });

  it("returns the csrf cookie value through the helper", () => {
    expect(getCSRFCookieValue(`${CSRF_COOKIE_NAME}=csrf-token; theme=dark`)).toBe("csrf-token");
  });

  it("returns an empty string when the cookie is missing", () => {
    expect(getCSRFCookieValue("theme=dark")).toBe("");
  });
});

describe("isCSRFProtectedMethod", () => {
  it("treats unsafe methods as csrf-protected", () => {
    expect(isCSRFProtectedMethod("POST")).toBe(true);
    expect(isCSRFProtectedMethod("patch")).toBe(true);
  });

  it("treats safe methods as exempt", () => {
    expect(isCSRFProtectedMethod("GET")).toBe(false);
    expect(isCSRFProtectedMethod("HEAD")).toBe(false);
    expect(isCSRFProtectedMethod("OPTIONS")).toBe(false);
  });
});

describe("shouldAttachCSRFToken", () => {
  const allowedOrigins = ["http://localhost:5173", "http://localhost:18084"];

  it("attaches to unsafe same-origin or api-origin requests", () => {
    expect(
      shouldAttachCSRFToken("/api/users/logout", "POST", allowedOrigins, "http://localhost:5173"),
    ).toBe(true);
    expect(
      shouldAttachCSRFToken(
        "http://localhost:18084/api/users/42",
        "DELETE",
        allowedOrigins,
        "http://localhost:5173",
      ),
    ).toBe(true);
  });

  it("skips safe methods and third-party origins", () => {
    expect(
      shouldAttachCSRFToken("/api/users/logout", "GET", allowedOrigins, "http://localhost:5173"),
    ).toBe(false);
    expect(
      shouldAttachCSRFToken(
        "https://example.com/webhook",
        "POST",
        allowedOrigins,
        "http://localhost:5173",
      ),
    ).toBe(false);
  });
});
