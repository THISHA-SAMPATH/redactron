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
    { type: "GOOGLE_API_KEY", regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },

    // Vendor keys with underscore-delimited env segments (sk_live_..., sk-proj-..., sk-ant-api03-...).
    // Must run before GENERIC_API_KEY / AWS_SECRET_KEY, which assume a single contiguous alnum run.
    { type: "VENDOR_SECRET_KEY", regex: /\b(sk|pk|rk)[-_](live|test|proj|ant)?[-_]?(api\d{0,2}[-_])?[A-Za-z0-9]{10,}(?:[-_][A-Za-z0-9]{4,})*\b/g },

    // Azure subscription/tenant IDs are just UUIDs — only label them Azure when the
    // surrounding text actually says so. A bare UUID (session id, request id, React key,
    // etc.) is still redacted below as GENERIC_UUID instead of being mislabeled.
    { type: "AZURE_SUBSCRIPTION_ID", regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, guard: (ctx) => /azure|subscription|tenant/i.test(ctx) },

    { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
    { type: "IBAN", regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g },

    // --- Numeric sequences: card numbers must be claimed before PHONE gets a shot ---
    { type: "CREDIT_CARD", regex: /\b\d(?:[ -]?\d){12,15}\b/g, validate: luhnCheck },

    // --- Context-guarded (need surrounding words to confirm sensitivity) ---
    { type: "AWS_SECRET_KEY", regex: /\b[A-Za-z0-9/+=]{40}\b/g, guard: (ctx) => /secret|key/i.test(ctx) },
    { type: "AWS_ACCOUNT_ID", regex: /\b\d{12}\b/g, guard: (ctx) => /account|aws|iam|arn/i.test(ctx) },
    // GCP project *numbers* are bare 10-13 digit numbers with no structure of their own —
    // only redact when context actually says GCP/project, and never swallow the label
    // itself the way a single label+colon+digits regex used to.
    { type: "GCP_PROJECT_ID", regex: /\b\d{10,13}\b/g, guard: (ctx) => /gcp|google cloud|project[\s_-]?(id|number)/i.test(ctx) },
    { type: "GENERIC_API_KEY", regex: /\b(api|key|token)[-_][A-Za-z0-9]{16,}\b/gi },

    // Anything UUID-shaped that wasn't already claimed above (session ids, request ids,
    // tracking ids, etc.). Still redacted by default since these can be used to correlate
    // a user across requests, but labeled honestly instead of as an Azure ID.
    { type: "GENERIC_UUID", regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },

    // --- Broad PII (must run last so they don't consume more specific matches) ---
    { type: "EMAIL", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
    { type: "IPV4", regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },

    // Phone numbers, split into three shapes instead of one loose catch-all:
    //  1. International, marked with a leading "+" (handles "+91 98765 43210" grouping).
    //  2. Locally structured — has parens and/or a separator, so it can't be confused
    //     with an arbitrary digit-only ID (order numbers, tracking numbers, etc.).
    //  3. Bare digits with NO separators at all — restricted to exactly 10 digits (the
    //     common unformatted mobile length in India/US/etc.) so a 12-digit order ID or
    //     a GCP/AWS numeric ID isn't swept up as a "phone number".
    { type: "PHONE", regex: /\+\d{1,3}[-.\s]?\d{2,5}[-.\s]?\d{2,5}(?:[-.\s]?\d{2,5})?\b/g },
    { type: "PHONE", regex: /\(\d{3,4}\)[-.\s]?\d{3,5}[-.\s]?\d{0,5}\b/g },
    { type: "PHONE", regex: /\b\d{3,5}[-.\s]\d{3,5}(?:[-.\s]\d{2,4})?\b/g },
    { type: "PHONE", regex: /\b\d{10}\b/g },
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