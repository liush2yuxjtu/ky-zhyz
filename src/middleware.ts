import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SITE_HOST } from "@/lib/share";

/** 301 *.vercel.app → primary China/public host to avoid duplicate indexing. */
export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0]?.toLowerCase();
  if (!host || !host.endsWith(".vercel.app")) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = SITE_HOST;
  url.port = "";
  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: [
    /*
     * Skip Next internals and static asset filenames with extensions.
     * Still redirect HTML document routes (/, /robots.txt, /sitemap.xml).
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?)$).*)",
    "/robots.txt",
    "/sitemap.xml",
  ],
};
