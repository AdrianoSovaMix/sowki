const C="sowki-v0538";const A=["./","index.html","css/style.css?v=0538","js/config.js","js/app.js?v=0538","manifest.webmanifest","icon-192.png","icon-512.png","favicon.png","icons/nav/announcements.svg","icons/nav/menu.svg","icons/nav/calendar.svg","icons/nav/home.svg?v=0515","icons/nav/surveys.svg","icons/nav/gallery.svg","icons/nav/payments.svg"];
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
      notificationId:String(notificationId||"")
    }
  }));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();

  let target=e.notification.data?.url||"./";
  const notificationId=e.notification.data?.notificationId||"";

  try{
    const u=new URL(target,self.location.origin);
    if(notificationId)u.searchParams.set("sowki_notification",notificationId);
    target=u.href;
  }catch{}

  e.waitUntil(
    clients.matchAll({type:"window",includeUncontrolled:true}).then(ws=>{
      for(const w of ws){
        if("focus" in w){
          w.navigate(target);
          return w.focus();
        }
      }
      return clients.openWindow?clients.openWindow(target):null;
    })
  );
});
