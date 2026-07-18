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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  // link uygulama içi yol ("/events/..") veya tam URL olabilir.
  const url = new URL(link, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        // Açık pencere varsa oraya git + odaklan; yoksa yeni pencere aç.
        for (const win of wins) {
          if ("focus" in win) {
            win.navigate(url);
            return win.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
