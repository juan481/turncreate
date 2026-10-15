import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getPlatformAnalytics } from "@/server/analytics";
import { requirePlatformAdmin } from "@/server/platform";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const requestedDays = Number(request.nextUrl.searchParams.get("days") ?? 14);
    const tenantsSnapshot = await firebaseAdmin().db.collection("tenants").select("name", "slug", "timezone").get();
    const tenants = tenantsSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: String(doc.data().name ?? ""),
      slug: String(doc.data().slug ?? ""),
      timezone: String(doc.data().timezone ?? "America/Argentina/Buenos_Aires"),
    }));
    const analytics = await getPlatformAnalytics({ tenants, days: requestedDays });
    return NextResponse.json(analytics, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
}
