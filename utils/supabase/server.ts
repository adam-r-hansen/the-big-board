// utils/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient as _createServerClient, type CookieOptions } from "@supabase/ssr";

export function createServerClient() {
  const store = cookies();
  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Next’s cookies() is mutable in Actions/Routes; throws in SSR — swallow to avoid crash
            // @ts-ignore
            store.set({ name, value, ...options });
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            // @ts-ignore
            store.set({ name, value: "", expires: new Date(0), ...options });
          } catch {}
        },
      },
    }
  );
}

// Keep default export for existing default imports
export default createServerClient;
