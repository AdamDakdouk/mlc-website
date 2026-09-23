import { signToken, verifyToken } from "@/lib/jwt";

describe("jwt", () => {
  it("signs a payload and verifies it back", async () => {
    const token = await signToken({ sub: "admin@example.com", role: "admin" });
    expect(typeof token).toBe("string");

    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("admin@example.com");
    expect(payload?.role).toBe("admin");
  });

  it("returns null for a malformed token", async () => {
    const payload = await verifyToken("not-a-real-token");
    expect(payload).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    process.env.JWT_SECRET = "b".repeat(32);
    jest.resetModules();
    const { signToken: signWithOtherSecret } = require("@/lib/jwt");
    const token = await signWithOtherSecret({ sub: "x@example.com", role: "admin" });

    process.env.JWT_SECRET = "a".repeat(32);
    jest.resetModules();
    const { verifyToken: verifyWithOriginalSecret } = require("@/lib/jwt");
    const payload = await verifyWithOriginalSecret(token);
    expect(payload).toBeNull();
  });
});
