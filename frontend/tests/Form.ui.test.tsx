// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Form from "../src/components/Form";
import { cleanup, render } from "./render";

const changeValue = (input: HTMLInputElement, value: string) => {
  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

const flushAvailabilityTimer = async () => {
  await act(async () => {
    vi.advanceTimersByTime(450);
    await Promise.resolve();
    await Promise.resolve();
  });
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

  it("renders availability results only after a matching successful response", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        username: { value: "maxceban", exists: false },
        email: { value: "hiroshinoharu@gmail.com", exists: true },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <Form apiBaseUrl="http://example.test/api" initialMode="register" />,
    );

    const usernameInput = container.querySelector('input[name="username"]') as HTMLInputElement;
    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;

    changeValue(usernameInput, "maxceban");
    changeValue(emailInput, "hiroshinoharu@gmail.com");
    await flushAvailabilityTimer();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Username is available.");
    expect(container.textContent).toContain("Email already exists.");
  });

  it("does not show success badges when the availability check is rate limited", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn().mockResolvedValue({ error: "too many requests" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <Form apiBaseUrl="http://example.test/api" initialMode="register" />,
    );

    const usernameInput = container.querySelector('input[name="username"]') as HTMLInputElement;
    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;

    changeValue(usernameInput, "maxceban");
    changeValue(emailInput, "hiroshinoharu@gmail.com");
    await flushAvailabilityTimer();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Username is available.");
    expect(container.textContent).not.toContain("Email is available.");
    expect(container.textContent).toContain("Checking too quickly. Pause briefly and try again.");
  });
});
