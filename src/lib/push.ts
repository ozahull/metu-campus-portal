import { createClient } from "@/lib/supabase/client";

// Aşama 5B — Web Push abonelik yardımcıları. Yalnızca client bileşenlerden
// (kullanıcı aksiyonu içinde) çağrılır; SSR'da hiçbir fonksiyon çalıştırılmaz.
// DB yazımı push_subscribe RPC ile (SECURITY DEFINER — istemciye INSERT yok),
// silme kendi satırına RLS DELETE ile.

export type PushSubscribeResult =
  | "ok" // abonelik kuruldu + DB'ye yazıldı
  | "unsupported" // tarayıcı push desteklemiyor (veya iOS'ta PWA kurulu değil)
  | "denied" // kullanıcı bildirim iznini reddetti / engelli
  | "error"; // anahtar eksik, subscribe ya da DB hatası

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// VAPID public key (base64url) → applicationServerKey byte dizisi.
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// SwRegister sayfa açılışında kaydeder; yine de yoksa (ilk ziyaret yarışı)
// burada kaydetmeyi dener — toggle'ın çalışması kayıt sırasına bağlı kalmasın.
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<PushSubscribeResult> {
  if (!isPushSupported()) return "unsupported";

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY tanımlı değil.");
    return "error";
  }

  // İzin istemi kullanıcı aksiyonu (toggle tıklaması) içinde tetiklenir.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const reg = await getRegistration();
  if (!reg) return "error";

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      await sub.unsubscribe().catch(() => undefined);
      return "error";
    }

    const supabase = createClient();
    const { error } = await supabase.rpc("push_subscribe", {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
    });
    if (error) {
      console.error("[push] push_subscribe hatası:", error);
      // DB'ye yazılamayan abonelik cihazda kalmasın (sunucu onu tanımıyor).
      await sub.unsubscribe().catch(() => undefined);
      return "error";
    }
    return "ok";
  } catch (err) {
    console.error("[push] subscribe hatası:", err);
    return "error";
  }
}

// Kapatma yıkıcı değil: tarayıcı izni geri alınmaz, yalnızca abonelik iptal
// edilir + DB satırı silinir. Tekrar açmak tek tıklamadır.
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return true;
  const sub = await getPushSubscription();
  if (!sub) return true;

  const supabase = createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", sub.endpoint);
  if (error) {
    console.error("[push] abonelik satırı silinemedi:", error);
    return false;
  }
  return sub.unsubscribe().catch(() => false);
}
