import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...(options as object) });
          } catch {
            // Server Components may not allow setting cookies directly.
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({
              name,
              value: "",
              ...(options as object),
              maxAge: 0,
            });
          } catch {
            // Server Components may not allow setting cookies directly.
          }
        },
      },
    }
  );
}
