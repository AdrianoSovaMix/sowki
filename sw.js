const C="sowki-v0540";const A=["./","index.html","css/style.css?v=0540","js/config.js","js/app.js?v=0540","manifest.webmanifest","icon-192.png","icon-512.png","favicon.png","icons/nav/announcements.svg","icons/nav/menu.svg","icons/nav/calendar.svg","icons/nav/home.svg?v=0515","icons/nav/surveys.svg","icons/nav/gallery.svg","icons/nav/payments.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))));
self.addEventListener("fetch",e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));
self.addEventListener("push",e=>{
  let d={};
  try{d=e.data?e.data.json():{}}
  catch{d={body:e.data?.text()||""}}

  const tag=d.tag||"sowki-notification";
  const fromTag=String(tag).match(/^sowki-(\d+)$/);
  const notificationId=d.notification_id||d.notificationId||(fromTag?fromTag[1]:"");

  e.waitUntil(self.registration.showNotification(d.title||"Sówki",{
    body:d.body||"Nowa wiadomość dla rodziców.",
    icon:"icon-192.png",
    badge:"favicon.png",
    tag,
    data:{
      url:d.url||"./",
      notificationId:String(notificationId||""),
      targetPage:String(d.target_page||d.targetPage||"")
    }
  }));
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
