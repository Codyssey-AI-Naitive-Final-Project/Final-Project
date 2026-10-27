import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next") ?? "/";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
  const supabase = await createClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    console.error("Supabase OAuth code exchange failed", {
      message: error.message.replaceAll(code, "[redacted]"),
      status: error.status,
      hasPkceVerifierCookie: request.cookies.getAll().some(({ name }) => name.endsWith("-code-verifier")),
    });
  }

  return NextResponse.redirect(new URL("/?auth_error=google_login_failed", request.url));
}
