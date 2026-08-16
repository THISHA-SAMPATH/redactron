/**
 * Redactron — Page State Extractor
 *
 * Walks the live DOM and produces a compact, structured snapshot of
 * interactive elements (accessibility-tree style), NOT a screenshot
 * and NOT raw HTML. This snapshot is what gets redacted and sent to
 * the LLM — the actual pixels/markup never leave the device.
 */

(function () {
  const INTERACTIVE_SELECTOR = [
    "a[href]", "button", "input", "select", "textarea",
    "[role='button']", "[role='link']", "[role='checkbox']",
    "[role='radio']", "[role='tab']", "[role='menuitem']",
    "[role='switch']", "[role='combobox']", "[onclick]",
    "[contenteditable='true']", "summary",
  ].join(",");

  let idCounter = 0;
  const registry = new Map(); // rid -> live DOM node (local only, never serialized)

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return false;
    return true;
  }

  function accessibleName(el) {
    return (
      el.getAttribute("aria-label") ||
      el.getAttribute("alt") ||
      el.getAttribute("title") ||
      el.getAttribute("placeholder") ||
      (el.innerText ? el.innerText.trim().slice(0, 120) : "") ||
      el.getAttribute("name") ||
      ""
    );
  }

  function describeElement(el) {
    const rid = `r${idCounter++}`;
    registry.set(rid, el);

    const rect = el.getBoundingClientRect();
    return {
      rid,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || implicitRole(el),
      label: accessibleName(el),
      text: (el.innerText || "").trim().slice(0, 200),
      value: "value" in el ? String(el.value || "") : "",
      placeholder: el.getAttribute("placeholder") || "",
      testId: el.getAttribute("data-testid") || el.getAttribute("data-test") || "",
      type: el.getAttribute("type") || "",
      disabled: !!el.disabled,
      position: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    };
  }

  function implicitRole(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "a") return "link";
    if (tag === "button") return "button";
    if (tag === "input") return el.type === "checkbox" ? "checkbox" : el.type === "radio" ? "radio" : "textbox";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    return "generic";
  }

  /**
   * Build a fresh snapshot of the current page's interactive surface.
   */
  function extractSnapshot(opts = {}) {
    idCounter = 0;
    registry.clear();

    const nodes = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR));
    const elements = nodes
      .filter(isVisible)
      .slice(0, opts.maxElements || 250)
      .map(describeElement);

    return {
      url: opts.includeUrl === false ? undefined : location.hostname + location.pathname,
      title: document.title,
      elements,
      capturedAt: Date.now(),
    };
  }

  /** Resolve an rid back to its live DOM node. Local-only lookup. */
  function resolveElement(rid) {
    return registry.get(rid) || null;
  }

  window.Redactron = window.Redactron || {};
  window.Redactron.extractSnapshot = extractSnapshot;
  window.Redactron.resolveElement = resolveElement;
})();
