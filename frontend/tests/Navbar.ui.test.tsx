// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import Navbar from "../src/components/Navbar";
import { cleanup, render } from "./render";

/**
 * A simple component that renders the current location as a string.
 * Useful for testing navigation-related components.
 * @returns {React.ReactElement} A div element with a data-testid of "location" and the current location as its text content.
 */
const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

afterEach(() => {
  cleanup();
});

describe("Navbar", () => {
  it("marks the active section from the current route", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/user/settings"]}>
        <Navbar />
      </MemoryRouter>,
    );

    const myListButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "My List",
    ) as HTMLButtonElement;

    expect(myListButton.getAttribute("aria-current")).toBe("page");
    expect(myListButton.className).toContain("is-active");
  });

  it("navigates when a nav button is clicked", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/discover"]}>
        <Navbar />
        <LocationProbe />
      </MemoryRouter>,
    );

    const homeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Home",
    ) as HTMLButtonElement;
    const locationProbe = container.querySelector('[data-testid="location"]') as HTMLDivElement;

    expect(locationProbe.textContent).toBe("/discover");

    act(() => {
      homeButton.click();
    });

    expect(locationProbe.textContent).toBe("/games");
    expect(homeButton.getAttribute("aria-current")).toBe("page");
  });
});
