import { NextRequest } from "next/server";
import { resetRateLimit } from "@/lib/rateLimit";
import {
  getClientIp,
  isHoneypotTripped,
  rateLimitPublicSubmission,
} from "@/lib/publicFormGuard";

function makeRequest(ip?: string) {
  return new NextRequest("http://localhost/api/x", {
    method: "POST",
    headers: ip ? { "x-forwarded-for": ip } : {},
  });
}

describe("publicFormGuard", () => {
  describe("getClientIp", () => {
    it("uses the first X-Forwarded-For entry", () => {
      expect(getClientIp(makeRequest("1.2.3.4, 10.0.0.1"))).toBe("1.2.3.4");
    });

    it("falls back to 'unknown' without the header", () => {
      expect(getClientIp(makeRequest())).toBe("unknown");
    });
  });

  describe("rateLimitPublicSubmission", () => {
    beforeEach(() => {
      resetRateLimit("guard-test:9.9.9.9");
      resetRateLimit("guard-test:8.8.8.8");
      resetRateLimit("other-form:9.9.9.9");
    });

    it("allows 10 submissions then returns a 429 response", async () => {
      for (let i = 0; i < 10; i++) {
        expect(rateLimitPublicSubmission(makeRequest("9.9.9.9"), "guard-test")).toBeNull();
      }
      const blocked = rateLimitPublicSubmission(makeRequest("9.9.9.9"), "guard-test");
      expect(blocked?.status).toBe(429);
      expect((await blocked!.json()).error).toMatch(/too many/i);
    });

    it("tracks IPs and form scopes independently", () => {
      for (let i = 0; i < 10; i++) {
        rateLimitPublicSubmission(makeRequest("9.9.9.9"), "guard-test");
      }
      expect(rateLimitPublicSubmission(makeRequest("8.8.8.8"), "guard-test")).toBeNull();
      expect(rateLimitPublicSubmission(makeRequest("9.9.9.9"), "other-form")).toBeNull();
    });
  });

  describe("isHoneypotTripped", () => {
    it("is true for any non-blank string", () => {
      expect(isHoneypotTripped("http://spam.example")).toBe(true);
      expect(isHoneypotTripped("x")).toBe(true);
    });

    it("is false for empty, whitespace, null and non-string values", () => {
      expect(isHoneypotTripped("")).toBe(false);
      expect(isHoneypotTripped("   ")).toBe(false);
      expect(isHoneypotTripped(null)).toBe(false);
      expect(isHoneypotTripped(undefined)).toBe(false);
      expect(isHoneypotTripped(File)).toBe(false);
    });
  });
});
