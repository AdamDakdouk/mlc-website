import type { MetadataRoute } from "next";

// Placeholder domain — update once a real domain is chosen (see project notes
// on deferred hosting decisions).
const BASE_URL = "https://mlc.edu.lb";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
