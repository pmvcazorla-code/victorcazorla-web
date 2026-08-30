import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  CONSENT_MAX_AGE_MS,
  parseConsent,
  serializeConsent,
} from "../../public/scripts/lib/consent-store.js";

const NOW = 1_700_000_000_000;

describe("serializeConsent", () => {
  it("produce un JSON con accepted, timestamp y version", () => {
    expect(JSON.parse(serializeConsent(true, NOW))).toEqual({
      accepted: true,
      timestamp: NOW,
      version: CONSENT_VERSION,
    });
    expect(JSON.parse(serializeConsent(false, NOW))).toEqual({
      accepted: false,
      timestamp: NOW,
      version: CONSENT_VERSION,
    });
  });

  it("normaliza cualquier valor no-true a false", () => {
    // @ts-expect-error probando entrada no booleana a propósito
    expect(JSON.parse(serializeConsent("yes", NOW)).accepted).toBe(false);
  });

  it("es reversible con parseConsent dentro de plazo", () => {
    expect(parseConsent(serializeConsent(true, NOW), NOW + 1000)).toEqual({
      accepted: true,
      timestamp: NOW,
      version: CONSENT_VERSION,
    });
  });
});

describe("parseConsent", () => {
  it("acepta un registro válido (aceptado y rechazado)", () => {
    const accepted = JSON.stringify({ accepted: true, timestamp: NOW, version: CONSENT_VERSION });
    const rejected = JSON.stringify({ accepted: false, timestamp: NOW, version: CONSENT_VERSION });
    expect(parseConsent(accepted, NOW)).toEqual({ accepted: true, timestamp: NOW, version: CONSENT_VERSION });
    expect(parseConsent(rejected, NOW)).toEqual({ accepted: false, timestamp: NOW, version: CONSENT_VERSION });
  });

  it("devuelve null si no hay dato o no es JSON", () => {
    expect(parseConsent(null as unknown as string, NOW)).toBeNull();
    expect(parseConsent("", NOW)).toBeNull();
    expect(parseConsent("no-json{", NOW)).toBeNull();
    expect(parseConsent("42", NOW)).toBeNull();
    expect(parseConsent("null", NOW)).toBeNull();
  });

  it("devuelve null si la versión no es la actual", () => {
    const old = JSON.stringify({ accepted: true, timestamp: NOW, version: CONSENT_VERSION + 1 });
    expect(parseConsent(old, NOW)).toBeNull();
  });

  it("devuelve null si ha caducado (> 365 días)", () => {
    const raw = JSON.stringify({ accepted: true, timestamp: NOW, version: CONSENT_VERSION });
    expect(parseConsent(raw, NOW + CONSENT_MAX_AGE_MS + 1)).toBeNull();
    // justo en el límite sigue siendo válido
    expect(parseConsent(raw, NOW + CONSENT_MAX_AGE_MS)).not.toBeNull();
  });

  it("devuelve null si el timestamp está en el futuro (reloj mal ajustado)", () => {
    const raw = JSON.stringify({ accepted: true, timestamp: NOW + 5000, version: CONSENT_VERSION });
    expect(parseConsent(raw, NOW)).toBeNull();
  });

  it("devuelve null si faltan campos o tienen tipo incorrecto", () => {
    expect(parseConsent(JSON.stringify({ timestamp: NOW, version: CONSENT_VERSION }), NOW)).toBeNull();
    expect(parseConsent(JSON.stringify({ accepted: "true", timestamp: NOW, version: CONSENT_VERSION }), NOW)).toBeNull();
    expect(parseConsent(JSON.stringify({ accepted: true, timestamp: "x", version: CONSENT_VERSION }), NOW)).toBeNull();
    expect(parseConsent(JSON.stringify({ accepted: true, timestamp: NOW }), NOW)).toBeNull();
  });
});
