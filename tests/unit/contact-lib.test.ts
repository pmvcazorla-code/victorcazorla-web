import { describe, expect, it } from "vitest";
import {
  validateContactSubmission,
  sanitizeHeaderValue,
  buildEmailPayload,
  buildConfirmationEmailPayload,
  rateLimitKey,
  emailRateLimitKey,
  isDisposableEmail,
  countMessageUrls,
  findSpamKeyword,
  checkForSpamContent,
  MAX_MESSAGE_URLS,
  MIN_SUBMIT_MS,
  MAX_SUBMIT_AGE_MS,
  type ContactInput,
} from "../../functions/_lib/contact";

const NOW = 1_800_000_000_000;

function baseInput(overrides: Partial<ContactInput> = {}): ContactInput {
  return {
    name: "Ana García",
    email: "ana@example.com",
    reason: "academic",
    message: "Hola, quería consultar sobre una colaboración.",
    honeypot: "",
    consent: true,
    ts: NOW - MIN_SUBMIT_MS - 1000,
    ...overrides,
  };
}

describe("validateContactSubmission", () => {
  it("accepts a well-formed submission", () => {
    const result = validateContactSubmission(baseInput(), NOW);
    expect(result).toEqual({
      valid: true,
      data: {
        name: "Ana García",
        email: "ana@example.com",
        reason: "academic",
        message: "Hola, quería consultar sobre una colaboración.",
      },
    });
  });

  it("flags a filled honeypot field", () => {
    const result = validateContactSubmission(baseInput({ honeypot: "http://spam.example" }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("honeypot");
  });

  it("rejects a missing name", () => {
    const result = validateContactSubmission(baseInput({ name: "" }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("name");
  });

  it("rejects a name over the max length", () => {
    const result = validateContactSubmission(baseInput({ name: "a".repeat(121) }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("name");
  });

  it("rejects an invalid email address", () => {
    const result = validateContactSubmission(baseInput({ email: "not-an-email" }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("email");
  });

  it("rejects a missing reason", () => {
    const result = validateContactSubmission(baseInput({ reason: "" }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("reason");
  });

  it("rejects a reason value outside the known set (tampered request)", () => {
    const result = validateContactSubmission(baseInput({ reason: "not_a_real_reason" }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("reason");
  });

  it.each(["it_opportunities", "science_research", "philosophy_research", "professional_ethics", "academic", "other"])(
    "accepts the reason value %s",
    (reason) => {
      const result = validateContactSubmission(baseInput({ reason }), NOW);
      expect(result.valid).toBe(true);
    }
  );

  it("rejects a message that's too short", () => {
    const result = validateContactSubmission(baseInput({ message: "hi" }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("message");
  });

  it("rejects a message over the max length", () => {
    const result = validateContactSubmission(baseInput({ message: "a".repeat(5001) }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("message");
  });

  it("rejects a missing consent flag", () => {
    const result = validateContactSubmission(baseInput({ consent: false }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("consent");
  });

  it("rejects a submission faster than MIN_SUBMIT_MS after the form rendered", () => {
    const result = validateContactSubmission(baseInput({ ts: NOW - 500 }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("timing");
  });

  it("rejects a stale ts older than MAX_SUBMIT_AGE_MS", () => {
    const result = validateContactSubmission(baseInput({ ts: NOW - MAX_SUBMIT_AGE_MS - 1000 }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("timing");
  });

  it("does not require ts (no-JS form submissions never set it)", () => {
    const result = validateContactSubmission(baseInput({ ts: undefined }), NOW);
    expect(result.valid).toBe(true);
  });

  it("collects every failing field in one pass", () => {
    const result = validateContactSubmission(baseInput({ name: "", email: "bad", consent: false }), NOW);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toEqual(expect.arrayContaining(["name", "email", "consent"]));
      expect(result.errors).not.toContain("message");
    }
  });
});

describe("sanitizeHeaderValue", () => {
  it("strips CR/LF to prevent email header injection", () => {
    expect(sanitizeHeaderValue("Ana\r\nBcc: attacker@evil.example")).toBe("Ana Bcc: attacker@evil.example");
  });

  it("leaves ordinary text untouched", () => {
    expect(sanitizeHeaderValue("Ana García")).toBe("Ana García");
  });
});

describe("buildEmailPayload", () => {
  const data = {
    name: "Ana García",
    email: "ana@example.com",
    reason: "science_research" as const,
    message: "Línea uno\nLínea dos",
  };
  const opts = { toAddress: "contacto@victorcazorla.com", fromAddress: "web@victorcazorla.com" };

  it("includes the human-readable reason label in the subject and both bodies", () => {
    const payload = buildEmailPayload(data, opts);
    expect(payload.subject).toContain("Investigación Ciencia");
    expect(payload.text).toContain("Razón: Investigación Ciencia");
    expect(payload.html).toContain("Investigación Ciencia");
  });

  it("sets reply_to to the submitter's address so a reply reaches them directly", () => {
    const payload = buildEmailPayload(data, opts);
    expect(payload.reply_to).toBe("Ana García <ana@example.com>");
    expect(payload.to).toBe("contacto@victorcazorla.com");
    expect(payload.from).toBe("Formulario de contacto <web@victorcazorla.com>");
  });

  it("uses a bare address (no angle brackets) when there's no display name", () => {
    const payload = buildEmailPayload({ ...data, name: "" }, opts);
    expect(payload.reply_to).toBe("ana@example.com");
  });

  it("strips characters from the name that could break out of the \"Name <email>\" format", () => {
    const payload = buildEmailPayload({ ...data, name: 'Ana <evil@attacker.example>, "Bcc"' }, opts);
    expect(payload.reply_to).toBe("Ana evil@attacker.example Bcc <ana@example.com>");
    expect(payload.reply_to.match(/</g)?.length).toBe(1);
    expect(payload.reply_to.match(/>/g)?.length).toBe(1);
  });

  it("escapes HTML special characters in the message body", () => {
    const payload = buildEmailPayload({ ...data, message: "<script>alert(1)</script>" }, opts);
    expect(payload.html).not.toContain("<script>alert(1)</script>");
    expect(payload.html).toContain("&lt;script&gt;");
  });

  it("strips newlines injected into the name from the subject line", () => {
    const payload = buildEmailPayload({ ...data, name: "Ana\r\nSubject: hijacked" }, opts);
    expect(payload.subject).not.toContain("\n");
    expect(payload.subject).not.toContain("\r");
  });

  it("preserves newlines as visual breaks in the plain-text body", () => {
    const payload = buildEmailPayload(data, opts);
    expect(payload.text).toContain("Línea uno\nLínea dos");
  });
});

describe("rateLimitKey", () => {
  it("groups the same IP within the same hour into one key", () => {
    const t0 = Date.UTC(2026, 0, 1, 10, 5);
    const t1 = Date.UTC(2026, 0, 1, 10, 55);
    expect(rateLimitKey("1.2.3.4", t0)).toBe(rateLimitKey("1.2.3.4", t1));
  });

  it("assigns different keys to different hours", () => {
    const t0 = Date.UTC(2026, 0, 1, 10, 5);
    const t1 = Date.UTC(2026, 0, 1, 11, 5);
    expect(rateLimitKey("1.2.3.4", t0)).not.toBe(rateLimitKey("1.2.3.4", t1));
  });

  it("assigns different keys to different IPs in the same window", () => {
    const t0 = Date.UTC(2026, 0, 1, 10, 5);
    expect(rateLimitKey("1.2.3.4", t0)).not.toBe(rateLimitKey("5.6.7.8", t0));
  });
});

describe("emailRateLimitKey", () => {
  it("groups the same email within the same day into one key", () => {
    const t0 = Date.UTC(2026, 0, 1, 1, 0);
    const t1 = Date.UTC(2026, 0, 1, 23, 0);
    expect(emailRateLimitKey("ana@example.com", t0)).toBe(emailRateLimitKey("ana@example.com", t1));
  });

  it("is case-insensitive on the email address", () => {
    const t0 = Date.UTC(2026, 0, 1, 10, 0);
    expect(emailRateLimitKey("Ana@Example.com", t0)).toBe(emailRateLimitKey("ana@example.com", t0));
  });

  it("assigns different keys to different days", () => {
    const t0 = Date.UTC(2026, 0, 1, 10, 0);
    const t1 = Date.UTC(2026, 0, 2, 10, 0);
    expect(emailRateLimitKey("ana@example.com", t0)).not.toBe(emailRateLimitKey("ana@example.com", t1));
  });
});

describe("isDisposableEmail", () => {
  it("flags well-known disposable-email domains", () => {
    expect(isDisposableEmail("someone@mailinator.com")).toBe(true);
    expect(isDisposableEmail("someone@10minutemail.com")).toBe(true);
  });

  it("is case-insensitive on the domain", () => {
    expect(isDisposableEmail("someone@MAILINATOR.COM")).toBe(true);
  });

  it("does not flag a regular domain", () => {
    expect(isDisposableEmail("ana@example.com")).toBe(false);
    expect(isDisposableEmail("contacto@victorcazorla.com")).toBe(false);
  });
});

describe("countMessageUrls", () => {
  it("counts http(s) and www links", () => {
    expect(countMessageUrls("Visit http://a.example and https://b.example and www.c.example")).toBe(3);
  });

  it("returns 0 for a message with no links", () => {
    expect(countMessageUrls("Hola, quería consultar sobre una colaboración.")).toBe(0);
  });
});

describe("findSpamKeyword", () => {
  it("finds a known spam phrase, case-insensitively", () => {
    expect(findSpamKeyword("Check out our SEO Services for your site")).toBe("seo services");
  });

  it("returns null for ordinary text", () => {
    expect(findSpamKeyword("Hola, quería consultar sobre una colaboración.")).toBeNull();
  });
});

describe("checkForSpamContent", () => {
  it("flags a message with more than MAX_MESSAGE_URLS links", () => {
    const urls = Array.from({ length: MAX_MESSAGE_URLS + 1 }, (_, i) => `https://spam${i}.example`).join(" ");
    expect(checkForSpamContent(urls)).toEqual({ isSpam: true, reason: "too_many_urls" });
  });

  it("allows a message with exactly MAX_MESSAGE_URLS links", () => {
    const urls = Array.from({ length: MAX_MESSAGE_URLS }, (_, i) => `https://ok${i}.example`).join(" ");
    expect(checkForSpamContent(urls)).toEqual({ isSpam: false });
  });

  it("flags a message containing a spam keyword", () => {
    expect(checkForSpamContent("Guaranteed income working from home!")).toEqual({
      isSpam: true,
      reason: "spam_keyword",
    });
  });

  it("accepts an ordinary professional message", () => {
    expect(checkForSpamContent("Hola, quería consultar sobre una colaboración académica.")).toEqual({
      isSpam: false,
    });
  });
});

describe("buildConfirmationEmailPayload", () => {
  const data = {
    name: "Ana García",
    email: "ana@example.com",
    reason: "academic" as const,
    message: "Hola",
  };
  const opts = { fromAddress: "web@victorcazorla.com" };

  it("sends the confirmation to the submitter's address", () => {
    const payload = buildConfirmationEmailPayload(data, { ...opts, lang: "es" });
    expect(payload.to).toBe("ana@example.com");
  });

  it("uses the exact Spanish subject and body when lang is es", () => {
    const payload = buildConfirmationEmailPayload(data, { ...opts, lang: "es" });
    expect(payload.subject).toBe("Confirmación de recepción - Víctor Cazorla");
    expect(payload.text).toBe("Hemos recibido tu mensaje. Te responderé en la mayor brevedad posible.");
  });

  it.each(["en", "fr", "ca"] as const)("produces a non-empty localized subject and body for lang=%s", (lang) => {
    const payload = buildConfirmationEmailPayload(data, { ...opts, lang });
    expect(payload.subject.length).toBeGreaterThan(0);
    expect(payload.text.length).toBeGreaterThan(0);
    expect(payload.subject).not.toBe(buildConfirmationEmailPayload(data, { ...opts, lang: "es" }).subject);
  });

  it("falls back to Spanish for an unknown or missing lang", () => {
    const payload = buildConfirmationEmailPayload(data, { ...opts, lang: "de" });
    expect(payload.subject).toBe("Confirmación de recepción - Víctor Cazorla");
  });
});
