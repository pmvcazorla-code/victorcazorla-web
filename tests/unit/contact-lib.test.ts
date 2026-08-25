import { describe, expect, it } from "vitest";
import {
  validateContactSubmission,
  sanitizeHeaderValue,
  buildEmailPayload,
  rateLimitKey,
  MIN_SUBMIT_MS,
  MAX_SUBMIT_AGE_MS,
  type ContactInput,
} from "../../functions/_lib/contact";

const NOW = 1_800_000_000_000;

function baseInput(overrides: Partial<ContactInput> = {}): ContactInput {
  return {
    name: "Ana García",
    email: "ana@example.com",
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
  const data = { name: "Ana García", email: "ana@example.com", message: "Línea uno\nLínea dos" };
  const opts = { toAddress: "contacto@victorcazorla.com", fromAddress: "web@victorcazorla.com" };

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
