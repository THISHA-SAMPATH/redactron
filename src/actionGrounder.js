/**
 * Redactron — Action Grounder
 *
 * Takes the LLM's proposed next action (referencing an `rid` from the
 * snapshot it was given) and turns it into a real, visible, confirmable
 * interaction on the live page. Nothing executes without the user
 * clicking "Confirm" in the on-page overlay — this is the safety valve
 * against a wrong or hallucinated action.
 */

(function () {
  let overlayEl = null;
  let pendingAction = null;

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement("div");
    overlayEl.id = "redactron-overlay-root";
    document.documentElement.appendChild(overlayEl);
    return overlayEl;
  }

  function clearHighlight() {
    document.querySelectorAll(".redactron-highlight-box, .redactron-tooltip").forEach((n) => n.remove());
  }

  /**
   * Fuzzy fallback: if the LLM didn't give a valid rid, try to find the
   * closest matching element from the last snapshot by label/text similarity.
   */
  function fuzzyResolve(description, snapshotElements) {
    if (!description) return null;
    const target = description.toLowerCase();
    let best = null, bestScore = 0;

    for (const el of snapshotElements) {
      const hay = `${el.label} ${el.text} ${el.placeholder}`.toLowerCase();
      if (!hay.trim()) continue;
      const score = similarity(target, hay);
      if (score > bestScore) { bestScore = score; best = el; }
    }
    return bestScore > 0.3 ? best : null;
  }

  function similarity(a, b) {
    const aw = new Set(a.split(/\W+/).filter(Boolean));
    const bw = new Set(b.split(/\W+/).filter(Boolean));
    if (!aw.size || !bw.size) return 0;
    let overlap = 0;
    for (const w of aw) if (bw.has(w)) overlap++;
    return overlap / Math.max(aw.size, bw.size);
  }

  /**
   * Highlight the target element on the page and show a confirm/skip
   * tooltip. Returns a Promise<boolean> resolved when the user decides.
   */
  function proposeAction(action, snapshotElements) {
    clearHighlight();
    ensureOverlay();

    let node = action.rid ? window.Redactron.resolveElement(action.rid) : null;
    if (!node && action.target_description) {
      const match = fuzzyResolve(action.target_description, snapshotElements);
      if (match) node = window.Redactron.resolveElement(match.rid);
    }

    if (!node) {
      pendingAction = null;
      return Promise.resolve({ ok: false, reason: "no_matching_element" });
    }

    const rect = node.getBoundingClientRect();
    const box = document.createElement("div");
    box.className = "redactron-highlight-box";
    box.style.top = `${rect.top + window.scrollY}px`;
    box.style.left = `${rect.left + window.scrollX}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    document.documentElement.appendChild(box);

    return new Promise((resolve) => {
      const tooltip = document.createElement("div");
      tooltip.className = "redactron-tooltip";
      tooltip.style.top = `${rect.top + window.scrollY - 44}px`;
      tooltip.style.left = `${rect.left + window.scrollX}px`;
      tooltip.innerHTML = `
        <span class="redactron-tooltip-text">${escapeHtml(action.reason || "Next step")}</span>
        <button class="redactron-btn redactron-btn-confirm">Confirm</button>
        <button class="redactron-btn redactron-btn-skip">Skip</button>
      `;
      document.documentElement.appendChild(tooltip);

      tooltip.querySelector(".redactron-btn-confirm").addEventListener("click", () => {
        executeAction(node, action);
        clearHighlight();
        resolve({ ok: true, executed: true });
      });
      tooltip.querySelector(".redactron-btn-skip").addEventListener("click", () => {
        clearHighlight();
        resolve({ ok: true, executed: false });
      });
    });
  }

  function executeAction(node, action) {
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    switch (action.action) {
      case "click":
        node.click();
        break;
      case "fill":
        if ("value" in node) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          if (setter) setter.call(node, action.value || "");
          node.dispatchEvent(new Event("input", { bubbles: true }));
          node.dispatchEvent(new Event("change", { bubbles: true }));
        }
        break;
      case "focus":
        node.focus();
        break;
      default:
        break;
    }
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  window.Redactron = window.Redactron || {};
  window.Redactron.proposeAction = proposeAction;
  window.Redactron.clearHighlight = clearHighlight;
})();
