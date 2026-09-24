
function richSanitize(html){
 const t=document.createElement("template"); t.innerHTML=html||"";
 const allowed=new Set(["B","STRONG","I","EM","U","BR","P","DIV","UL","OL","LI","A","SPAN"]);
 [...t.content.querySelectorAll("*")].forEach(el=>{
   if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return}
   [...el.attributes].forEach(a=>{
     const n=a.name.toLowerCase();
     if(n==="href"&&el.tagName==="A"){
       const v=a.value.trim();
       if(!/^(https?:|mailto:)/i.test(v)) el.removeAttribute(a.name);
       else {el.setAttribute("target","_blank");el.setAttribute("rel","noopener")}
     } else if(n==="style"&&el.tagName==="SPAN"){
       const color=(a.value.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)||[])[1];
       [...el.attributes].forEach(x=>el.removeAttribute(x.name));
       if(color && /^(#[0-9a-f]{3,8}|rgb(a)?\([0-9,\s.%]+\)|[a-z]{3,20})$/i.test(color.trim()))
         el.style.color=color.trim();
     } else if(!(el.tagName==="A"&&["href","target","rel"].includes(n))) el.removeAttribute(a.name);
   });
 });
 return t.innerHTML;
}
function richDisplay(v){
 if(!v)return "";
 if(/<\/?(?:b|strong|i|em|u|br|p|div|ul|ol|li|a|span)\b/i.test(v)) return richSanitize(v);
 return esc(v).replace(/\n/g,"<br>");
}
function richEditor(name,label,value){
 const id="rich_"+name, safe=richDisplay(value||"");
 return `<label>${label}</label><div class="rich-wrap">
 <div class="rich-toolbar">
 <button type="button" data-cmd="bold" title="Pogrubienie"><b>B</b></button>
 <button type="button" data-cmd="italic" title="Kursywa"><i>I</i></button>
 <button type="button" data-cmd="underline" title="Podkreślenie"><u>U</u></button>
 <button type="button" data-cmd="insertUnorderedList" title="Lista punktowana">• Lista</button>
 <button type="button" data-cmd="insertOrderedList" title="Lista numerowana">1. Lista</button>
 <label class="colorpick" title="Kolor tekstu">🎨<input type="color" value="#d81b60"></label>
 <button type="button" data-link title="Dodaj link">🔗</button>
 <button type="button" data-clear title="Usuń formatowanie">Tx</button>
 </div>
 <div id="${id}" class="rich-editor" contenteditable="true">${safe}</div>
 <textarea name="${name}" class="rich-hidden" hidden></textarea></div>`;
}
function bindRichEditors(){
 qa(".rich-wrap").forEach(w=>{
   const ed=w.querySelector(".rich-editor"), hidden=w.querySelector(".rich-hidden");
   const sync=()=>hidden.value=richSanitize(ed.innerHTML);
   w.querySelectorAll("[data-cmd]").forEach(b=>b.onclick=()=>{ed.focus();document.execCommand(b.dataset.cmd,false,null);sync()});
   const cp=w.querySelector('input[type="color"]'); if(cp) cp.oninput=()=>{ed.focus();document.execCommand("foreColor",false,cp.value);sync()};
   const link=w.querySelector("[data-link]"); if(link) link.onclick=()=>{const u=prompt("Wklej adres linku (https://...)");if(u&&/^https?:\/\//i.test(u)){ed.focus();document.execCommand("createLink",false,u);sync()}};
   const clear=w.querySelector("[data-clear]"); if(clear) clear.onclick=()=>{ed.focus();document.execCommand("removeFormat",false,null);sync()};
   ed.addEventListener("input",sync); sync();
 });
}

const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)],cfg=window.SOWKI,sb=supabase.createClient(cfg.url,cfg.key);const esc=s=>(s??"").toString().replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));const date=d=>d?new Date(d+"T12:00:00").toLocaleDateString("pl-PL"):"";const empty=t=>`<div class="item muted">${t}</div>`;
qa("[data-go]").forEach(b=>b.onclick=()=>showPage(b.dataset.go));
async function sign(path){if(!path)return"";if(path.startsWith("http"))return path;const {data}=await sb.storage.from(cfg.bucket).createSignedUrl(path,3600);return data?.signedUrl||""}
function surveyEmbedUrl(url){
 if(!url)return "";
 try{const u=new URL(url);u.searchParams.set("embed","true");return u.toString()}catch{return url+(url.includes("?")?"&":"?")+"embed=true"}
}
async function load(){
 let r=await sb.from("monthly_notices").select("*").eq("published",true).order("sort_order");q("#notices").innerHTML=r.data?.length?r.data.map(x=>`<div class="item"><div class="date">${date(x.event_date)}</div><h3>${esc(x.icon||"📌")} ${esc(x.title)}</h3><div class="muted">${richDisplay(x.content||"")}</div></div>`).join(""):empty("Brak nowych ogłoszeń.");
 r=await sb.from("events").select("*").eq("published",true).order("event_date",{ascending:false}).limit(5);let a=[];for(const x of r.data||[]){let u=await sign(x.image_url);a.push(`<div class="item">${u?`<img src="${u}">`:""}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3><p>${richDisplay(x.content||"")}</p></div>`)}q("#events").innerHTML=a.join("")||empty("Brak wydarzeń.");
 r=await sb.from("announcements").select("*").eq("published",true).order("event_date",{ascending:false});a=[];if(!r.error){for(const x of r.data||[]){let u=await sign(x.image_url);a.push(`<article class="item announcement">${u?`<img class="announcement-photo" src="${u}" data-menu-photo="${u}" alt="${esc(x.title||"Ogłoszenie")}" title="Dotknij, aby powiększyć">`:""}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3>${x.description?`<div class="muted">${richDisplay(x.description)}</div>`:""}</article>`)}q("#announcements").innerHTML=a.join("")||empty("Nie ma jeszcze ogłoszeń.")}else q("#announcements").innerHTML=empty("Sekcja ogłoszeń będzie dostępna po uruchomieniu jej w Supabase.");
 r=await sb.from("menus").select("*").eq("published",true).order("date_from",{ascending:false});a=[];for(const x of r.data||[]){let u=await sign(x.image_url);a.push(`<div class="item"><div class="date">${date(x.date_from)} – ${date(x.date_to)}</div><h3>${esc(x.title||"Jadłospis")}</h3>${u?`<img class="menu-photo" src="${u}" data-menu-photo="${u}" alt="Jadłospis" title="Dotknij, aby powiększyć">`:`<p class="muted">Obraz niedostępny</p>`}</div>`)}q("#menus").innerHTML=a.join("")||empty("Brak jadłospisu.");
 qa("[data-menu-photo]").forEach(img=>img.onclick=()=>openMenuPreview(img.dataset.menuPhoto));
 r=await sb.from("surveys").select("*").eq("published",true).order("ends_at",{ascending:true});
 const now=new Date(), active=[], archive=[];
 for(const x of r.data||[]){const st=x.starts_at?new Date(x.starts_at):null,en=x.ends_at?new Date(x.ends_at):null;(en&&en<now?archive:(!st||st<=now?active:archive)).push(x)}
 const pending=active.filter(x=>localStorage.getItem(`sowki_survey_done_${x.id}`)!=="1");
 q("#surveys").innerHTML=pending.length?`<div class="survey-top-note"><b>📌 Wypełniłeś już którąś z poniższych ankiet?</b><br>Po wysłaniu odpowiedzi kliknij przy niej <b>„✅ Wypełniłem/am tę ankietę”</b>. Ankieta zostanie ukryta na tym urządzeniu, aby nie wypełnić jej ponownie.</div>`+pending.map(x=>{const embed=surveyEmbedUrl(x.form_url);return `<article class="item survey-card" data-survey-id="${x.id}"><div class="survey-done-box"><b>Jeśli wysłałeś już odpowiedź w tej ankiecie:</b><button type="button" class="survey-done-btn" data-survey-done="${x.id}">✅ Wypełniłem/am tę ankietę</button></div><h3>${esc(x.title)}</h3>${x.ends_at?`<div class="date">Ankieta do ${new Date(x.ends_at).toLocaleString("pl-PL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>`:""}<div class="survey-desc">${richDisplay(x.description||"")}</div><div class="survey-fallback">Ankieta powinna wyświetlić się poniżej. <a target="_blank" rel="noopener" href="${esc(x.form_url)}">Ankieta się nie wyświetla? Otwórz ją tutaj ↗</a></div><iframe class="survey-frame" src="${esc(embed)}" loading="lazy" allowfullscreen scrolling="no" title="${esc(x.title)}"></iframe></article>`}).join(""):`<div class="item survey-all-done"><h3>✅ Wypełniłeś już wszystkie ankiety, które dotychczas były dostępne.</h3><p class="muted">Gdy pojawi się nowa ankieta, zostanie tutaj automatycznie wyświetlona.</p></div>`;
 qa("[data-survey-done]").forEach(b=>b.onclick=()=>{localStorage.setItem(`sowki_survey_done_${b.dataset.surveyDone}`,"1");load()});
 q("#surveyArchive").innerHTML=archive.length?`<details class="archive"><summary>🗂️ Zakończone / pozostałe ankiety (${archive.length})</summary>${archive.map(x=>`<div class="item"><h3>${esc(x.title)}</h3>${x.ends_at?`<div class="date">Zakończona: ${new Date(x.ends_at).toLocaleString("pl-PL")}</div>`:""}<a class="secondary" target="_blank" rel="noopener" href="${esc(x.form_url)}">Otwórz formularz ↗</a></div>`).join("")}</details>`:"";
}
q("#openPay").onclick=()=>{if(q("#pass").value==="SowkiGrupa3"){q("#gate").hidden=true;q("#pay").hidden=false}else q("#payErr").textContent="Nieprawidłowe hasło"};q("#pass").onkeydown=e=>{if(e.key==="Enter")q("#openPay").click()};
q("#admin").onclick=async()=>{await auth();q("#dlg").showModal()};q(".x").onclick=()=>q("#dlg").close();q("#loginBtn").onclick=async()=>{const {error}=await sb.auth.signInWithPassword({email:q("#email").value,password:q("#pwd").value});q("#loginErr").textContent=error?.message||"";if(!error)auth()};q("#logout").onclick=async()=>{await sb.auth.signOut();auth()};
async function auth(){const {data:{user}}=await sb.auth.getUser();q("#login").hidden=!!user;q("#panel").hidden=!user;if(user)render("monthly_notices")}
function setActiveAdminTab(table){
  qa(".tabs [data-tab]").forEach(b=>{
    const active=b.dataset.tab===table;
    b.classList.toggle("admin-tab-active",active);
    b.setAttribute("aria-selected",active?"true":"false");
    if(active)b.setAttribute("aria-current","page");
    else b.removeAttribute("aria-current");
  });
}
qa("[data-tab]").forEach(b=>b.onclick=()=>render(b.dataset.tab));
const D={monthly_notices:{title:"Najważniejsze",fields:[["title","Tytuł","text"],["content","Opis","textarea"],["icon","Emoji","text"],["event_date","Data","date"],["sort_order","Kolejność","number"],["published","Opublikowane","checkbox"]]},events:{title:"Wydarzenia",fields:[["title","Tytuł","text"],["content","Treść","textarea"],["event_date","Data","date"],["file","Zdjęcie","file"],["published","Opublikowane","checkbox"]]},menus:{title:"Jadłospis",fields:[["title","Tytuł","text"],["date_from","Od","date"],["date_to","Do","date"],["file","Zdjęcie","file"],["published","Opublikowane","checkbox"]]},surveys:{title:"Ankiety",fields:[["title","Tytuł","text"],["description","Opis","textarea"],["form_url","Link do Microsoft Forms","url"],["starts_at","Początek","datetime-local"],["ends_at","Koniec","datetime-local"],["published","Opublikowane","checkbox"]]},
announcements:{title:"Ogłoszenia",fields:[["title","Tytuł","text"],["description","Opis","textarea"],["event_date","Data","date"],["file","Zdjęcie ogłoszenia","file"],["published","Opublikowane","checkbox"]]},
notifications:{title:"Powiadomienia",fields:[["title","Tytuł","text"],["body","Treść powiadomienia","textarea"],["target_page","Po kliknięciu przejdź do (np. announcementsPage, surveysPage, calendar)","text"],["published","Widoczne w centrum powiadomień","checkbox"]]},
gallery_albums:{title:"Galeria",fields:[["title","Tytuł albumu","text"],["description","Opis","textarea"],["event_date","Data","date"],["download_url","Link OneDrive do pobrania","url"],["file","Zdjęcie okładkowe","file"],["published","Opublikowane","checkbox"]]}};
async function render(table,id){setActiveAdminTab(table);const d=D[table],{data,error}=await sb.from(table).select("*").order("id",{ascending:false});if(error){q("#editor").innerHTML=`<p class="err">${esc(error.message)}</p>`;return}const e=id?data.find(x=>x.id==id):null;q("#editor").dataset.table=table;q("#editor").innerHTML=`<div class="form"><h3>${e?"Edytuj":"Dodaj"}: ${d.title}</h3><form id="f">${d.fields.map(x=>field(x,e)).join("")}<input type="hidden" name="id" value="${e?.id||""}"><button class="primary">Zapisz</button></form></div>${data.map(x=>`<div class="adminitem"><b>${esc(x.title||"#"+x.id)}</b><span class="actions"><button data-e="${x.id}">✏️</button> <button data-d="${x.id}">🗑️</button></span></div>`).join("")}`;q("#f").onsubmit=save;bindRichEditors();qa("[data-e]").forEach(b=>b.onclick=()=>render(table,b.dataset.e));qa("[data-d]").forEach(b=>b.onclick=async()=>{if(confirm("Usunąć wpis?")){await sb.from(table).delete().eq("id",b.dataset.d);render(table);load()}})}
function field(f,e){let[n,l,t]=f,v=e?.[n]??"";if(t==="textarea")return richEditor(n,l,v);if(t==="checkbox")return`<label class="check"><input type="checkbox" name="${n}" ${e?(v?"checked":""):"checked"}>${l}</label>`;if(t==="file")return`<label>${l}</label><input type="file" name="${n}" accept="image/*">`;if(t==="datetime-local"&&v)v=String(v).slice(0,16);return`<label>${l}</label><input type="${t}" name="${n}" value="${esc(v)}">`}
async function save(ev){ev.preventDefault();const table=q("#editor").dataset.table,d=D[table],fd=new FormData(ev.target),id=fd.get("id"),o={};d.fields.forEach(x=>{let[n,,t]=x;if(t==="file")return;if(t==="checkbox")o[n]=fd.get(n)==="on";else{o[n]=fd.get(n)||null;if(t==="number"&&o[n])o[n]=+o[n]}});const file=fd.get("file");if(file?.size){let folder=table==="events"?"events":table==="gallery_albums"?"gallery":table==="announcements"?"announcements":"menus",path=`${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`,u=await sb.storage.from(cfg.bucket).upload(path,file,{contentType:file.type});if(u.error){alert(u.error.message);return}o.image_url=path}let r=id?await sb.from(table).update(o).eq("id",id):await sb.from(table).insert(o).select().single();if(r.error){alert(r.error.message);return}if(table==="notifications"&&!id&&r.data){const sent=await sb.functions.invoke("send-push",{body:{notification_id:r.data.id}});if(sent.error)alert("Powiadomienie zapisano, ale wysyłka push zgłosiła błąd: "+sent.error.message);else alert(`Powiadomienie zapisane i wysłane. Urządzenia: ${sent.data?.sent??0}`)}render(table);load();if(table==="notifications")loadNotifications(false)}
load();if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
function openMenuPreview(url){
  let d=q("#menuPreview");
  if(!d){
    d=document.createElement("dialog");
    d.id="menuPreview";
    d.className="photo-preview";
    d.innerHTML=`<button class="preview-close" aria-label="Zamknij">✕</button><div class="preview-stage"><img alt="Powiększony jadłospis"></div><div class="preview-hint">Przesuwaj obraz palcem • użyj gestu powiększania</div>`;
    document.body.appendChild(d);
    d.querySelector(".preview-close").onclick=()=>d.close();
    d.onclick=e=>{if(e.target===d)d.close()};
  }
  d.querySelector("img").src=url;
  d.showModal();
}

function setActiveNav(id){
 qa("nav [data-go]").forEach(b=>{
   const active=b.dataset.go===id;
   b.classList.toggle("nav-active",active);
   if(active)b.setAttribute("aria-current","page");
   else b.removeAttribute("aria-current");
 });
 const bell=q("#notificationsBell");
 if(bell)bell.classList.toggle("page-active",id==="notificationsPage");
}
function showPage(id){
 qa(".page").forEach(x=>x.classList.remove("active"));
 const page=q("#"+id);
 if(page)page.classList.add("active");
 setActiveNav(id);
 scrollTo(0,0);
}
setActiveNav(q(".page.active")?.id||"home");
q("#galleryUnlock").onclick=()=>{if(q("#galleryPass").value==="SowkiGrupa3"){q("#galleryGate").hidden=true;q("#galleryAlbums").hidden=false;q("#galleryErr").textContent="";loadGallery()}else q("#galleryErr").textContent="Nieprawidłowe hasło"};
q("#galleryPass").onkeydown=e=>{if(e.key==="Enter")q("#galleryUnlock").click()};
async function loadGallery(){
 const {data,error}=await sb.from("gallery_albums").select("*").eq("published",true).order("event_date",{ascending:false});
 if(error){q("#galleryAlbums").innerHTML=`<div class="item err">${esc(error.message)}</div>`;return}
 let out=[];
 for(const x of data||[]){let u=await sign(x.image_url);out.push(`<article class="item">${u?`<img class="album-cover" src="${u}" alt="">`:""}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3><p>${richDisplay(x.description||"")}</p>${x.download_url?`<a class="primary album-download" target="_blank" rel="noopener" href="${esc(x.download_url)}">📥 Pobierz wszystkie zdjęcia</a>`:""}</article>`)}
 q("#galleryAlbums").innerHTML=out.join("")||empty("Nie ma jeszcze albumów.");
}

// PWA installation helper
let deferredInstallPrompt=null;
const installDlg=q("#installDlg"), installBtn=q("#installPwa"), installLater=q("#installLater");
const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
function maybeShowInstall(){
  if(isStandalone()||localStorage.getItem("sowki_install_prompt_seen"))return;
  if(isIOS){q("#installAndroid").hidden=true;q("#installIos").hidden=false;installDlg.showModal();return;}
  if(deferredInstallPrompt)installDlg.showModal();
}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;setTimeout(maybeShowInstall,500)});
window.addEventListener("appinstalled",()=>{localStorage.setItem("sowki_install_prompt_seen","1");deferredInstallPrompt=null;if(installDlg.open)installDlg.close()});
installBtn.onclick=async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;localStorage.setItem("sowki_install_prompt_seen","1");deferredInstallPrompt=null;installDlg.close()};
installLater.onclick=()=>{localStorage.setItem("sowki_install_prompt_seen","1");installDlg.close()};
if(isIOS)setTimeout(maybeShowInstall,900);

// v0.5.0.2 — Web Push + notification center; registration via register-push Edge Function
const VAPID_PUBLIC_KEY="BNy7_B7IKR3OSyGqMqbSyWjONg4zOTynJpt1H4YA2otklr_6ULOebeZFqShyzkHY2GlqKI-Pv9-wcrUdxNFxAMc";
function b64ToUint8Array(base64){const pad='='.repeat((4-base64.length%4)%4),b64=(base64+pad).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(b64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function getPushRegistration(){if(!('serviceWorker' in navigator))throw new Error('Ta przeglądarka nie obsługuje Service Worker.');return await navigator.serviceWorker.ready}
async function enablePush(){
 if(!('Notification' in window)||!('PushManager' in window)){q('#pushStatus').innerHTML='<b>⚠️ Powiadomienia push nie są obsługiwane w tej przeglądarce.</b>';return}
 if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!isStandalone()){q('#pushStatus').innerHTML='<b>📱 iPhone / iPad:</b><p>Najpierw dodaj Sówki do ekranu początkowego w Safari, a potem uruchom zainstalowaną aplikację i włącz powiadomienia.</p>';return}
 const perm=await Notification.requestPermission(); if(perm!=='granted'){q('#pushStatus').innerHTML='<b>🔕 Powiadomienia nie zostały włączone.</b><p>Możesz zmienić zgodę później w ustawieniach przeglądarki/telefonu.</p>';return}
 const reg=await getPushRegistration();let sub=await reg.pushManager.getSubscription();
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8Array(VAPID_PUBLIC_KEY)});
 const j=sub.toJSON();
 const {data:registerData,error:registerError}=await sb.functions.invoke('register-push',{body:{
   subscription:j,
   endpoint:j.endpoint,
   p256dh:j.keys?.p256dh||'',
   auth:j.keys?.auth||'',
   user_agent:navigator.userAgent
 }});
 if(registerError||registerData?.error){
   const msg=registerData?.error||registerError?.message||'Nieznany błąd rejestracji.';
   q('#pushStatus').innerHTML='<b>⚠️ Nie udało się zapisać telefonu.</b><p>'+esc(msg)+'</p>';return
 }
 q('#pushStatus').innerHTML='<b>✅ Powiadomienia są włączone na tym urządzeniu.</b><p>Telefon został zapisany. Najważniejsze wiadomości z grupy mogą pojawiać się bezpośrednio na telefonie.</p>';
}
async function refreshPushStatus(){if(!q('#pushStatus'))return;if(!('Notification' in window)){q('#pushStatus').innerHTML='<b>⚠️ Ta przeglądarka nie obsługuje powiadomień push.</b>';return}if(Notification.permission==='granted')q('#pushStatus').innerHTML='<b>✅ Powiadomienia są dozwolone.</b>';else if(Notification.permission==='denied')q('#pushStatus').innerHTML='<b>🔕 Powiadomienia są zablokowane w ustawieniach urządzenia.</b>';else q('#pushStatus').innerHTML='<b>🔔 Powiadomienia nie są jeszcze włączone.</b><p>Kliknij „Włącz powiadomienia”, aby otrzymywać ważne informacje z grupy.</p>'}
function notifReadKey(){return 'sowki_notifications_last_read'}
async function loadNotifications(markRead=false){
 const {data,error}=await sb.from('notifications').select('*').eq('published',true).order('created_at',{ascending:false}).limit(30);if(error){q('#notificationsList').innerHTML=empty('Nie udało się pobrać powiadomień.');return}
 const last=localStorage.getItem(notifReadKey())||'';q('#notificationsList').innerHTML=(data||[]).map(x=>`<article class="item notification-item ${(!last||x.created_at>last)?'unread':''}" data-notif-target="${esc(x.target_page||'')}"><div class="notification-meta">${new Date(x.created_at).toLocaleString('pl-PL')}</div><h3>${esc(x.title)}</h3><div>${richDisplay(x.body||'')}</div>${x.target_page?'<div class="notification-target">Dotknij, aby przejść do informacji →</div>':''}</article>`).join('')||empty('Nie wysłano jeszcze żadnych powiadomień.');
 qa('[data-notif-target]').forEach(el=>el.onclick=()=>{const t=el.dataset.notifTarget;if(t&&q('#'+t))showPage(t)});
 const unread=(data||[]).filter(x=>!last||x.created_at>last).length;const badge=q('#notificationBadge');badge.textContent=unread>9?'9+':unread;badge.hidden=!unread;
 if(markRead){localStorage.setItem(notifReadKey(),new Date().toISOString());badge.hidden=true;qa('.notification-item').forEach(x=>x.classList.remove('unread'))}
}
q('#notificationsBell').onclick=()=>{showPage('notificationsPage');loadNotifications(true);refreshPushStatus()};q('#enablePush').onclick=enablePush;
setTimeout(()=>loadNotifications(false),700);
