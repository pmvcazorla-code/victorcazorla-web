import { describe, expect, it } from "vitest";
import { validateContactFields, MESSAGE_MIN_LENGTH } from "../../public/scripts/lib/contact-form-validate.js";

function validFields(overrides = {}) {
  return {
    name: "Ana García",
    email: "ana@example.com",
    reason: "academic",
    message: "a".repeat(MESSAGE_MIN_LENGTH),
    consent: true,
    captchaToken: "valid-token",
    ...overrides,
  };
}

describe("validateContactFields", () => {
  it("returns no errors for a well-formed submission", () => {
    expect(validateContactFields(validFields())).toEqual([]);
  });

  it("flags an empty or whitespace-only name", () => {
    expect(validateContactFields(validFields({ name: "" }))).toContain("name");
    expect(validateContactFields(validFields({ name: "   " }))).toContain("name");
  });

  it("flags an invalid email address", () => {
    expect(validateContactFields(validFields({ email: "not-an-email" }))).toContain("email");
  });

  it("flags a missing reason", () => {
    expect(validateContactFields(validFields({ reason: "" }))).toContain("reason");
  });

  it("flags a message shorter than the minimum length", () => {
    expect(validateContactFields(validFields({ message: "short" }))).toContain("message");
  });

  it("flags a missing consent checkbox", () => {
    expect(validateContactFields(validFields({ consent: false }))).toContain("consent");
  });

  it("flags a missing captcha token", () => {
    expect(validateContactFields(validFields({ captchaToken: "" }))).toContain("captcha");
  });

  it("collects every failing field in one pass", () => {
    const errors = validateContactFields({
      name: "",
      email: "bad",
      reason: "",
      message: "hi",
      consent: false,
      captchaToken: "",
    });
    expect(errors).toEqual(["name", "email", "reason", "message", "consent", "captcha"]);
  });
});
