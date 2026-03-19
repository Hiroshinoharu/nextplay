import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type RenderResult = {
  container: HTMLDivElement;
  rerender: (nextUi: ReactNode) => void;
  unmount: () => void;
};

const mountedRoots: Array<{ container: HTMLDivElement; root: Root }> = [];

/**
 * Renders a React component into a DOM container and returns an object with
 * methods to re-render the component and unmount the container.
 *
 * @param {ReactNode} ui - The React component to render.
 *
 * @returns {RenderResult}
 * An object with the following properties:
 * - {HTMLDivElement} container - The DOM container where the component is rendered.
 * - {function(ReactNode): void} rerender - Re-renders the given React UI component into the DOM.
 * - {function(): void} unmount - Unmounts the React component from the DOM container.
 */
export const render = (ui: ReactNode): RenderResult => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push({ container, root });

  act(() => {
    root.render(ui);
  });

  return {
    container,
/**
 * Re-renders the given React UI component into the DOM.
 * This function is useful for testing React components in isolation.
 * It uses the `act` function from `react-test-library` to ensure
 * that the re-rendering is done within an act() call.
 * @param {ReactNode} nextUi - The React UI component to re-render.
 */
    rerender(nextUi) {
      act(() => {
        root.render(nextUi);
      });
    },
    unmount() {
      const index = mountedRoots.findIndex((entry) => entry.root === root);
      if (index >= 0) {
        mountedRoots.splice(index, 1);
      }
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

export const cleanup = () => {
  while (mountedRoots.length > 0) {
    const entry = mountedRoots.pop();
    if (!entry) continue;
    act(() => {
      entry.root.unmount();
    });
    entry.container.remove();
  }
  document.body.innerHTML = "";
};
