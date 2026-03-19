// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Lightbox from "../src/components/Lightbox";
import { cleanup, render } from "./render";

afterEach(() => {
  cleanup();
});

describe("Lightbox", () => {
  it("renders the active image and reacts to keyboard navigation", () => {
    const onChangeIndex = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <Lightbox
        images={["/one.jpg", "/two.jpg", "/three.jpg"]}
        activeIndex={1}
        onChangeIndex={onChangeIndex}
        onClose={onClose}
        altContext="gallery"
      />,
    );

    const image = container.querySelector(".media-lightbox__image") as HTMLImageElement;
    expect(image.getAttribute("src")).toBe("/two.jpg");
    expect(image.getAttribute("alt")).toBe("Screenshot 2 of gallery");
    expect(container.textContent).toContain("Screenshot 2 of 3");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onChangeIndex).toHaveBeenNthCalledWith(1, 2);
    expect(onChangeIndex).toHaveBeenNthCalledWith(2, 0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render when closed", () => {
    const { container } = render(
      <Lightbox images={["/one.jpg"]} activeIndex={null} onChangeIndex={vi.fn()} onClose={vi.fn()} />,
    );

    expect(container.innerHTML).toBe("");
  });
});
