import type { MetadataRoute } from "next";

// Placeholder domain — update once a real domain is chosen (see project notes
// on deferred hosting decisions).
const BASE_URL = "https://mlc.edu.lb";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/announcements",
    "/teachers",
    "/calendar",
    "/careers",
    "/achievements",
    "/meeting-requests",
    "/about",
    "/contact",
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));
}
