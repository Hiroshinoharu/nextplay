// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Form from "../src/components/Form";
import { cleanup, render } from "./render";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Form", () => {
  it("uses the requested initial mode and toggles login password visibility", () => {
    const { container } = render(
      <Form apiBaseUrl="http://example.test/api" initialMode="register" />,
    );

    const modeToggle = container.querySelector('#auth-mode-toggle') as HTMLInputElement;
    const loginPassword = container.querySelector(
      '.flip-card__front input[name="password"]',
    ) as HTMLInputElement;
    const loginToggle = container.querySelector(
      '.flip-card__front .flip-card__password-toggle',
    ) as HTMLButtonElement;

    expect(modeToggle.checked).toBe(true);
    expect(loginPassword.type).toBe("password");

    act(() => {
      loginToggle.click();
    });

    expect(loginPassword.type).toBe("text");
  });

  it("shows the login validation message when required fields are missing", () => {
    const { container } = render(<Form apiBaseUrl="http://example.test/api" />);

    const loginForm = container.querySelector('.flip-card__front form') as HTMLFormElement;

    act(() => {
      loginForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Enter your email/username and password.");
  });
});
