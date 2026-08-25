import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyCaptcha } from "../../functions/_lib/captcha";

describe("verifyCaptcha", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns success:false immediately for an empty token, without calling the API", async () => {
    const result = await verifyCaptcha("", { secret: "test-secret" });
    expect(result).toEqual({ success: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the token and secret as form-urlencoded to the siteverify endpoint", async () => {
    await verifyCaptcha("token-123", { secret: "test-secret", ip: "203.0.113.1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.hcaptcha.com/siteverify");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const params = new URLSearchParams(init.body);
    expect(params.get("secret")).toBe("test-secret");
    expect(params.get("response")).toBe("token-123");
    expect(params.get("remoteip")).toBe("203.0.113.1");
  });

  it("omits remoteip when no IP is provided", async () => {
    await verifyCaptcha("token-123", { secret: "test-secret" });
    const params = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(params.has("remoteip")).toBe(false);
  });

  it("returns success:true when hCaptcha approves the token", async () => {
    const result = await verifyCaptcha("token-123", { secret: "test-secret" });
    expect(result).toEqual({ success: true });
  });

  it("returns success:false when hCaptcha rejects the token", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), { status: 200 })
    );
    const result = await verifyCaptcha("bad-token", { secret: "test-secret" });
    expect(result).toEqual({ success: false });
  });

  it("returns success:false on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const result = await verifyCaptcha("token-123", { secret: "test-secret" });
    expect(result).toEqual({ success: false });
  });

  it("returns success:false when the fetch throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const result = await verifyCaptcha("token-123", { secret: "test-secret" });
    expect(result).toEqual({ success: false });
  });
});
