export type FocusTrapOptions = {
  container: HTMLElement;
  onEscape?: () => void;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1
  );
}

/** Minimal focus trap for overlay primitives — Wave 8+ domain adoption. */
export function trapFocusWithin(container: HTMLElement): () => void {
  const focusable = getFocusableElements(container);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Tab" || focusable.length === 0) {
      return;
    }

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      return;
    }

    if (document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  container.addEventListener("keydown", handleKeyDown);
  first?.focus();

  return () => {
    container.removeEventListener("keydown", handleKeyDown);
  };
}

export function bindOverlayEscapeListener(onEscape?: () => void): () => void {
  if (!onEscape) {
    return () => undefined;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onEscape?.();
    }
  }

  document.addEventListener("keydown", handleKeyDown);
  return () => {
    document.removeEventListener("keydown", handleKeyDown);
  };
}

export function activateOverlayFocusTrap(options: FocusTrapOptions): () => void {
  const releaseEscape = bindOverlayEscapeListener(options.onEscape);
  const releaseTrap = trapFocusWithin(options.container);

  return () => {
    releaseTrap();
    releaseEscape();
  };
}
