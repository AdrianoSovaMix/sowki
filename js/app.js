
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
qa("[data-go]").forEach(b=>b.onclick=()=>{qa(".page").forEach(x=>x.classList.remove("active"));q("#"+b.dataset.go).classList.add("active");scrollTo(0,0)});
async function sign(path){if(!path)return"";if(path.startsWith("http"))return path;const {data}=await sb.storage.from(cfg.bucket).createSignedUrl(path,3600);return data?.signedUrl||""}
async function load(){let r=await sb.from("monthly_notices").select("*").eq("published",true).order("sort_order");q("#notices").innerHTML=r.data?.length?r.data.map(x=>`<div class="item"><div class="date">${date(x.event_date)}</div><h3>${esc(x.icon||"📌")} ${esc(x.title)}</h3><div class="muted">${richDisplay(x.content||"")}</div></div>`).join(""):empty("Brak nowych ogłoszeń.");
r=await sb.from("events").select("*").eq("published",true).order("event_date",{ascending:false}).limit(5);let a=[];for(const x of r.data||[]){let u=await sign(x.image_url);a.push(`<div class="item">${u?`<img src="${u}">`:""}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3><p>${richDisplay(x.content||"")}</p></div>`)}q("#events").innerHTML=a.join("")||empty("Brak wydarzeń.");
r=await sb.from("menus").select("*").eq("published",true).order("date_from",{ascending:false});a=[];for(const x of r.data||[]){let u=await sign(x.image_url);a.push(`<div class="item"><div class="date">${date(x.date_from)} – ${date(x.date_to)}</div><h3>${esc(x.title||"Jadłospis")}</h3>${u?`<img class="menu-photo" src="${u}" data-menu-photo="${u}" alt="Jadłospis" title="Dotknij, aby powiększyć">`:`<p class="muted">Obraz niedostępny</p>`}</div>`)}q("#menus").innerHTML=a.join("")||empty("Brak jadłospisu.");
qa("[data-menu-photo]").forEach(img=>img.onclick=()=>openMenuPreview(img.dataset.menuPhoto));
r=await sb.from("surveys").select("*").eq("published",true).order("ends_at",{ascending:false});q("#surveys").innerHTML=r.data?.length?r.data.map(x=>`<div class="item"><h3>${esc(x.title)}</h3><p>${richDisplay(x.description||"")}</p><a class="primary" target="_blank" href="${esc(x.form_url)}">Wypełnij ankietę</a></div>`).join(""):empty("Brak ankiet.")}
q("#openPay").onclick=()=>{if(q("#pass").value==="SowkiGrupa3"){q("#gate").hidden=true;q("#pay").hidden=false}else q("#payErr").textContent="Nieprawidłowe hasło"};q("#pass").onkeydown=e=>{if(e.key==="Enter")q("#openPay").click()};
q("#admin").onclick=async()=>{await auth();q("#dlg").showModal()};q(".x").onclick=()=>q("#dlg").close();q("#loginBtn").onclick=async()=>{const {error}=await sb.auth.signInWithPassword({email:q("#email").value,password:q("#pwd").value});q("#loginErr").textContent=error?.message||"";if(!error)auth()};q("#logout").onclick=async()=>{await sb.auth.signOut();auth()};
async function auth(){const {data:{user}}=await sb.auth.getUser();q("#login").hidden=!!user;q("#panel").hidden=!user;if(user)render("monthly_notices")}
qa("[data-tab]").forEach(b=>b.onclick=()=>render(b.dataset.tab));
const D={monthly_notices:{title:"Najważniejsze",fields:[["title","Tytuł","text"],["content","Opis","textarea"],["icon","Emoji","text"],["event_date","Data","date"],["sort_order","Kolejność","number"],["published","Opublikowane","checkbox"]]},events:{title:"Wydarzenia",fields:[["title","Tytuł","text"],["content","Treść","textarea"],["event_date","Data","date"],["file","Zdjęcie","file"],["published","Opublikowane","checkbox"]]},menus:{title:"Jadłospis",fields:[["title","Tytuł","text"],["date_from","Od","date"],["date_to","Do","date"],["file","Zdjęcie","file"],["published","Opublikowane","checkbox"]]},surveys:{title:"Ankiety",fields:[["title","Tytuł","text"],["description","Opis","textarea"],["form_url","Link","url"],["ends_at","Koniec","datetime-local"],["published","Opublikowane","checkbox"]]},
gallery_albums:{title:"Galeria",fields:[["title","Tytuł albumu","text"],["description","Opis","textarea"],["event_date","Data","date"],["download_url","Link OneDrive do pobrania","url"],["file","Zdjęcie okładkowe","file"],["published","Opublikowane","checkbox"]]}};
async function render(table,id){const d=D[table],{data,error}=await sb.from(table).select("*").order("id",{ascending:false});if(error){q("#editor").innerHTML=`<p class="err">${esc(error.message)}</p>`;return}const e=id?data.find(x=>x.id==id):null;q("#editor").dataset.table=table;q("#editor").innerHTML=`<div class="form"><h3>${e?"Edytuj":"Dodaj"}: ${d.title}</h3><form id="f">${d.fields.map(x=>field(x,e)).join("")}<input type="hidden" name="id" value="${e?.id||""}"><button class="primary">Zapisz</button></form></div>${data.map(x=>`<div class="adminitem"><b>${esc(x.title||"#"+x.id)}</b><span class="actions"><button data-e="${x.id}">✏️</button> <button data-d="${x.id}">🗑️</button></span></div>`).join("")}`;q("#f").onsubmit=save;bindRichEditors();qa("[data-e]").forEach(b=>b.onclick=()=>render(table,b.dataset.e));qa("[data-d]").forEach(b=>b.onclick=async()=>{if(confirm("Usunąć wpis?")){await sb.from(table).delete().eq("id",b.dataset.d);render(table);load()}})}
function field(f,e){let[n,l,t]=f,v=e?.[n]??"";if(t==="textarea")return richEditor(n,l,v);if(t==="checkbox")return`<label class="check"><input type="checkbox" name="${n}" ${e?(v?"checked":""):"checked"}>${l}</label>`;if(t==="file")return`<label>${l}</label><input type="file" name="${n}" accept="image/*">`;if(t==="datetime-local"&&v)v=String(v).slice(0,16);return`<label>${l}</label><input type="${t}" name="${n}" value="${esc(v)}">`}
async function save(ev){ev.preventDefault();const table=q("#editor").dataset.table,d=D[table],fd=new FormData(ev.target),id=fd.get("id"),o={};d.fields.forEach(x=>{let[n,,t]=x;if(t==="file")return;if(t==="checkbox")o[n]=fd.get(n)==="on";else{o[n]=fd.get(n)||null;if(t==="number"&&o[n])o[n]=+o[n]}});const file=fd.get("file");if(file?.size){let folder=table==="events"?"events":table==="gallery_albums"?"gallery":"menus",path=`${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`,u=await sb.storage.from(cfg.bucket).upload(path,file,{contentType:file.type});if(u.error){alert(u.error.message);return}o.image_url=path}let r=id?await sb.from(table).update(o).eq("id",id):await sb.from(table).insert(o);if(r.error){alert(r.error.message);return}render(table);load()}
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

function showPage(id){qa(".page").forEach(x=>x.classList.remove("active"));q("#"+id).classList.add("active");scrollTo(0,0)}
q("#galleryOpen").onclick=()=>showPage("gallery");
q("#galleryBack").onclick=()=>showPage("more");
q("#galleryUnlock").onclick=()=>{if(q("#galleryPass").value==="SowkiGrupa3"){q("#galleryGate").hidden=true;q("#galleryAlbums").hidden=false;q("#galleryErr").textContent="";loadGallery()}else q("#galleryErr").textContent="Nieprawidłowe hasło"};
q("#galleryPass").onkeydown=e=>{if(e.key==="Enter")q("#galleryUnlock").click()};
async function loadGallery(){
 const {data,error}=await sb.from("gallery_albums").select("*").eq("published",true).order("event_date",{ascending:false});
 if(error){q("#galleryAlbums").innerHTML=`<div class="item err">${esc(error.message)}</div>`;return}
 let out=[];
 for(const x of data||[]){let u=await sign(x.image_url);out.push(`<article class="item">${u?`<img class="album-cover" src="${u}" alt="">`:""}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3><p>${richDisplay(x.description||"")}</p>${x.download_url?`<a class="primary album-download" target="_blank" rel="noopener" href="${esc(x.download_url)}">📥 Pobierz wszystkie zdjęcia</a>`:""}</article>`)}
 q("#galleryAlbums").innerHTML=out.join("")||empty("Nie ma jeszcze albumów.");
}
