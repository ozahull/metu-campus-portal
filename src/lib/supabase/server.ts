import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Sunucu (Server Component, Route Handler, Server Action) tarafında
 * kullanılacak Supabase istemcisi. Oturum, Next.js cookie store üzerinden
 * okunur ve yazılır.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` bir Server Component içinden çağrıldığında hata atabilir.
            // Oturum yenileme middleware tarafından yapıldığı sürece bu yok sayılabilir.
          }
        },
      },
    },
  );
}
