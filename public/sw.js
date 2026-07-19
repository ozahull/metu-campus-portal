/* ODTÜ KKK Kampüs Portalı — service worker (Aşama 5A).
   Kapsam bilinçli olarak DAR: yalnızca Web Push alımı + bildirime tıklama.
   Offline/cache stratejisi YOK (uygulama canlı veriyle çalışır; bayat cache
   RLS'li içerikte yanıltıcı olur). */

self.addEventListener("install", () => {
  // Yeni SW sürümü beklemeden devreye girsin (push handler güncellemeleri).
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  // Payload JSON: { title, body, link } — push-fanout Edge Function üretir.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "ODTÜ KKK Kampüs Portalı";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || undefined,
      data: { link: payload.link || "/" },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }),
  );
});

/* GÜVENLİK (#4): openWindow'a yalnız kendi origin'imiz ya da izinli https
   host'ları (DB allow-list'iyle aynı küme) gider. Parse-sonrası origin
   kontrolü '//evil.com' ve '/\evil.com' hilelerini de yakalar (URL parser
   bunları protokol-göreli çözer → origin farkı burada görünür). İzin dışı
   hedef ana sayfaya düşer — tıklama saldırgan URL'yi asla açmaz. */
const ALLOWED_EXTERNAL_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "wa.me",
  "chat.whatsapp.com",
  "metu.edu.tr",
];

function safeTargetUrl(link) {
  let url;
  try {
    url = new URL(link, self.location.origin);
  } catch {
    return self.location.origin + "/";
  }
  if (url.origin === self.location.origin) return url.href;
  const host = url.hostname.toLowerCase();
  const allowed =
    url.protocol === "https:" &&
    (ALLOWED_EXTERNAL_HOSTS.includes(host) || host.endsWith(".metu.edu.tr"));
  return allowed ? url.href : self.location.origin + "/";
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  // link uygulama içi yol ("/events/..") veya izinli tam URL olabilir.
  const url = safeTargetUrl(link);
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        // Açık pencere varsa oraya git + odaklan; yoksa yeni pencere aç.
        // navigate() SW'nin kontrol etmediği pencerede reddedilebilir —
        // o durumda yeni pencereye düş (tıklama sessizce ölmesin).
        const win = wins.find((w) => "focus" in w && "navigate" in w);
        if (!win) return self.clients.openWindow(url);
        return win
          .navigate(url)
          .then(() => win.focus())
          .catch(() => self.clients.openWindow(url));
      }),
  );
});
