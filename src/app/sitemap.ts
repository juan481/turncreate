import type { MetadataRoute } from "next";
import { firebaseAdmin } from "@/server/firebase/admin";

const SITE_URL = "https://turn.justcreate.com.ar";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/landing`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/registro`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Cada local con turnero público habilitado también se indexa -- si
  // Firestore no está disponible (por ejemplo, un build local sin
  // credenciales), el sitemap no se rompe, solo se queda con lo estático.
  try {
    const snapshot = await firebaseAdmin().db.collection("tenants").where("status", "==", "active").get();
    const tenantRoutes: MetadataRoute.Sitemap = snapshot.docs
      .map((doc) => doc.data().slug)
      .filter((slug): slug is string => typeof slug === "string")
      .map((slug) => ({ url: `${SITE_URL}/${slug}`, changeFrequency: "weekly" as const, priority: 0.7 }));
    return [...staticRoutes, ...tenantRoutes];
  } catch {
    return staticRoutes;
  }
}
