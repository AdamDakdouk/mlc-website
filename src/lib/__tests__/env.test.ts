describe("env", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("parses valid environment variables", () => {
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/mlc-dev";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD = "supersecret123";

    const { env } = require("@/lib/env");
    expect(env.MONGODB_URI).toBe("mongodb://127.0.0.1:27017/mlc-dev");
    expect(env.JWT_SECRET).toBe("a".repeat(32));
  });

  it("throws when a required variable is missing", () => {
    delete process.env.MONGODB_URI;
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD = "supersecret123";

    expect(() => require("@/lib/env")).toThrow();
  });

  it("throws when JWT_SECRET is too short", () => {
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/mlc-dev";
    process.env.JWT_SECRET = "too-short";
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD = "supersecret123";

    expect(() => require("@/lib/env")).toThrow();
  });
});
