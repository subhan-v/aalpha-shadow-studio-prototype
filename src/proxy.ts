import { NextResponse, type NextRequest } from "next/server"

// Public demo: only the client app and member onboarding are reachable. Every Studio route
// (the internal admin) sends the visitor to the sample agency instead.
export function proxy(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEMO !== "1") return NextResponse.next()
  const p = req.nextUrl.pathname
  if (p.startsWith("/client/") || p.startsWith("/join/")) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = "/client/larkspur"
  url.search = ""
  return NextResponse.redirect(url)
}

export const config = { matcher: ["/((?!_next/|favicon|robots.txt|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"] }
