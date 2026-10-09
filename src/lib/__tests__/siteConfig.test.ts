import {
  DEFAULT_SITE_URL,
  getEmailFrom,
  getPublicOrigin,
  getSiteUrl,
} from "@/lib/siteConfig";

describe("siteConfig", () => {
  const saved = {
    SITE_URL: process.env.SITE_URL,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };

  beforeEach(() => {
    delete process.env.SITE_URL;
    delete process.env.EMAIL_FROM;
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe("getSiteUrl", () => {
    it("defaults to the school's domain", () => {
      expect(getSiteUrl()).toBe(DEFAULT_SITE_URL);
      expect(DEFAULT_SITE_URL).toBe("https://modernisticlearning.com");
    });

    it("uses SITE_URL and strips trailing slashes and whitespace", () => {
      process.env.SITE_URL = "  https://example.org//  ";
      expect(getSiteUrl()).toBe("https://example.org");
    });

    it("treats a blank SITE_URL as unset", () => {
      process.env.SITE_URL = "   ";
      expect(getSiteUrl()).toBe(DEFAULT_SITE_URL);
    });
  });

  describe("getPublicOrigin", () => {
    it("prefers SITE_URL over the request origin", () => {
      process.env.SITE_URL = "https://example.org/";
      expect(getPublicOrigin("http://localhost:10000")).toBe("https://example.org");
    });

    it("falls back to the request origin when SITE_URL is unset", () => {
      expect(getPublicOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    });
  });

  describe("getEmailFrom", () => {
    it("defaults to the school's info address", () => {
      expect(getEmailFrom()).toBe(
        '"Modernistic Learning Community" <info@modernisticlearning.com>',
      );
    });

    it("uses EMAIL_FROM when set", () => {
      process.env.EMAIL_FROM = ' "School" <hello@example.org> ';
      expect(getEmailFrom()).toBe('"School" <hello@example.org>');
    });
  });
});
