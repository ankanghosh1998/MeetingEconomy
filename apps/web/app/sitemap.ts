import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://meetingeconomy.io";
  return ["/login", "/signup", "/privacy", "/terms"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date()
  }));
}
