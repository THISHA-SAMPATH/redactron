/**
 * Redactron — Redaction Engine
 *
 * Runs entirely in the content script (on-device, in-browser).
 * Nothing in this file ever makes a network call. It only ever
 * transforms text and returns a redaction map that stays local.
 *
 * Detection strategy:
 *  1. High-confidence structured patterns (regex) — secrets, IDs, ARNs
 *  2. Heuristic patterns (regex) — emails, phones, card numbers
 *  3. (Phase 2 hook) local NER pass for free-text names/addresses
 */

(function () {
  // Order matters: more specific / structured patterns MUST run before
  // broader ones, or a loose pattern (e.g. PHONE) will eat digits that
  // belong to a more specific match (e.g. CREDIT_CARD) first.
  const PATTERNS = [
    // --- Fully-structured, highest specificity ---
    { type: "PRIVATE_KEY_BLOCK", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
    { type: "JWT", regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
    { type: "AWS_ARN", regex: /\barn:aws:[a-zA-Z0-9-]+:[a-zA-Z0-9-]*:\d{0,12}:[^\s"'<>]+/g },
    { type: "AWS_ACCESS_KEY", regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
    { type: "AZURE_SUBSCRIPTION_ID", regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
    { type: "GCP_PROJECT_ID", regex: /\b[a-z][a-z0-9-]{4,28}[a-z0-9]:\d{10,}\b/g },
    { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
    { type: "IBAN", regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g },

    // --- Numeric sequences: card numbers must be claimed before PHONE gets a shot ---
    { type: "CREDIT_CARD", regex: /\b\d(?:[ -]?\d){12,15}\b/g, validate: luhnCheck },

    // --- Context-guarded (need surrounding words to confirm sensitivity) ---
    { type: "AWS_SECRET_KEY", regex: /\b[A-Za-z0-9/+=]{40}\b/g, guard: (ctx) => /secret|key/i.test(ctx) },
    { type: "AWS_ACCOUNT_ID", regex: /\b\d{12}\b/g, guard: (ctx) => /account|aws|iam|arn/i.test(ctx) },
    { type: "GENERIC_API_KEY", regex: /\b(sk|pk|api|key|token)[-_][A-Za-z0-9]{16,}\b/gi },

    // --- Broad PII (must run last so they don't consume more specific matches) ---
    { type: "EMAIL", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
    { type: "IPV4", regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
    { type: "PHONE", regex: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g },
  ];

  function luhnCheck(raw) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }

  /**
   * Redact a single string. Returns { redacted, hits[] }.
   * hits is local-only metadata: { type, token, original } — never sent anywhere.
   */
  function redactText(text, counters = {}) {
    if (!text || typeof text !== "string") return { redacted: text, hits: [] };

    let redacted = text;
    const hits = [];

    for (const pattern of PATTERNS) {
      redacted = redacted.replace(pattern.regex, (match, ...args) => {
        // guard: only redact if surrounding context suggests it's sensitive
        if (pattern.guard) {
          const context = text.slice(
            Math.max(0, text.indexOf(match) - 30),
            text.indexOf(match) + match.length + 30
          );
          if (!pattern.guard(context)) return match;
        }
        if (pattern.validate && !pattern.validate(match)) return match;

        counters[pattern.type] = (counters[pattern.type] || 0) + 1;
        const token = `[${pattern.type}_${counters[pattern.type]}]`;
        hits.push({ type: pattern.type, token, original: match });
        return token;
      });
    }

    return { redacted, hits };
  }

  /**
   * Redact an entire page-state snapshot (array of element descriptors).
   * Mutates a copy — never touches the live DOM or the original object.
   */
  function redactSnapshot(snapshot) {
    const counters = {};
    const allHits = [];

    const redactedElements = snapshot.elements.map((el) => {
      const copy = { ...el };
      for (const field of ["text", "label", "value", "placeholder"]) {
        if (copy[field]) {
          const { redacted, hits } = redactText(copy[field], counters);
          copy[field] = redacted;
          if (hits.length) allHits.push(...hits);
        }
      }
      return copy;
    });

    return {
      snapshot: { ...snapshot, elements: redactedElements },
      hits: allHits, // kept local only, for the popup's redaction log
    };
  }

  window.Redactron = window.Redactron || {};
  window.Redactron.redactText = redactText;
  window.Redactron.redactSnapshot = redactSnapshot;
})();
