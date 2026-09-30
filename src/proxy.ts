import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/app", "/platform"];
const FIREBASE_SESSION_COOKIE = "turncreate_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // La firma y revocaciÃ³n se validan en el layout de servidor. El proxy no
  // importa Firebase Admin: solo evita cargar rutas privadas sin una sesiÃ³n.
  if (isProtected && !request.cookies.get(FIREBASE_SESSION_COOKIE)?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
