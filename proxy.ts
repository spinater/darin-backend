import { NextResponse, type NextRequest } from "next/server";

// เช็คแค่ว่ามี cookie ไหม (UX) — สิทธิ์จริงเช็คที่ requireRole() ในทุกหน้า/action
export default function proxy(req: NextRequest) {
  if (req.cookies.has("darin_session")) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!login|_next|favicon.ico).*)"],
};
