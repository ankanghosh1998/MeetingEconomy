import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/signup", "/privacy", "/terms"],
      disallow: ["/dashboard", "/meetings", "/settings", "/onboarding", "/oauth"]
    },
    sitemap: "https://meetingeconomy.io/sitemap.xml"
  };
}
