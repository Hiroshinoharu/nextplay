// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ScreenshotGallery from "../src/components/ScreenshotGallery";
import { cleanup, render } from "./render";

const dispatchKeyboardStyleClick = (element: Element) => {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
};

afterEach(() => {
  cleanup();
});

describe("ScreenshotGallery", () => {
  it("deduplicates screenshots and navigates between them", () => {
    const { container } = render(
      <ScreenshotGallery
        screenshots={["/one.jpg", "/one.jpg", "/two.jpg"]}
        gameName="Test Game"
      />,
    );

    const thumbButtons = container.querySelectorAll('button[aria-label^="Show screenshot "]');
    const nextButton = container.querySelector(
      'button[aria-label="Show next screenshot"]',
    ) as HTMLButtonElement;
    const frameButton = container.querySelector(
      'button[aria-label^="Open screenshot"]',
    ) as HTMLButtonElement;

    expect(thumbButtons).toHaveLength(2);
    expect(container.textContent).toContain("Screenshot 1 of 2");

    act(() => {
      dispatchKeyboardStyleClick(nextButton);
    });

    expect(container.textContent).toContain("Screenshot 2 of 2");
    expect(frameButton.getAttribute("aria-label")).toBe("Open screenshot 2 of Test Game");
  });

  it("opens the currently selected screenshot and supports thumb selection", () => {
    const onOpen = vi.fn();
    const { container } = render(
      <ScreenshotGallery
        screenshots={["/one.jpg", "/two.jpg", "/three.jpg"]}
        gameName="Gallery"
        onOpen={onOpen}
      />,
    );

    const thirdThumb = container.querySelector(
      'button[aria-label="Show screenshot 3"]',
    ) as HTMLButtonElement;
    const frameButton = container.querySelector(
      'button[aria-label^="Open screenshot"]',
    ) as HTMLButtonElement;

    act(() => {
      dispatchKeyboardStyleClick(thirdThumb);
    });

    expect(container.textContent).toContain("Screenshot 3 of 3");

    act(() => {
      dispatchKeyboardStyleClick(frameButton);
    });

    expect(onOpen).toHaveBeenCalledWith(2);
  });
});
