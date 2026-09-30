import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/platform", "/onboarding", "/api/"],
    },
    sitemap: "https://turn.justcreate.com.ar/sitemap.xml",
  };
}
