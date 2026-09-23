import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashes a password to a different string", async () => {
    const hash = await hashPassword("mySecretPassword123");
    expect(hash).not.toBe("mySecretPassword123");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("mySecretPassword123");
    const result = await verifyPassword("mySecretPassword123", hash);
    expect(result).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("mySecretPassword123");
    const result = await verifyPassword("wrongPassword", hash);
    expect(result).toBe(false);
  });
});
