/**
 * Redactron — Content Script Orchestrator
 *
 * The only file that talks to chrome.runtime. Everything it sends
 * "outward" (to the background service worker, which is the only
 * place a network call is ever made) has already been through the
 * redaction engine. Raw DOM values never cross this boundary.
 */

(function () {
  let lastRedactedElements = [];

  function buildRedactedSnapshot() {
    const raw = window.Redactron.extractSnapshot({ maxElements: 250 });
    const { snapshot, hits } = window.Redactron.redactSnapshot(raw);
    lastRedactedElements = snapshot.elements;
    return { snapshot, hits };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case "SCAN_PAGE": {
        const { snapshot, hits } = buildRedactedSnapshot();
        sendResponse({ snapshot, hitCount: hits.length, hitsByType: countByType(hits) });
        return false;
      }

      case "GET_SNAPSHOT": {
        const { snapshot, hits } = buildRedactedSnapshot();
        sendResponse({ snapshot, hitCount: hits.length, hitsByType: countByType(hits) });
        return false;
      }

      case "PROPOSE_ACTION": {
        window.Redactron
          .proposeAction(msg.action, lastRedactedElements)
          .then((result) => sendResponse(result));
        return true; // async response
      }

      case "CLEAR_HIGHLIGHT": {
        window.Redactron.clearHighlight();
        sendResponse({ ok: true });
        return false;
      }

      default:
        return false;
    }
  });

  function countByType(hits) {
    const out = {};
    for (const h of hits) out[h.type] = (out[h.type] || 0) + 1;
    return out;
  }
})();
