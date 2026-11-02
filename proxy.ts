import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE, type SessionRole } from "@/lib/auth/token";

// Optimistic, cookie-only route guard. It only redirects; real authorization
// happens in the Data Access Layer next to every data read and mutation.

const PROTECTED: { prefix: string; roles: SessionRole[] }[] = [
  { prefix: "/staff", roles: ["STAFF"] },
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/orders", roles: ["STUDENT"] },
  { prefix: "/profile", roles: ["STUDENT", "STAFF", "ADMIN"] },
  { prefix: "/notifications", roles: ["STUDENT"] },
];
const AUTH_PAGES = ["/login", "/register"];
const HOME_BY_ROLE: Record<SessionRole, string> = { STUDENT: "/", STAFF: "/staff", ADMIN: "/admin" };

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await decryptSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (AUTH_PAGES.includes(pathname) && session) {
    return NextResponse.redirect(new URL(HOME_BY_ROLE[session.role], req.nextUrl));
  }

  const rule = PROTECTED.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (rule && !session) {
    const login = new URL("/login", req.nextUrl);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  // Wrong role: let the page render its 403 so the user sees why.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
