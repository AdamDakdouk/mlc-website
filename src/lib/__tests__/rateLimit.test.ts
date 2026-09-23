import { checkRateLimit, resetRateLimit } from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimit("1.2.3.4");
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("1.2.3.4", { max: 5, windowMs: 900_000 });
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests once the limit is exceeded", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("1.2.3.4", { max: 5, windowMs: 900_000 });
    }
    const result = checkRateLimit("1.2.3.4", { max: 5, windowMs: 900_000 });
    expect(result.allowed).toBe(false);
  });

  it("tracks separate keys independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("1.2.3.4", { max: 5, windowMs: 900_000 });
    }
    const result = checkRateLimit("5.6.7.8", { max: 5, windowMs: 900_000 });
    expect(result.allowed).toBe(true);
  });

  it("resets after the window expires", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("1.2.3.4", { max: 5, windowMs: 10 });
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = checkRateLimit("1.2.3.4", { max: 5, windowMs: 10 });
        expect(result.allowed).toBe(true);
        resolve(undefined);
      }, 20);
    });
  });
});
