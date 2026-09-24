
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

const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)],cfg=window.SOWKI,sb=supabase.createClient(cfg.url,cfg.key);
const WARSAW_TZ="Europe/Warsaw";

function warsawParts(value,withSeconds=false){
  const d=value instanceof Date?value:new Date(value);
  if(Number.isNaN(d.getTime()))return null;
  const opts={
    timeZone:WARSAW_TZ,
    year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",
    hourCycle:"h23"
  };
  if(withSeconds)opts.second="2-digit";
  const out={};
  new Intl.DateTimeFormat("en-CA",opts).formatToParts(d).forEach(p=>{
    if(p.type!=="literal")out[p.type]=p.value;
  });
  return out;
}

function isoToWarsawLocal(value){
  if(!value)return "";
  const p=warsawParts(value);
  if(!p)return String(value).slice(0,16);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function warsawLocalToISO(value){
  if(!value)return null;
  const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if(!m)return value;

  const targetWall=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],0);
  let guess=targetWall;

  for(let i=0;i<4;i++){
    const p=warsawParts(new Date(guess),true);
    if(!p)break;
    const shownAsUtc=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+(p.second||0));
    const delta=targetWall-shownAsUtc;
    guess+=delta;
    if(Math.abs(delta)<1000)break;
  }
  return new Date(guess).toISOString();
}

function formatWarsawDateTime(value){
  if(!value)return "";
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return "";
  return d.toLocaleString("pl-PL",{
    timeZone:WARSAW_TZ,
    day:"2-digit",month:"2-digit",year:"numeric",
    hour:"2-digit",minute:"2-digit"
  });
}
const esc=s=>(s??"").toString().replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));const date=d=>d?new Date(d+"T12:00:00").toLocaleDateString("pl-PL"):"";const empty=t=>`<div class="item muted">${t}</div>`;
qa("[data-go]").forEach(b=>b.onclick=()=>showPage(b.dataset.go));
async function sign(path){if(!path)return"";if(path.startsWith("http"))return path;const {data}=await sb.storage.from(cfg.bucket).createSignedUrl(path,3600);return data?.signedUrl||""}
function surveyEmbedUrl(url){
 if(!url)return "";
 try{const u=new URL(url);u.searchParams.set("embed","true");return u.toString()}catch{return url+(url.includes("?")?"&":"?")+"embed=true"}
}
async function load(){
 let r=await sb.from("monthly_notices").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false});q("#notices").innerHTML=r.data?.length?r.data.map(x=>`<div class="item"><div class="date">${date(x.event_date)}</div><h3>${esc(x.icon||"📌")} ${esc(x.title)}</h3><div class="muted">${richDisplay(x.content||"")}</div></div>`).join(""):empty("Brak nowych ogłoszeń.");
 r=await sb.from("events").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false}).limit(5);let a=[];for(const x of r.data||[]){let u=await sign(x.image_url);a.push(`<div class="item">${u?`<img src="${u}">`:""}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3><p>${richDisplay(x.content||"")}</p></div>`)}q("#events").innerHTML=a.join("")||empty("Brak wydarzeń.");
 r=await sb.from("announcements").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false});a=[];if(!r.error){for(const x of r.data||[]){let u=await sign(x.image_url);a.push(`<article class="item announcement">${u?`<img class="announcement-photo" src="${u}" data-menu-photo="${u}" alt="${esc(x.title||"Ogłoszenie")}" title="Dotknij, aby powiększyć">`:""}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3>${x.description?`<div class="muted">${richDisplay(x.description)}</div>`:""}</article>`)}q("#announcements").innerHTML=a.join("")||empty("Nie ma jeszcze ogłoszeń.")}else q("#announcements").innerHTML=empty("Sekcja ogłoszeń będzie dostępna po uruchomieniu jej w Supabase.");
 r=await sb.from("menus").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false});a=[];for(const x of r.data||[]){let u=await sign(x.image_url);a.push(`<div class="item"><div class="date">${date(x.date_from)} – ${date(x.date_to)}</div><h3>${esc(x.title||"Jadłospis")}</h3>${u?`<img class="menu-photo" src="${u}" data-menu-photo="${u}" alt="Jadłospis" title="Dotknij, aby powiększyć">`:`<p class="muted">Obraz niedostępny</p>`}</div>`)}q("#menus").innerHTML=a.join("")||empty("Brak jadłospisu.");
 qa("[data-menu-photo]").forEach(img=>img.onclick=()=>openMenuPreview(img.dataset.menuPhoto));
 r=await sb.from("surveys").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false});
 const now=new Date(), active=[], archive=[];
 for(const x of r.data||[]){const st=x.starts_at?new Date(x.starts_at):null,en=x.ends_at?new Date(x.ends_at):null;(en&&en<now?archive:(!st||st<=now?active:archive)).push(x)}
 const pending=active.filter(x=>localStorage.getItem(`sowki_survey_done_${x.id}`)!=="1");
 q("#surveys").innerHTML=pending.length?`<div class="survey-top-note"><b>📌 Wypełniłeś już którąś z poniższych ankiet?</b><br>Po wysłaniu odpowiedzi kliknij przy niej <b>„✅ Wypełniłem/am tę ankietę”</b>. Ankieta zostanie ukryta na tym urządzeniu, aby nie wypełnić jej ponownie.</div>`+pending.map(x=>{const embed=surveyEmbedUrl(x.form_url);return `<article class="item survey-card" data-survey-id="${x.id}"><div class="survey-done-box"><b>Jeśli wysłałeś już odpowiedź w tej ankiecie:</b><button type="button" class="survey-done-btn" data-survey-done="${x.id}">✅ Wypełniłem/am tę ankietę</button></div><h3>${esc(x.title)}</h3>${x.ends_at?`<div class="date">Ankieta do ${formatWarsawDateTime(x.ends_at)} (Warszawa)</div>`:""}<div class="survey-fallback">Ankieta powinna wyświetlić się poniżej. <a target="_blank" rel="noopener" href="${esc(x.form_url)}">Ankieta się nie wyświetla? Otwórz ją tutaj ↗</a></div><iframe class="survey-frame" src="${esc(embed)}" loading="lazy" allowfullscreen scrolling="no" title="${esc(x.title)}"></iframe></article>`}).join(""):`<div class="item survey-all-done"><h3>✅ Wypełniłeś już wszystkie ankiety, które dotychczas były dostępne.</h3><p class="muted">Gdy pojawi się nowa ankieta, zostanie tutaj automatycznie wyświetlona.</p></div>`;
 qa("[data-survey-done]").forEach(b=>b.onclick=()=>{localStorage.setItem(`sowki_survey_done_${b.dataset.surveyDone}`,"1");load()});
 q("#surveyArchive").innerHTML=archive.length?`<details class="archive"><summary>🗂️ Zakończone / pozostałe ankiety (${archive.length})</summary>${archive.map(x=>`<div class="item"><h3>${esc(x.title)}</h3>${x.ends_at?`<div class="date">Zakończona: ${formatWarsawDateTime(x.ends_at)} (Warszawa)</div>`:""}<a class="secondary" target="_blank" rel="noopener" href="${esc(x.form_url)}">Otwórz formularz ↗</a></div>`).join("")}</details>`:"";
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
const D={monthly_notices:{title:"Najważniejsze",fields:[["title","Tytuł","text"],["content","Opis","textarea"],["event_date","Data","date"],["published","Opublikuj od razu na stronie","checkbox"]]},events:{title:"Wydarzenia",fields:[["title","Tytuł","text"],["content","Treść","textarea"],["event_date","Data","date"],["file","Zdjęcie","file"],["published","Opublikuj od razu na stronie","checkbox"]]},menus:{title:"Jadłospis",fields:[["title","Tytuł","text"],["date_from","Od","date"],["date_to","Do","date"],["file","Zdjęcie","file"],["published","Opublikuj od razu na stronie","checkbox"]]},surveys:{title:"Ankiety",fields:[["title","Tytuł","text"],["form_url","Link do Microsoft Forms","url"],["starts_at","Początek (czas Warszawa)","datetime-local"],["ends_at","Koniec (czas Warszawa)","datetime-local"],["published","Opublikuj od razu na stronie","checkbox"]]},
announcements:{title:"Ogłoszenia",fields:[["title","Tytuł","text"],["description","Opis","textarea"],["event_date","Data","date"],["file","Zdjęcie ogłoszenia","file"],["published","Opublikuj od razu na stronie","checkbox"]]},
notifications:{title:"Powiadomienia",fields:[
["title","Tytuł","text"],
["body","Treść powiadomienia","textarea"],
["target_page","Wybierz gdzie ma przejść po kliknięciu w powiadomienie","select",[
["","Brak – nie przechodź do żadnej karty"],
["home","START"],
["announcementsPage","Ogłoszenia"],
["menu","Jadłospis"],
["calendar","Kalendarz"],
["surveysPage","Ankiety"],
["gallery","Galeria"],
["payments","Rozliczenia"]
]],
["published","Dodaj do centrum powiadomień","checkbox"]
]},
gallery_albums:{title:"Galeria",fields:[["title","Tytuł albumu","text"],["description","Opis","textarea"],["event_date","Data","date"],["download_url","Link OneDrive do pobrania","url"],["file","Zdjęcie okładkowe","file"],["published","Opublikuj od razu na stronie","checkbox"]]}};
function adminMeta(table,x){
  if(table==="menus"){
    const a=x.date_from?date(x.date_from):"";
    const b=x.date_to?date(x.date_to):"";
    return [a,b].filter(Boolean).join(" – ");
  }
  if(table==="surveys"){
    return x.ends_at ? "Do: "+formatWarsawDateTime(x.ends_at)+" (Warszawa)" : "";
  }
  if(table==="notifications"){
    return x.created_at ? new Date(x.created_at).toLocaleString("pl-PL") : "";
  }
  const d=x.event_date;
  return d?date(d):"";
}

async function nextSortOrder(table){
  // Nowy wpis ma pojawić się NA GÓRZE listy jako najnowszy.
  const {data,error}=await sb.from(table).select("sort_order").order("sort_order",{ascending:true}).limit(1);
  if(error)throw error;
  const n=Number(data?.[0]?.sort_order);
  return Number.isFinite(n)?n-10:10;
}

async function moveAdminItem(table,id,direction){
  const {data,error}=await sb.from(table).select("id,sort_order").order("sort_order",{ascending:true}).order("id",{ascending:false});
  if(error){alert("Nie udało się pobrać kolejności: "+error.message);return}
  const rows=data||[];
  const i=rows.findIndex(x=>String(x.id)===String(id));
  const j=direction==="up"?i-1:i+1;
  if(i<0||j<0||j>=rows.length)return;

  const a=rows[i], b=rows[j];
  const aOrder=Number.isFinite(Number(a.sort_order))?Number(a.sort_order):(i+1)*10;
  const bOrder=Number.isFinite(Number(b.sort_order))?Number(b.sort_order):(j+1)*10;

  const first=await sb.from(table).update({sort_order:bOrder}).eq("id",a.id);
  if(first.error){alert("Nie udało się zmienić kolejności: "+first.error.message);return}
  const second=await sb.from(table).update({sort_order:aOrder}).eq("id",b.id);
  if(second.error){alert("Nie udało się zmienić kolejności: "+second.error.message);return}

  await render(table);
  await load();
  if(table==="gallery_albums"&&!q("#galleryAlbums")?.hidden)loadGallery();
  if(table==="notifications")loadNotifications();
}

async function render(table,id){
  setActiveAdminTab(table);
  const d=D[table];
  const {data,error}=await sb.from(table).select("*").order("sort_order",{ascending:true}).order("id",{ascending:false});
  if(error){
    const extra=(error.message||"").includes("sort_order")
      ? `<div class="admin-order-warning"><b>⚠️ Brakuje obsługi sortowania w bazie.</b><br>Najpierw uruchom plik SQL dołączony do wersji v0.5.3.0.</div>`
      : "";
    q("#editor").innerHTML=extra+`<p class="err">${esc(error.message)}</p>`;
    return;
  }

  const rows=data||[];
  const e=id?rows.find(x=>String(x.id)===String(id)):null;

  q("#editor").dataset.table=table;
  q("#editor").innerHTML=`
    <div class="form">
      <h3>${e?"Edytuj":"Dodaj"}: ${d.title}</h3>
      <form id="f">
        ${d.fields.map(x=>field(x,e)).join("")}
        <input type="hidden" name="id" value="${e?.id||""}">
        <button class="primary">Zapisz</button>
      </form>
    </div>

    <section class="admin-content-manager">
      <div class="admin-content-head">
        <div>
          <h3>Opublikowane i zapisane treści</h3>
          <p>Użyj strzałek ↑ ↓, aby ustawić kolejność wyświetlania w aplikacji. Nie musisz już wpisywać numerów.</p>
        </div>
        <span class="admin-count">${rows.length} ${rows.length===1?"wpis":"wpisów"}</span>
      </div>

      <div class="admin-content-list">
        ${rows.length ? rows.map((x,i)=>{
          const meta=adminMeta(table,x);
          const isPublished=!!x.published;
          return `<article class="adminitem adminitem-order">
            <div class="admin-order-controls" aria-label="Zmień kolejność">
              <button type="button" class="order-btn" data-move="up" data-id="${x.id}" ${i===0?"disabled":""} title="Przesuń wyżej" aria-label="Przesuń wyżej">↑</button>
              <button type="button" class="order-btn" data-move="down" data-id="${x.id}" ${i===rows.length-1?"disabled":""} title="Przesuń niżej" aria-label="Przesuń niżej">↓</button>
            </div>
            <div class="adminitem-main">
              <div class="adminitem-title-row">
                <b>${esc(x.title||"#"+x.id)}</b>
                <span class="admin-status ${isPublished?"is-published":"is-hidden"}">${isPublished?"● Opublikowane":"○ Ukryte"}</span>
              </div>
              ${meta?`<div class="adminitem-meta">${esc(meta)}</div>`:""}
            </div>
            <div class="actions adminitem-actions">
              <button type="button" data-e="${x.id}" title="Edytuj" aria-label="Edytuj">✏️</button>
              <button type="button" data-d="${x.id}" class="danger-lite" title="Usuń" aria-label="Usuń">🗑️</button>
            </div>
          </article>`;
        }).join("") : `<div class="admin-empty">Nie ma jeszcze żadnych wpisów w tym dziale.</div>`}
      </div>
    </section>`;

  q("#f").onsubmit=save;
  bindRichEditors();

  qa("[data-e]").forEach(b=>b.onclick=()=>render(table,b.dataset.e));
  qa("[data-d]").forEach(b=>b.onclick=async()=>{
    if(confirm("Usunąć wpis?")){
      const del=await sb.from(table).delete().eq("id",b.dataset.d);
      if(del.error){alert(del.error.message);return}
      render(table);load();
      if(table==="notifications")loadNotifications();
    }
  });
  qa("[data-move]").forEach(b=>b.onclick=()=>moveAdminItem(table,b.dataset.id,b.dataset.move));
}
function field(f,e){
 let[n,l,t,opts]=f,v=e?.[n]??"";
 if(t==="textarea")return richEditor(n,l,v);
 if(t==="checkbox")return`<label class="check"><input type="checkbox" name="${n}" ${e?(v?"checked":""):"checked"}>${l}</label>`;
 if(t==="file")return`<label>${l}</label><input type="file" name="${n}" accept="image/*">`;
 if(t==="select")return`<label>${l}</label><select name="${n}" class="admin-select">${(opts||[]).map(([value,label])=>`<option value="${esc(value)}" ${String(v)===String(value)?"selected":""}>${esc(label)}</option>`).join("")}</select>`;
 if(t==="datetime-local"&&v)v=isoToWarsawLocal(v);
 return`<label>${l}</label><input type="${t}" name="${n}" value="${esc(v)}">`
}
async function save(ev){
  ev.preventDefault();
  const table=q("#editor").dataset.table,d=D[table],fd=new FormData(ev.target),id=fd.get("id"),o={};

  d.fields.forEach(x=>{
    let[n,,t]=x;
    if(t==="file")return;
    if(t==="checkbox")o[n]=fd.get(n)==="on";
    else{
      o[n]=fd.get(n)||null;
      if(t==="number"&&o[n])o[n]=+o[n];
    }
  });

  if(table==="surveys"){
    if(o.starts_at)o.starts_at=warsawLocalToISO(o.starts_at);
    if(o.ends_at)o.ends_at=warsawLocalToISO(o.ends_at);
  }

  const file=fd.get("file");
  if(file?.size){
    let folder=table==="events"?"events":table==="gallery_albums"?"gallery":table==="announcements"?"announcements":"menus",
        path=`${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`,
        u=await sb.storage.from(cfg.bucket).upload(path,file,{contentType:file.type});
    if(u.error){alert(u.error.message);return}
    o.image_url=path;
  }

  if(!id){
    try{o.sort_order=await nextSortOrder(table)}
    catch(e){alert("Nie udało się ustawić kolejności nowego wpisu: "+(e?.message||e));return}
  }

  let r=id
    ? await sb.from(table).update(o).eq("id",id)
    : await sb.from(table).insert(o).select().single();

  if(r.error){alert(r.error.message);return}

  if(table==="notifications"&&!id&&r.data){
    const sent=await sb.functions.invoke("send-push",{body:{notification_id:r.data.id}});
    if(sent.error)alert("Powiadomienie zapisano, ale wysyłka push zgłosiła błąd: "+sent.error.message);
    else alert(`Powiadomienie zapisane i wysłane. Urządzenia: ${sent.data?.sent??0}`);
  }

  render(table);
  load();
  if(table==="notifications")loadNotifications();
}
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
 const {data,error}=await sb.from("gallery_albums").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false});
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
const isIOSSafari=isIOS&&/safari/i.test(navigator.userAgent)&&!/(crios|fxios|edgios|opios|duckduckgo|fbav|fban|instagram)/i.test(navigator.userAgent);
const INSTALL_PROMPT_KEY="sowki_install_prompt_seen_v2";

function maybeShowInstall(){
  if(isStandalone()||localStorage.getItem(INSTALL_PROMPT_KEY))return;

  if(isIOS){
    q("#installAndroid").hidden=true;
    q("#installIos").hidden=false;
    const warning=q("#iosSafariWarning");
    if(warning)warning.hidden=isIOSSafari;
    installDlg.showModal();
    return;
  }

  if(deferredInstallPrompt)installDlg.showModal();
}

window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  setTimeout(maybeShowInstall,500);
});

window.addEventListener("appinstalled",()=>{
  localStorage.setItem(INSTALL_PROMPT_KEY,"1");
  deferredInstallPrompt=null;
  if(installDlg.open)installDlg.close();
});

installBtn.onclick=async()=>{
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  localStorage.setItem(INSTALL_PROMPT_KEY,"1");
  deferredInstallPrompt=null;
  installDlg.close();
};

installLater.onclick=()=>{
  localStorage.setItem(INSTALL_PROMPT_KEY,"1");
  installDlg.close();
};

const copyInstallUrl=q("#copyInstallUrl");
if(copyInstallUrl)copyInstallUrl.onclick=async()=>{
  const url="https://www.sowkitarczyn.pl/";
  try{
    await navigator.clipboard.writeText(url);
    const old=copyInstallUrl.textContent;
    copyInstallUrl.textContent="✅ Adres skopiowany";
    setTimeout(()=>copyInstallUrl.textContent=old,1800);
  }catch{
    prompt("Skopiuj ten adres i otwórz go w Safari:",url);
  }
};

if(isIOS)setTimeout(maybeShowInstall,900);

// v0.5.0.2 — Web Push + notification center; registration via register-push Edge Function
const VAPID_PUBLIC_KEY="BNy7_B7IKR3OSyGqMqbSyWjONg4zOTynJpt1H4YA2otklr_6ULOebeZFqShyzkHY2GlqKI-Pv9-wcrUdxNFxAMc";
function b64ToUint8Array(base64){const pad='='.repeat((4-base64.length%4)%4),b64=(base64+pad).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(b64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function getPushRegistration(){if(!('serviceWorker' in navigator))throw new Error('Ta przeglądarka nie obsługuje Service Worker.');return await navigator.serviceWorker.ready}
function setPushButtonState(state){
 const btn=q("#enablePush");
 if(!btn)return;

 btn.classList.remove("push-enabled","push-unavailable","push-checking");
 btn.disabled=false;
 btn.removeAttribute("aria-disabled");
 btn.title="";

 if(state==="enabled"){
   btn.textContent="✅ Powiadomienia są włączone";
   btn.classList.add("push-enabled");
   btn.disabled=true;
   btn.setAttribute("aria-disabled","true");
   return;
 }

 if(state==="unsupported"){
   btn.textContent="⚠️ Powiadomienia nieobsługiwane";
   btn.classList.add("push-unavailable");
   btn.disabled=true;
   btn.setAttribute("aria-disabled","true");
   return;
 }

 if(state==="install"){
   btn.textContent="📱 Zainstaluj aplikację, aby włączyć";
   btn.classList.add("push-unavailable");
   btn.title="Na iPhone powiadomienia działają w aplikacji dodanej do ekranu głównego.";
   return;
 }

 if(state==="checking"){
   btn.textContent="Sprawdzam powiadomienia…";
   btn.classList.add("push-checking");
   btn.disabled=true;
   btn.setAttribute("aria-disabled","true");
   return;
 }

 // default / denied / brak subskrypcji
 btn.textContent="🔔 Włącz powiadomienia";
}

async function refreshPushStatus(){
 const btn=q("#enablePush");
 if(!btn)return;

 if(!("Notification" in window)||!("PushManager" in window)){
   setPushButtonState("unsupported");
   return;
 }

 if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!isStandalone()){
   setPushButtonState("install");
   return;
 }

 setPushButtonState("checking");

 try{
   const reg=await getPushRegistration();
   const sub=await reg.pushManager.getSubscription();

   // Zielony stan pokazujemy dopiero gdy:
   // 1) system pozwala na powiadomienia
   // 2) istnieje aktywna subskrypcja PUSH
   if(Notification.permission==="granted"&&sub){
     setPushButtonState("enabled");
   }else{
     setPushButtonState("off");
   }
 }catch{
   setPushButtonState("off");
 }
}

async function enablePush(){
 if(!("Notification" in window)||!("PushManager" in window)){
   setPushButtonState("unsupported");
   return;
 }

 if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!isStandalone()){
   alert("Na iPhone powiadomienia działają po zainstalowaniu aplikacji Sówki na ekranie głównym. Otwórz stronę w Safari i dodaj ją do ekranu głównego.");
   setPushButtonState("install");
   return;
 }

 // Jeśli użytkownik wyłączył powiadomienia w ustawieniach telefonu,
 // przeglądarka nie może ponownie sama wyświetlić systemowej zgody.
 if(Notification.permission==="denied"){
   alert("Powiadomienia są wyłączone w ustawieniach telefonu. Włącz powiadomienia dla aplikacji Sówki w Ustawieniach telefonu, a następnie wróć do aplikacji.");
   setPushButtonState("off");
   return;
 }

 const perm=await Notification.requestPermission();
 if(perm!=="granted"){
   setPushButtonState("off");
   return;
 }

 try{
   const reg=await getPushRegistration();
   let sub=await reg.pushManager.getSubscription();

   if(!sub){
     sub=await reg.pushManager.subscribe({
       userVisibleOnly:true,
       applicationServerKey:b64ToUint8Array(VAPID_PUBLIC_KEY)
     });
   }

   const j=sub.toJSON();
   const {data:registerData,error:registerError}=await sb.functions.invoke("register-push",{body:{
     subscription:j,
     endpoint:j.endpoint,
     p256dh:j.keys?.p256dh||"",
     auth:j.keys?.auth||"",
     user_agent:navigator.userAgent
   }});

   if(registerError||registerData?.error){
     const msg=registerData?.error||registerError?.message||"Nieznany błąd rejestracji.";
     alert("Nie udało się włączyć powiadomień: "+msg);
     setPushButtonState("off");
     return;
   }

   await refreshPushStatus();
 }catch(e){
   alert("Nie udało się włączyć powiadomień. Spróbuj ponownie.");
   setPushButtonState("off");
 }
}

function notifReadSetKey(){return "sowki_notifications_read_ids_v1"}

function getReadNotificationIds(){
  try{
    const raw=JSON.parse(localStorage.getItem(notifReadSetKey())||"[]");
    return new Set(Array.isArray(raw)?raw.map(String):[]);
  }catch{
    return new Set();
  }
}

function saveReadNotificationIds(set){
  localStorage.setItem(notifReadSetKey(),JSON.stringify([...set]));
}

function markNotificationRead(id){
  if(id===null||id===undefined||id==="")return;
  const set=getReadNotificationIds();
  set.add(String(id));
  saveReadNotificationIds(set);
}

function isNotificationRead(id){
  return getReadNotificationIds().has(String(id));
}

function migrateOldNotificationReadState(data){
  const oldKey="sowki_notifications_last_read";
  const last=localStorage.getItem(oldKey);
  if(!last)return;

  const read=getReadNotificationIds();
  for(const x of data||[]){
    if(x.created_at&&x.created_at<=last)read.add(String(x.id));
  }
  saveReadNotificationIds(read);
  localStorage.removeItem(oldKey);
}

function updateNotificationBadge(data){
  const read=getReadNotificationIds();
  const unread=(data||[]).filter(x=>!read.has(String(x.id))).length;
  const badge=q("#notificationBadge");
  if(!badge)return;
  badge.textContent=unread>9?"9+":String(unread);
  badge.hidden=!unread;
}

function updateNotificationItemState(el,read){
  if(!el)return;
  el.classList.toggle("unread",!read);
  el.classList.toggle("read",read);

  const status=el.querySelector(".notification-read-status");
  if(status){
    status.classList.toggle("is-unread",!read);
    status.classList.toggle("is-read",read);
    status.innerHTML=read?"✓ Odczytane":"● Nieodczytane";
  }
}

async function loadNotifications(){
  const {data,error}=await sb.from("notifications")
    .select("*")
    .eq("published",true)
    .order("sort_order",{ascending:true})
    .order("id",{ascending:false})
    .limit(30);

  if(error){
    q("#notificationsList").innerHTML=empty("Nie udało się pobrać powiadomień.");
    return;
  }

  migrateOldNotificationReadState(data||[]);
  const read=getReadNotificationIds();

  q("#notificationsList").innerHTML=(data||[]).map(x=>{
    const wasRead=read.has(String(x.id));
    return `<article
      class="item notification-item ${wasRead?"read":"unread"}"
      data-notif-id="${esc(x.id)}"
      data-notif-target="${esc(x.target_page||"")}"
      tabindex="0"
      role="button"
      aria-label="${wasRead?"Odczytane":"Nieodczytane"} powiadomienie: ${esc(x.title)}">
        <div class="notification-topline">
          <div class="notification-meta">${new Date(x.created_at).toLocaleString("pl-PL")}</div>
          <span class="notification-read-status ${wasRead?"is-read":"is-unread"}">${wasRead?"✓ Odczytane":"● Nieodczytane"}</span>
        </div>
        <h3>${esc(x.title)}</h3>
        <div>${richDisplay(x.body||"")}</div>
        ${x.target_page?'<div class="notification-target">Dotknij, aby przejść do informacji →</div>':""}
      </article>`;
  }).join("")||empty("Nie wysłano jeszcze żadnych powiadomień.");

  updateNotificationBadge(data||[]);

  const openNotification=async el=>{
    const id=el.dataset.notifId;
    markNotificationRead(id);
    updateNotificationItemState(el,true);

    const currentData=data||[];
    updateNotificationBadge(currentData);

    const t=el.dataset.notifTarget;
    if(t&&q("#"+t))showPage(t);
  };

  qa(".notification-item[data-notif-id]").forEach(el=>{
    el.onclick=()=>openNotification(el);
    el.onkeydown=e=>{
      if(e.key==="Enter"||e.key===" "){
        e.preventDefault();
        openNotification(el);
      }
    };
  });
}

function consumePushNotificationOpen(){
  const url=new URL(location.href);
  const id=url.searchParams.get("sowki_notification");
  const target=url.searchParams.get("sowki_target")||"";

  if(id)markNotificationRead(id);

  // Jeżeli administrator wybrał kartę docelową,
  // po kliknięciu systemowego PUSH-a otwieramy ją od razu.
  if(target&&q("#"+target)){
    showPage(target);
  }else if(target==="home"){
    showPage("home");
  }

  if(id||target){
    url.searchParams.delete("sowki_notification");
    url.searchParams.delete("sowki_target");
    history.replaceState({},document.title,url.pathname+url.search+url.hash);
  }
}

consumePushNotificationOpen();

// Gdy aplikacja jest już otwarta w tle, Service Worker może przekazać
// kliknięcie PUSH-a bez przeładowywania całej aplikacji.
if("serviceWorker" in navigator){
  navigator.serviceWorker.addEventListener("message",e=>{
    const d=e.data||{};
    if(d.type!=="SOWKI_NOTIFICATION_CLICK")return;

    if(d.notificationId)markNotificationRead(d.notificationId);

    const target=String(d.targetPage||"");
    if(target&&q("#"+target)){
      showPage(target);
    }else if(target==="home"){
      showPage("home");
    }

    loadNotifications();
  });
}

q('#notificationsBell').onclick=()=>{showPage('notificationsPage');loadNotifications();refreshPushStatus()};
q('#enablePush').onclick=enablePush;

// Po powrocie z Ustawień telefonu sprawdzamy stan ponownie.
// Dzięki temu przycisk aktualizuje się bez odświeżania całej aplikacji.
window.addEventListener("focus",()=>refreshPushStatus());
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshPushStatus()});

setTimeout(()=>{loadNotifications();refreshPushStatus()},700);
