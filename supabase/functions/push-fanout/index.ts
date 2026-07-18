// Aşama 5C — push-fanout Edge Function (Deno).
// Akış: notifications INSERT → Supabase DB Webhook → bu fonksiyon → ilgili
// kullanıcının TÜM push_subscriptions kayıtlarına VAPID imzalı Web Push.
// Üçüncü parti servis YOK; anahtarlar kendi VAPID çiftimiz.
//
// KÜTÜPHANE SEÇİMİ: npm:web-push Node'un crypto/https API'lerine dayanır ve
// edge runtime'da kırılgandır (iyzico Deno-uyumsuzluk dersi). jsr:@negrel/webpush
// SAF WebCrypto (SubtleCrypto) ile RFC 8291/8292 uygular — Deno-native, pinli.
//
// GÜVENLİK: verify_jwt KAPALI (yeni sb_secret anahtarları JWT değil; platform
// JWT kapısı webhook'u kilitlerdi). Yerine PUSH_WEBHOOK_SECRET paylaşılan
// sırrı zorunlu — webhook config'indeki x-webhook-secret başlığıyla eşleşmeli.
// Sır tanımsızsa fonksiyon KAPALI davranır (fail-closed 500).

import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.3.0";

type NotificationRecord = {
  user_id?: string;
  title?: string;
  body?: string | null;
  link?: string | null;
};

type WebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: NotificationRecord;
};

function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (const v of bytes) s += String.fromCharCode(v);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// importVapidKeys'in beklediği JWK çifti (yapısal eşleşme — kütüphanenin tip
// adına bağlanmıyoruz, export yüzeyi değişse de kırılmasın).
type VapidJwkPair = { publicKey: JsonWebKey; privateKey: JsonWebKey };

// `npx web-push generate-vapid-keys` çıktısı (base64url public 65 bayt
// uncompressed P-256 nokta + private 32 bayt d) → WebCrypto JWK çifti.
function vapidBase64ToJwk(
  publicKey: string,
  privateKey: string,
): VapidJwkPair {
  const pub = b64urlToBytes(publicKey);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error(
      "VAPID_PUBLIC_KEY beklenen formatta değil (65 baytlık uncompressed P-256).",
    );
  }
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));
  return {
    publicKey: { kty: "EC", crv: "P-256", x, y },
    privateKey: { kty: "EC", crv: "P-256", x, y, d: privateKey },
  };
}

// FCM'in KESİN HTTP durum kodunu görebilmek için fetch sarmalanır: kütüphane
// başarıda Response'u dışarı vermez (yalnız response.ok kontrolü yapar; 2xx
// dışını zaten fırlatır). Yalnız web-push istekleri (Content-Encoding:
// aes128gcm) kaydedilir; durum, endpoint URL'siyle eşlenir (endpoint unique).
const pushStatusByEndpoint = new Map<string, number>();
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (
  input: Request | URL | string,
  init?: RequestInit,
) => {
  const resp = await originalFetch(input as Request, init);
  const isWebPush =
    new Headers(init?.headers).get("Content-Encoding") === "aes128gcm";
  if (isWebPush) {
    const url = input instanceof Request ? input.url : String(input);
    pushStatusByEndpoint.set(url, resp.status);
  }
  return resp;
}) as typeof fetch;

// ApplicationServer bir kez kurulur, istekler arasında yeniden kullanılır
// (VAPID key import maliyeti her push'ta ödenmesin).
let appServerPromise: Promise<webpush.ApplicationServer> | null = null;
function getAppServer(): Promise<webpush.ApplicationServer> {
  if (!appServerPromise) {
    appServerPromise = (async () => {
      const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
      const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
      const subject = Deno.env.get("VAPID_SUBJECT") ?? "";
      if (!publicKey || !privateKey || !subject) {
        throw new Error(
          "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT secret'ları eksik.",
        );
      }
      const vapidKeys = await webpush.importVapidKeys(
        vapidBase64ToJwk(publicKey, privateKey),
        { extractable: false },
      );
      return webpush.ApplicationServer.new({
        contactInformation: subject,
        vapidKeys,
      });
    })();
    // Başarısız kurulum bir sonraki istekte yeniden denensin.
    appServerPromise.catch(() => {
      appServerPromise = null;
    });
  }
  return appServerPromise;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[push-fanout] PUSH_WEBHOOK_SECRET tanımsız — fail-closed.");
    return new Response("Misconfigured", { status: 500 });
  }
  if (req.headers.get("x-webhook-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Yalnızca notifications INSERT ilgilendirir; gerisi sessizce 200 (webhook
  // 2xx dışında retry eder — alakasız event'te retry istemeyiz).
  const record = payload.record;
  if (
    payload.type !== "INSERT" ||
    payload.table !== "notifications" ||
    !record?.user_id
  ) {
    return Response.json({ skipped: true });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Savunma katmanı (Y5): satır oluşturulurken user_wants_notification zaten
  // uygulanıyor, ama işlemsel üreticiler (club_request) bunu geçmişte atlayabildiği
  // için fanout da BAĞIMSIZ olarak tercihi kontrol eder. "Sessiz (NONE)" ise PUSH
  // gönderilmez (uygulama içi bildirim satırı yine görünür). Tercih satırı yoksa
  // varsayılan MEMBER_CLUBS → push serbest. FAIL-CLOSED: tercih OKUNAMAZSA push YOK.
  const { data: pref, error: prefError } = await admin
    .from("notification_preferences")
    .select("scope")
    .eq("user_id", record.user_id)
    .maybeSingle();
  if (prefError) {
    console.error(
      "[push-fanout] tercih okunamadı, fail-closed (push yok):",
      prefError.message,
    );
    return new Response("Pref error", { status: 500 });
  }
  if (pref?.scope === "NONE") {
    console.log("[push-fanout] kullanıcı tercihi NONE — push atlanıyor.");
    return Response.json({ sent: 0, pruned: 0, failed: 0, skipped: "pref_none" });
  }

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", record.user_id);
  if (error) {
    console.error("[push-fanout] push_subscriptions okunamadı:", error.message);
    return new Response("DB error", { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return Response.json({ sent: 0, pruned: 0, failed: 0 });
  }

  const appServer = await getAppServer();
  // sw.js 'push' handler'ının beklediği payload: { title, body, link }
  const message = JSON.stringify({
    title: record.title ?? "",
    body: record.body ?? undefined,
    link: record.link ?? "/",
  });

  // Tek abonelik patlarsa diğerleri devam etsin (hatalar outcome'a çevrilir,
  // asla fırlatılmaz). details, webhook yanıtı olarak net._http_response'a da
  // düşer — FCM'in kesin durum kodu dashboard'a girmeden görülebilir.
  type SendOutcome = {
    endpoint_tail: string;
    outcome: "sent" | "pruned" | "failed";
    status: number; // push servisinin HTTP durumu (0 = ağ/istisna, yanıt yok)
    body?: string; // hata gövdesi (yalnız başarısızlıkta, kırpılmış)
  };
  const results = await Promise.all(
    subs.map(async (sub): Promise<SendOutcome> => {
      const tail = sub.endpoint.slice(-10);
      const subscriber = appServer.subscribe({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      });
      try {
        await subscriber.pushTextMessage(message, { ttl: 24 * 60 * 60 });
        const status = pushStatusByEndpoint.get(sub.endpoint) ?? 0;
        pushStatusByEndpoint.delete(sub.endpoint);
        console.log(
          `[push-fanout] gönderildi (status=${status}, endpoint=...${tail})`,
        );
        return { endpoint_tail: tail, outcome: "sent", status };
      } catch (err) {
        pushStatusByEndpoint.delete(sub.endpoint);
        // (PushMessageError instanceof yerine duck-typing: export yüzeyi
        // değişse de response.status okuması kırılmaz.)
        const resp = (err as { response?: Response }).response;
        const status = resp?.status ?? 0;
        const body = resp
          ? await resp.text().catch(() => "")
          : String(err instanceof Error ? err.message : err);
        // 404/410 (Gone) = abonelik ölmüş → satırı TEMİZLE.
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
          console.log(
            `[push-fanout] abonelik ölü, budandı (status=${status}, endpoint=...${tail})`,
          );
          return {
            endpoint_tail: tail,
            outcome: "pruned",
            status,
            body: body.slice(0, 200),
          };
        }
        console.error(
          `[push-fanout] gönderim hatası (status=${status}, endpoint=...${tail}):`,
          body.slice(0, 500),
        );
        return {
          endpoint_tail: tail,
          outcome: "failed",
          status,
          body: body.slice(0, 200),
        };
      }
    }),
  );

  const summary = { sent: 0, pruned: 0, failed: 0 };
  for (const r of results) summary[r.outcome]++;
  console.log("[push-fanout]", JSON.stringify({ ...summary, details: results }));
  return Response.json({ ...summary, details: results });
});
