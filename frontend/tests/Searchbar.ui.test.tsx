// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Searchbar from "../src/components/Searchbar";
import { cleanup, render } from "./render";

afterEach(() => {
  cleanup();
});

describe("Searchbar", () => {
  it("emits input changes and submit events", () => {
    const onValueChange = vi.fn();
    const onSubmit = vi.fn();
    const { container } = render(
      <Searchbar value="Halo" onValueChange={onValueChange} onSubmit={onSubmit} />,
    );

    const input = container.querySelector('input[name="search_query"]') as HTMLInputElement;
    const form = container.querySelector('form[role="search"]') as HTMLFormElement;

    expect(input.value).toBe("Halo");

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(input, "Portal");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onValueChange).toHaveBeenCalledWith("Portal");

    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
