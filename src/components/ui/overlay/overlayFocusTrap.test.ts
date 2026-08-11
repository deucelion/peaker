import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activateOverlayFocusTrap,
  bindOverlayEscapeListener,
  getFocusableElements,
  trapFocusWithin,
} from "./overlayFocusTrap";

function createContainer(html: string) {
  const buttons: HTMLButtonElement[] = [];
  const links: HTMLAnchorElement[] = [];
  const inputs: HTMLInputElement[] = [];

  const template = html.trim();
  const buttonCount = (template.match(/<button/g) ?? []).length;
  for (let index = 0; index < buttonCount; index += 1) {
    buttons.push({
      focus: vi.fn(),
      textContent: index === 0 ? "First" : "Last",
      tabIndex: 0,
      hasAttribute: () => false,
    } as unknown as HTMLButtonElement);
  }
  if (template.includes('id="first"')) {
    // covered by buttonCount loop
  }
  if (template.includes('id="last"') && template.includes("</button>")) {
    // covered by buttonCount loop
  }
  if (template.includes("<input")) {
    inputs.push({
      focus: vi.fn(),
      tabIndex: 0,
      hasAttribute: () => false,
    } as unknown as HTMLInputElement);
  }
  if (template.includes("<a")) {
    links.push({
      focus: vi.fn(),
      textContent: "Last",
      tabIndex: 0,
      hasAttribute: () => false,
    } as unknown as HTMLAnchorElement);
  }
  if (template.includes("Action")) {
    buttons.push({
      focus: vi.fn(),
      textContent: "Action",
      tabIndex: 0,
      hasAttribute: () => false,
    } as unknown as HTMLButtonElement);
  }

  const container = {
    innerHTML: template,
    querySelectorAll: () => [...buttons, ...inputs, ...links] as unknown as NodeListOf<HTMLElement>,
    querySelector: (selector: string) => {
      if (selector === "#first") {
        return buttons[0] ?? null;
      }
      if (selector === "#last") {
        return buttons[buttons.length - 1] ?? links[0] ?? null;
      }
      return null;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLElement;

  return { container, buttons, links, inputs };
}

describe("overlayFocusTrap", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collects focusable elements inside container", () => {
    const { container } = createContainer(`
      <button type="button">First</button>
      <input type="text" />
      <a href="#">Last</a>
    `);

    expect(getFocusableElements(container)).toHaveLength(3);
  });

  it("wraps tab focus from last to first element", () => {
    const { container, buttons } = createContainer(`
      <button type="button" id="first">First</button>
      <button type="button" id="last">Last</button>
    `);

    const activeElement = buttons[1];
    vi.stubGlobal("document", { activeElement });

    trapFocusWithin(container);
    const keydown = (container.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      ([eventName]) => eventName === "keydown"
    )?.[1] as (event: KeyboardEvent) => void;

    keydown?.({ key: "Tab", shiftKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(buttons[0]?.focus).toHaveBeenCalled();
  });

  it("calls onEscape when Escape is pressed", () => {
    const handlers = new Map<string, (event: KeyboardEvent) => void>();
    vi.stubGlobal("document", {
      addEventListener: (type: string, handler: (event: KeyboardEvent) => void) => {
        handlers.set(type, handler);
      },
      removeEventListener: vi.fn(),
    });

    const onEscape = vi.fn();
    bindOverlayEscapeListener(onEscape);
    handlers.get("keydown")?.({
      key: "Escape",
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("activates trap and escape listeners together", () => {
    const handlers = new Map<string, (event: KeyboardEvent) => void>();
    vi.stubGlobal("document", {
      addEventListener: (type: string, handler: (event: KeyboardEvent) => void) => {
        handlers.set(type, handler);
      },
      removeEventListener: vi.fn(),
      activeElement: null,
    });

    const { container } = createContainer(`<button type="button">Action</button>`);
    const onEscape = vi.fn();
    activateOverlayFocusTrap({ container, onEscape });

    handlers.get("keydown")?.({
      key: "Escape",
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(container.addEventListener).toHaveBeenCalled();
  });
});
