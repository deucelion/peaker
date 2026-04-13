import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * SSR/middleware ile uyumlu browser client.
 *
 * Kullanım standardı:
 * - Tablo okuma/yazma: `@/lib/supabase/server` + server action / RSC (RLS veya admin ile).
 * - Burada: oturum (`auth.*`), gerektiğinde Realtime; `.from()` ile doğrudan veri çekme ekleme.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * 2. DİNAMİK CLIENT OLUŞTURUCU (Sunucu Tarafı & Geriye Dönük Uyumluluk)
 * 'addPlayer' gibi Server Action'lar içinde 'createClient()' diyerek çağırabilirsin.
 */
export const createClient = () => {
  // Eğer sunucu tarafındaysak (Next.js Server Side), 
  // çerez yönetimi gerekebilir ancak action'lar için bu instance yeterlidir.
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Sunucuda session'ı bellekte tutmaya gerek yok
      autoRefreshToken: false,
    }
  });
};