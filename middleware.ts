import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value, ...(options as object) });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...(options as object) });
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({
            name,
            value: "",
            ...(options as object),
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...(options as object),
            maxAge: 0,
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const protectedPrefixes = [
    "/dashboard",
    "/ai-executive",
    "/pessoas",
    "/imoveis",
    "/automoveis",
    "/seguros",
    "/documentos",
    "/financas",
    "/saude",
    "/agenda",
    "/tarefas",
    "/processos",
    "/timeline",
    "/relacionamentos",
  ];

  const isProtectedRoute = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  if (!session && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (session && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/ai-executive/:path*",
    "/pessoas/:path*",
    "/imoveis/:path*",
    "/automoveis/:path*",
    "/seguros/:path*",
    "/documentos/:path*",
    "/financas/:path*",
    "/saude/:path*",
    "/agenda/:path*",
    "/tarefas/:path*",
    "/processos/:path*",
    "/timeline/:path*",
    "/relacionamentos/:path*",
    "/login",
  ],
};
