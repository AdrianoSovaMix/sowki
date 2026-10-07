const C="sowki-v0804";const A=["./","index.html","css/style.css?v=0804","js/config.js?v=0804","js/app.js?v=0804","manifest.webmanifest","icon-192.png","icon-512.png","favicon.png","owl-ui.svg","icons/nav/announcements.svg","icons/nav/menu.svg","icons/nav/calendar.svg","icons/nav/home.svg?v=0515","icons/nav/surveys.svg","icons/nav/gallery.svg","icons/nav/payments.svg"];
self.addEventListener("install",e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(C);
    await c.addAll(A);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(x=>x!==C).map(x=>caches.delete(x)));
    await clients.claim();
  })());
});
self.addEventListener("fetch",e=>{
  const req=e.request;

  // Bardzo ważne: Service Worker nie może przechwytywać POST/PUT/DELETE
  // ani zapytań do Supabase (Storage/Auth/RPC/Edge Functions).
  // W przeciwnym razie iOS potrafi zwrócić:
  // "FetchEvent.respondWith received an error: Returned response is null."
  if(req.method!=="GET")return;

  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  e.respondWith((async()=>{
    try{
      return await fetch(req);
    }catch{
      const cached=await caches.match(req);
      if(cached)return cached;

      // Przy nawigacji offline możemy wrócić do głównej aplikacji.
      if(req.mode==="navigate"){
        const fallback=
          await caches.match("./") ||
          await caches.match("index.html");
        if(fallback)return fallback;
      }

      // respondWith MUSI dostać Response, nigdy null/undefined.
      return new Response("Offline",{
        status:503,
        statusText:"Offline",
        headers:{"Content-Type":"text/plain; charset=utf-8"}
      });
    }
  })());
});
function pushPlainText(v){
  return String(v||"")
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<li\b[^>]*>/gi,"• ")
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi,"\n")
    .replace(/<[^>]+>/g,"")
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'")
    .replace(/\r\n?/g,"\n")
    .replace(/[ \t]+\n/g,"\n")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

self.addEventListener("push",e=>{
  let d={};
  try{d=e.data?e.data.json():{}}
  catch{d={body:e.data?.text()||""}}

  const tag=d.tag||"sowki-notification";
  const fromTag=String(tag).match(/^sowki-(\d+)$/);
  const notificationId=d.notification_id||d.notificationId||(fromTag?fromTag[1]:"");

  e.waitUntil((async()=>{
    await self.registration.showNotification(pushPlainText(d.title)||"Sówki",{
      body:pushPlainText(d.body)||"Nowa wiadomość dla rodziców.",
      icon:"icon-192.png",
      badge:"favicon.png",
      tag,
      data:{
        url:d.url||"./",
        notificationId:String(notificationId||""),
        targetPage:String(d.target_page||d.targetPage||"")
      }
    });

    // Przy odebraniu PUSH-a ustawiamy co najmniej badge "1".
    // Dokładną liczbę nieodczytanych aplikacja przeliczy po uruchomieniu.
    try{
      if("setAppBadge" in self.registration){
        await self.registration.setAppBadge();
      }
    }catch{}
  })());
});

self.addEventListener("notificationclick",e=>{
  e.notification.close();

  let target=e.notification.data?.url||"./";
  const notificationId=String(e.notification.data?.notificationId||"");
  const targetPage=String(e.notification.data?.targetPage||"");

  try{
    const u=new URL(target,self.location.origin);
    if(notificationId&&!u.searchParams.has("sowki_notification")){
      u.searchParams.set("sowki_notification",notificationId);
    }
    if(targetPage&&!u.searchParams.has("sowki_target")){
      u.searchParams.set("sowki_target",targetPage);
    }
    target=u.href;
  }catch{}

  e.waitUntil((async()=>{
    const ws=await clients.matchAll({type:"window",includeUncontrolled:true});

    if(ws.length){
      const w=ws[0];

      // Najpewniejsza ścieżka dla zainstalowanej PWA:
      // przekazujemy stronę docelową bezpośrednio do otwartej aplikacji.
      try{
        w.postMessage({
          type:"SOWKI_NOTIFICATION_CLICK",
          notificationId,
          targetPage
        });
      }catch{}

      // Jednocześnie aktualizujemy URL jako fallback.
      try{await w.navigate(target)}catch{}
      return w.focus();
    }

    return clients.openWindow?clients.openWindow(target):null;
  })());
});
