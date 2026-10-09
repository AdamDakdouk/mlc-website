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

    describe("TRUSTED_PROXY_HOPS", () => {
      const original = process.env.TRUSTED_PROXY_HOPS;
      afterEach(() => {
        if (original === undefined) delete process.env.TRUSTED_PROXY_HOPS;
        else process.env.TRUSTED_PROXY_HOPS = original;
      });

      it("ignores a client-supplied first entry when one trusted proxy is configured", () => {
        process.env.TRUSTED_PROXY_HOPS = "1";
        // 6.6.6.6 was sent by the client; 1.2.3.4 is what the proxy appended.
        expect(getClientIp(makeRequest("6.6.6.6, 1.2.3.4"))).toBe("1.2.3.4");
      });

      it("counts from the right for more than one proxy", () => {
        process.env.TRUSTED_PROXY_HOPS = "2";
        expect(getClientIp(makeRequest("6.6.6.6, 1.2.3.4, 10.0.0.1"))).toBe("1.2.3.4");
      });

      it("uses the first entry if there are fewer entries than hops", () => {
        process.env.TRUSTED_PROXY_HOPS = "3";
        expect(getClientIp(makeRequest("1.2.3.4"))).toBe("1.2.3.4");
      });

      it("keeps the first-entry behaviour for unset or invalid values", () => {
        delete process.env.TRUSTED_PROXY_HOPS;
        expect(getClientIp(makeRequest("6.6.6.6, 1.2.3.4"))).toBe("6.6.6.6");
        process.env.TRUSTED_PROXY_HOPS = "abc";
        expect(getClientIp(makeRequest("6.6.6.6, 1.2.3.4"))).toBe("6.6.6.6");
        process.env.TRUSTED_PROXY_HOPS = "0";
        expect(getClientIp(makeRequest("6.6.6.6, 1.2.3.4"))).toBe("6.6.6.6");
      });
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
