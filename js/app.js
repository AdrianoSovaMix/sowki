
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

// Kompaktowe dymki informacyjne przy nagłówkach sekcji.
function closeSectionInfo(exceptBtn=null){
  qa(".section-info-btn").forEach(btn=>{
    if(btn===exceptBtn)return;
    btn.setAttribute("aria-expanded","false");
    const id=btn.getAttribute("aria-controls");
    const pop=id?q("#"+id):null;
    if(pop)pop.hidden=true;
  });
}

qa(".section-info-btn").forEach(btn=>{
  btn.addEventListener("click",e=>{
    e.stopPropagation();
    const id=btn.getAttribute("aria-controls");
    const pop=id?q("#"+id):null;
    if(!pop)return;

    const willOpen=btn.getAttribute("aria-expanded")!=="true";
    closeSectionInfo(willOpen?btn:null);

    btn.setAttribute("aria-expanded",willOpen?"true":"false");
    pop.hidden=!willOpen;
  });
});

qa(".section-info-popover").forEach(pop=>{
  pop.addEventListener("click",e=>e.stopPropagation());
});

document.addEventListener("click",()=>closeSectionInfo());

document.addEventListener("keydown",e=>{
  if(e.key==="Escape")closeSectionInfo();
});

// =========================================================
// v0.5.5.7 — prosta skrzynka wiadomości do wychowawczyni
// =========================================================
const parentMessageDlg=q("#parentMessageDlg");
const parentMessageForm=q("#parentMessageForm");
const parentMessageStatus=q("#parentMessageStatus");

q("#parentMessageBtn").onclick=()=>{
  if(parentMessageStatus)parentMessageStatus.textContent="";
  parentMessageDlg.showModal();
};

q("#parentMessageClose").onclick=()=>parentMessageDlg.close();

parentMessageDlg.addEventListener("click",e=>{
  if(e.target===parentMessageDlg)parentMessageDlg.close();
});

parentMessageForm.addEventListener("submit",async e=>{
  e.preventDefault();

  const fd=new FormData(parentMessageForm);
  const website=String(fd.get("website")||"").trim();
  if(website)return;

  const payload={
    p_parent_name:String(fd.get("parent_name")||"").trim(),
    p_child_name:String(fd.get("child_name")||"").trim(),
    p_message:String(fd.get("message")||"").trim()
  };

  if(!payload.p_parent_name||!payload.p_child_name||!payload.p_message){
    parentMessageStatus.textContent="Uzupełnij wszystkie pola.";
    return;
  }

  const lastSent=Number(localStorage.getItem("sowki_parent_message_last_sent")||0);
  if(lastSent && Date.now()-lastSent<60000){
    parentMessageStatus.textContent="Wiadomość została już przed chwilą wysłana. Odczekaj chwilę przed kolejną.";
    return;
  }

  const btn=parentMessageForm.querySelector(".parent-message-send");
  btn.disabled=true;
  btn.textContent="Wysyłanie…";
  parentMessageStatus.textContent="Wysyłam wiadomość…";

  try{
    const {error}=await sb.rpc("submit_parent_message",payload);
    if(error)throw error;

    localStorage.setItem("sowki_parent_message_last_sent",String(Date.now()));
    parentMessageForm.reset();
    parentMessageStatus.textContent="✅ Wiadomość została wysłana.";
    setTimeout(()=>{if(parentMessageDlg.open)parentMessageDlg.close()},1400);
  }catch(err){
    console.error("PARENT MESSAGE ERROR:",err);
    parentMessageStatus.textContent="❌ Nie udało się wysłać wiadomości. Spróbuj ponownie.";
  }finally{
    btn.disabled=false;
    btn.textContent="✉️ Wyślij wiadomość";
  }
});

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
const SIGNED_URL_CACHE_KEY="sowki_signed_urls_v1";
const SIGNED_URL_TTL_SECONDS=21600; // 6 godzin
const SIGNED_URL_REUSE_MS=5.5*60*60*1000;

function readSignedUrlCache(){
  try{
    const v=JSON.parse(localStorage.getItem(SIGNED_URL_CACHE_KEY)||"{}");
    return v&&typeof v==="object"?v:{};
  }catch{
    return {};
  }
}

function writeSignedUrlCache(cache){
  try{
    const rows=Object.entries(cache||{})
      .filter(([,v])=>v?.url&&Number(v?.expires)>Date.now())
      .sort((a,b)=>Number(b[1].expires)-Number(a[1].expires))
      .slice(0,120);
    localStorage.setItem(SIGNED_URL_CACHE_KEY,JSON.stringify(Object.fromEntries(rows)));
  }catch{}
}

async function sign(path){
  if(!path)return "";
  if(path.startsWith("http"))return path;

  const cache=readSignedUrlCache();
  const cached=cache[path];

  if(cached?.url && Number(cached.expires)>Date.now()+60000){
    return cached.url;
  }

  const {data,error}=await sb.storage
    .from(cfg.bucket)
    .createSignedUrl(path,SIGNED_URL_TTL_SECONDS);

  if(error||!data?.signedUrl)return "";

  cache[path]={
    url:data.signedUrl,
    expires:Date.now()+SIGNED_URL_REUSE_MS
  };
  writeSignedUrlCache(cache);

  return data.signedUrl;
}

function storageImg(path,{className="",alt="",title="",preview=false}={}){
  if(!path)return "";

  const displayPath=ecoThumbPath(path);

  return `<img
    class="${esc(className)} storage-lazy-img"
    data-storage-path="${esc(displayPath)}"
    data-storage-full-path="${esc(path)}"
    ${preview?'data-storage-preview="1"':""}
    loading="lazy"
    decoding="async"
    alt="${esc(alt)}"
    ${title?`title="${esc(title)}"`:""}
  >`;
}

async function hydrateStorageImages(root){
  const el=typeof root==="string"?q(root):root;
  if(!el)return;

  const imgs=[...el.querySelectorAll('img[data-storage-path]:not([data-storage-loaded="1"])')];

  await Promise.all(imgs.map(async img=>{
    const displayPath=img.dataset.storagePath;
    if(!displayPath)return;

    const displayUrl=await sign(displayPath);
    if(!displayUrl)return;

    img.src=displayUrl;
    img.dataset.storageLoaded="1";

    if(img.dataset.storagePreview==="1"){
      img.onclick=async()=>{
        const fullPath=img.dataset.storageFullPath||displayPath;
        const fullUrl=await sign(fullPath);
        if(fullUrl)openMenuPreview(fullUrl);
      };
    }
  }));
}

function hydratePageImages(id){
  if(id==="home")hydrateStorageImages("#events");
  if(id==="announcementsPage")hydrateStorageImages("#announcements");

  if(id==="menu"){
    hydrateStorageImages(q("#menus .menu-current-section"));

    const history=q("#menus .menu-history");
    if(history&&!history.dataset.lazyBound){
      history.dataset.lazyBound="1";
      history.addEventListener("toggle",()=>{
        if(history.open)hydrateStorageImages(history);
      });
      if(history.open)hydrateStorageImages(history);
    }
  }

  if(id==="gallery"&&!q("#galleryAlbums")?.hidden){
    hydrateStorageImages("#galleryAlbums");
  }
}
function surveyEmbedUrl(url){
 if(!url)return "";
 try{const u=new URL(url);u.searchParams.set("embed","true");return u.toString()}catch{return url+(url.includes("?")?"&":"?")+"embed=true"}
}

// =========================================================
// v0.5.4.9 — czerwone kropki przy działach z nową treścią
// =========================================================
const newContentState={
  home:[],
  announcementsPage:[],
  menu:[],
  surveysPage:[],
  gallery:[]
};

const visitedSectionsThisSession=new Set();

function newContentSeenKey(page){
  return `sowki_new_content_seen_${page}_v1`;
}

function normalizeTokens(tokens){
  return [...new Set((tokens||[]).map(String).filter(Boolean))];
}

function readSeenTokens(page){
  try{
    const v=JSON.parse(localStorage.getItem(newContentSeenKey(page))||"null");
    return Array.isArray(v)?v.map(String):null;
  }catch{
    return null;
  }
}

function saveSeenTokens(page,tokens){
  localStorage.setItem(
    newContentSeenKey(page),
    JSON.stringify(normalizeTokens(tokens).slice(-150))
  );
}

function setNewContentTokens(page,tokens){
  const current=normalizeTokens(tokens);
  newContentState[page]=current;

  const existing=readSeenTokens(page);

  // Pierwsze uruchomienie funkcji: obecne wpisy są punktem startowym,
  // żeby nie oznaczyć całej starej zawartości jako "nowa".
  if(existing===null){
    saveSeenTokens(page,current);
  }else if(visitedSectionsThisSession.has(page)){
    // Jeśli użytkownik już wszedł do tej sekcji zanim dane się załadowały,
    // uznajemy aktualną zawartość za zobaczoną.
    saveSeenTokens(page,current);
  }

  updateNewContentDots();
}

function sectionHasNewContent(page){
  const current=newContentState[page]||[];
  const seen=new Set(readSeenTokens(page)||[]);
  return current.some(token=>!seen.has(String(token)));
}

function ensureNewContentDot(page){
  const btn=q(`nav [data-go="${page}"]`);
  if(!btn)return null;

  let dot=btn.querySelector(".nav-new-dot");
  if(!dot){
    dot=document.createElement("span");
    dot.className="nav-new-dot";
    dot.setAttribute("aria-hidden","true");
    dot.hidden=true;
    btn.appendChild(dot);
  }
  return dot;
}

function updateNewContentDots(){
  Object.keys(newContentState).forEach(page=>{
    const dot=ensureNewContentDot(page);
    if(dot)dot.hidden=!sectionHasNewContent(page);
  });
}

function markSectionContentSeen(page){
  if(!(page in newContentState))return;
  visitedSectionsThisSession.add(page);
  saveSeenTokens(page,newContentState[page]||[]);
  updateNewContentDots();
}

async function load(){
 let r=await sb.from("monthly_notices").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false});
 const homeNoticeRows=r.data||[];
 q("#notices").innerHTML=homeNoticeRows.length?homeNoticeRows.map(x=>`<div class="item"><div class="date">${date(x.event_date)}</div><h3>${esc(x.icon||"📌")} ${esc(x.title)}</h3><div class="muted">${richDisplay(x.content||"")}</div></div>`).join(""):empty("Brak nowych ogłoszeń.");

 r=await sb.from("events").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false}).limit(5);
 const homeEventRows=r.data||[];
 let a=[];
 for(const x of homeEventRows){
   a.push(`<div class="item">${storageImg(x.image_url,{className:"event-photo",alt:x.title||"Wydarzenie"})}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3><p>${richDisplay(x.content||"")}</p></div>`);
 }
 q("#events").innerHTML=a.join("")||empty("Brak wydarzeń.");
 setNewContentTokens("home",[
   ...homeNoticeRows.map(x=>`notice:${x.id}`),
   ...homeEventRows.map(x=>`event:${x.id}`)
 ]);
 r=await sb.from("announcements").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false});a=[];setNewContentTokens("announcementsPage",(r.data||[]).map(x=>`announcement:${x.id}`));if(!r.error){for(const x of r.data||[]){a.push(`<article class="item announcement">${storageImg(x.image_url,{className:"announcement-photo",alt:x.title||"Ogłoszenie",title:"Dotknij, aby powiększyć",preview:true})}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3>${x.description?`<div class="muted">${richDisplay(x.description)}</div>`:""}</article>`)}q("#announcements").innerHTML=a.join("")||empty("Nie ma jeszcze ogłoszeń.")}else q("#announcements").innerHTML=empty("Sekcja ogłoszeń będzie dostępna po uruchomieniu jej w Supabase.");
 r=await sb.from("menus").select("*").eq("published",true).order("date_from",{ascending:false}).order("id",{ascending:false});
 const menuRows=r.data||[];
 setNewContentTokens("menu",menuRows.map(x=>`menu:${x.id}`));

 const todayParts=new Intl.DateTimeFormat("en-CA",{
   timeZone:"Europe/Warsaw",
   year:"numeric",
   month:"2-digit",
   day:"2-digit"
 }).formatToParts(new Date());
 const todayMap=Object.fromEntries(todayParts.map(p=>[p.type,p.value]));
 const todayKey=`${todayMap.year}-${todayMap.month}-${todayMap.day}`;

 function menuDateKey(v){
   if(!v)return "";
   return String(v).slice(0,10);
 }

 function menuCard(x,extraClass=""){
   return `
     <div class="item menu-history-card ${extraClass}">
       <div class="date">${date(x.date_from)} – ${date(x.date_to)}</div>
       <h3>${esc(x.title||"Jadłospis")}</h3>
       ${x.image_url
         ? storageImg(x.image_url,{className:"menu-photo",alt:x.title||"Jadłospis",title:"Dotknij, aby powiększyć",preview:true})
         : `<p class="muted">Obraz niedostępny</p>`}
     </div>
   `;
 }

 const currentMenus=menuRows.filter(x=>{
   const from=menuDateKey(x.date_from);
   const to=menuDateKey(x.date_to);
   return from && to && from<=todayKey && todayKey<=to;
 });

 const pastMenus=menuRows
   .filter(x=>{
     const to=menuDateKey(x.date_to);
     return to && to<todayKey;
   })
   .sort((a,b)=>String(b.date_from||"").localeCompare(String(a.date_from||"")));


 const currentHtml=currentMenus.map(x=>menuCard(x,"menu-current-card")).join("");
 const historyHtml=pastMenus.map(x=>menuCard(x,"")).join("");

 q("#menus").innerHTML=`
   <section class="menu-current-section">
     <div class="menu-section-heading">
       <h2>🍽️ Aktualny jadłospis</h2>
     </div>
     ${currentHtml||`<div class="item menu-empty-current"><b>Brak aktualnego jadłospisu.</b><p class="muted">Gdy pojawi się jadłospis obejmujący bieżący okres, zostanie wyświetlony tutaj.</p></div>`}
   </section>


   ${historyHtml?`
     <details class="menu-history">
       <summary>🗂️ Historia jadłospisów (${pastMenus.length})</summary>
       <div class="menu-history-list">${historyHtml}</div>
     </details>
   `:""}
 `;

 r=await sb.from("surveys").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false});
 const now=new Date(), active=[], archive=[];
 for(const x of r.data||[]){const st=x.starts_at?new Date(x.starts_at):null,en=x.ends_at?new Date(x.ends_at):null;(en&&en<now?archive:(!st||st<=now?active:archive)).push(x)}
 const pending=active.filter(x=>localStorage.getItem(`sowki_survey_done_${x.id}`)!=="1");
 setNewContentTokens("surveysPage",pending.map(x=>`survey:${x.id}`));
 q("#surveys").innerHTML=pending.length?`<div class="survey-top-note">📌 <b>Ważne:</b> Po wysłaniu odpowiedzi w formularzu prosimy o kliknięcie przycisku <b>„✅ Wypełniłem/am tę ankietę”</b>. Dziękujemy!</div>`+pending.map(x=>{const embed=surveyEmbedUrl(x.form_url);return `<article class="item survey-card" data-survey-id="${x.id}"><div class="survey-done-box"><b>Jeśli wysłałeś już odpowiedź w tej ankiecie:</b><button type="button" class="survey-done-btn" data-survey-done="${x.id}">✅ Wypełniłem/am tę ankietę</button></div><h3>${esc(x.title)}</h3>${x.ends_at?`<div class="date">Ankieta do ${formatWarsawDateTime(x.ends_at)}</div>`:""}<div class="survey-fallback">Ankieta powinna wyświetlić się poniżej. <a target="_blank" rel="noopener" href="${esc(x.form_url)}">Ankieta się nie wyświetla? Otwórz ją tutaj ↗</a></div><iframe class="survey-frame" src="${esc(embed)}" loading="lazy" allowfullscreen scrolling="no" title="${esc(x.title)}"></iframe></article>`}).join(""):`<div class="item survey-all-done"><h3>✅ Wypełniłeś już wszystkie ankiety, które dotychczas były dostępne.</h3><p class="muted">Gdy pojawi się nowa ankieta, zostanie tutaj automatycznie wyświetlona.</p></div>`;
 qa("[data-survey-done]").forEach(b=>b.onclick=()=>{localStorage.setItem(`sowki_survey_done_${b.dataset.surveyDone}`,"1");load()});
 let archiveCards=[];
 for(const x of archive){
   archiveCards.push(`<div class="item survey-archive-item">
     <h3>${esc(x.title)}</h3>
     ${x.ends_at?`<div class="date">Zakończona: ${formatWarsawDateTime(x.ends_at)}</div>`:""}
     ${x.results_image_url
       ? `<button type="button" class="secondary survey-results-btn" data-survey-results-path="${esc(x.results_image_url)}" data-survey-title="${esc(x.title)}">📊 Pokaż wyniki</button>`
       : `<div class="survey-results-pending">Wyniki nie zostały jeszcze opublikowane.</div>`}
   </div>`);
 }
 q("#surveyArchive").innerHTML=archive.length
   ? `<details class="archive"><summary>🗂️ Zakończone / pozostałe ankiety (${archive.length})</summary>${archiveCards.join("")}</details>`
   : "";

 qa("[data-survey-results-path]").forEach(b=>b.onclick=async()=>{
   const url=await sign(b.dataset.surveyResultsPath);
   if(url)openSurveyResults(url,b.dataset.surveyTitle||"Wyniki ankiety");
 });

 const galleryCheck=await sb.from("gallery_albums").select("id").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false});
 if(!galleryCheck.error)setNewContentTokens("gallery",(galleryCheck.data||[]).map(x=>`gallery:${x.id}`));

 hydratePageImages(q(".page.active")?.id||"home");
}
q("#openPay").onclick=()=>{if(q("#pass").value==="SowkiGrupa3"){q("#gate").hidden=true;q("#pay").hidden=false}else q("#payErr").textContent="Nieprawidłowe hasło"};q("#pass").onkeydown=e=>{if(e.key==="Enter")q("#openPay").click()};
q("#admin").onclick=async()=>{await auth();q("#dlg").showModal()};q(".x").onclick=()=>q("#dlg").close();q("#loginBtn").onclick=async()=>{const {error}=await sb.auth.signInWithPassword({email:q("#email").value,password:q("#pwd").value});q("#loginErr").textContent=error?.message||"";if(!error)auth()};q("#logout").onclick=async()=>{await sb.auth.signOut();auth()};
async function auth(){const {data:{user}}=await sb.auth.getUser();q("#login").hidden=!!user;q("#panel").hidden=!user;if(user){refreshAdminMessagesBadge();render("monthly_notices")}}
function setActiveAdminTab(table){
  qa(".tabs [data-tab]").forEach(b=>{
    const active=b.dataset.tab===table;
    b.classList.toggle("admin-tab-active",active);
    b.setAttribute("aria-selected",active?"true":"false");
    if(active)b.setAttribute("aria-current","page");
    else b.removeAttribute("aria-current");
  });
}
qa("[data-tab]").forEach(b=>b.onclick=()=>{
  if(b.dataset.tab==="stats")renderStats();
  else if(b.dataset.tab==="parent_messages")renderParentMessages();
  else render(b.dataset.tab);
});
const D={monthly_notices:{title:"Najważniejsze",fields:[["title","Tytuł","text"],["content","Opis","textarea"],["event_date","Data","date"],["published","Opublikuj od razu na stronie","checkbox"]]},events:{title:"Wydarzenia",fields:[["title","Tytuł","text"],["content","Treść","textarea"],["event_date","Data","date"],["file","Zdjęcie","file"],["published","Opublikuj od razu na stronie","checkbox"]]},menus:{title:"Jadłospis",fields:[["title","Tytuł","text"],["date_from","Od","date"],["date_to","Do","date"],["file","Zdjęcie","file"],["published","Opublikuj od razu na stronie","checkbox"]]},surveys:{title:"Ankiety",fields:[["title","Tytuł","text"],["form_url","Link do Microsoft Forms","url"],["ends_at","Koniec","datetime-local"],["file","Zdjęcie wyników ankiety","file"],["published","Opublikuj od razu na stronie","checkbox"]]},
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
    const parts=[];
    if(x.ends_at)parts.push("Do: "+formatWarsawDateTime(x.ends_at));
    if(x.results_image_url)parts.push("Wyniki: dodane");
    return parts.join(" • ");
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

async function refreshAdminMessagesBadge(){
  const badge=q("#adminMessagesBadge");
  if(!badge)return;

  try{
    const {data,error}=await sb
      .from("parent_messages")
      .select("id")
      .is("read_at",null);

    if(error)throw error;

    const count=(data||[]).length;
    badge.textContent=count>9?"9+":String(count);
    badge.hidden=!count;
  }catch{
    badge.hidden=true;
  }
}

function parentMessageDate(value){
  if(!value)return "";
  return new Date(value).toLocaleString("pl-PL",{
    timeZone:"Europe/Warsaw",
    day:"2-digit",
    month:"2-digit",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  });
}

async function renderParentMessages(){
  setActiveAdminTab("parent_messages");
  q("#editor").dataset.table="parent_messages";
  q("#editor").innerHTML=`<div class="admin-messages-loading">Ładowanie wiadomości…</div>`;

  const {data,error}=await sb
    .from("parent_messages")
    .select("*")
    .order("created_at",{ascending:false})
    .limit(200);

  if(error){
    q("#editor").innerHTML=`
      <div class="admin-order-warning">
        <b>⚠️ Nie udało się pobrać wiadomości.</b><br>
        ${esc(error.message)}<br><br>
        Jeśli dopiero dodajesz tę funkcję, uruchom plik SQL dołączony do wersji v0.5.5.7.
      </div>`;
    return;
  }

  const rows=data||[];
  const unread=rows.filter(x=>!x.read_at).length;

  q("#editor").innerHTML=`
    <section class="admin-parent-messages">
      <div class="admin-content-head">
        <div>
          <h3>Wiadomości od rodziców</h3>
          <p>Rodzic wysyła wiadomość bez logowania. To szybki kontakt służący do przekazania informacji wychowawczyni.</p>
        </div>
        <span class="admin-count">${unread?`${unread} nowych`:`${rows.length} wiadomości`}</span>
      </div>

      <div class="admin-parent-message-list">
        ${rows.length?rows.map(x=>`
          <article class="admin-parent-message ${x.read_at?"is-read":"is-unread"}">
            <div class="admin-parent-message-head">
              <div>
                <div class="admin-parent-message-title">
                  <b>${esc(x.parent_name)}</b>
                  <span class="admin-status ${x.read_at?"is-published":"is-hidden"}">${x.read_at?"✓ Przeczytana":"● Nowa"}</span>
                </div>
                <div class="admin-parent-message-meta">
                  Dziecko: <b>${esc(x.child_name)}</b> • ${parentMessageDate(x.created_at)}
                </div>
              </div>
            </div>

            <div class="admin-parent-message-body">${esc(x.message).replace(/\n/g,"<br>")}</div>

            <div class="actions admin-parent-message-actions">
              ${x.read_at
                ? `<button type="button" class="secondary" data-message-unread="${x.id}">Oznacz jako nieprzeczytaną</button>`
                : `<button type="button" class="primary" data-message-read="${x.id}">✓ Oznacz jako przeczytaną</button>`}
              <button type="button" class="danger" data-message-delete="${x.id}">Usuń</button>
            </div>
          </article>
        `).join(""):`<div class="admin-empty">Nie ma jeszcze żadnych wiadomości od rodziców.</div>`}
      </div>
    </section>
  `;

  qa("[data-message-read]").forEach(b=>b.onclick=async()=>{
    const {error}=await sb
      .from("parent_messages")
      .update({read_at:new Date().toISOString()})
      .eq("id",b.dataset.messageRead);
    if(error){alert(error.message);return}
    await refreshAdminMessagesBadge();
    renderParentMessages();
  });

  qa("[data-message-unread]").forEach(b=>b.onclick=async()=>{
    const {error}=await sb
      .from("parent_messages")
      .update({read_at:null})
      .eq("id",b.dataset.messageUnread);
    if(error){alert(error.message);return}
    await refreshAdminMessagesBadge();
    renderParentMessages();
  });

  qa("[data-message-delete]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Usunąć tę wiadomość?"))return;
    const {error}=await sb
      .from("parent_messages")
      .delete()
      .eq("id",b.dataset.messageDelete);
    if(error){alert(error.message);return}
    await refreshAdminMessagesBadge();
    renderParentMessages();
  });

  await refreshAdminMessagesBadge();
}

const STATS_PAGES=[
  ["home","START","🏠"],
  ["notificationsPage","Powiadomienia","🔔"],
  ["announcementsPage","Ogłoszenia","📢"],
  ["menu","Jadłospis","🍽️"],
  ["calendar","Kalendarz","📅"],
  ["surveysPage","Ankiety","📊"],
  ["gallery","Galeria","📸"],
  ["payments","Rozliczenia","💰"]
];

function statsTodayWarsaw(){
  const p=warsawParts(new Date());
  return p?`${p.year}-${p.month}-${p.day}`:"";
}

function statsDateLabel(day){
  if(!day)return "";
  const m=String(day).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?`${m[3]}.${m[2]}.${m[1]}`:String(day);
}

async function renderStats(days=30){
  setActiveAdminTab("stats");
  q("#editor").dataset.table="stats";
  q("#editor").innerHTML=`
    <section class="stats-panel">
      <div class="stats-head">
        <div>
          <h3>📊 Statystyki aplikacji</h3>
          <p>Anonimowe statystyki wejść do poszczególnych działów. Nie zapisujemy danych rodziców ani informacji, kto odwiedził dany dział.</p>
        </div>
      </div>

      <div class="stats-range" role="group" aria-label="Zakres statystyk">
        <button type="button" data-stats-days="7" ${days===7?'class="active"':""}>7 dni</button>
        <button type="button" data-stats-days="30" ${days===30?'class="active"':""}>30 dni</button>
        <button type="button" data-stats-days="90" ${days===90?'class="active"':""}>90 dni</button>
        <button type="button" data-stats-days="0" ${days===0?'class="active"':""}>Wszystko</button>
      </div>

      <div id="statsContent">
        <div class="stats-loading">Ładowanie statystyk…</div>
      </div>
    </section>
  `;

  qa("[data-stats-days]").forEach(b=>b.onclick=()=>renderStats(Number(b.dataset.statsDays)));

  const [summaryRes,dailyRes]=await Promise.all([
    sb.rpc("get_page_view_stats",{p_days:days}),
    sb.rpc("get_page_view_daily",{p_days:days})
  ]);

  if(summaryRes.error||dailyRes.error){
    const msg=summaryRes.error?.message||dailyRes.error?.message||"Nie udało się pobrać statystyk.";
    q("#statsContent").innerHTML=`
      <div class="admin-order-warning">
        <b>⚠️ Statystyki nie są jeszcze gotowe.</b><br>
        ${esc(msg)}<br><br>
        Jeśli dopiero dodajesz tę funkcję, uruchom plik SQL dołączony do wersji v0.5.5.2.
      </div>`;
    return;
  }

  const summaryMap=new Map((summaryRes.data||[]).map(x=>[String(x.page),Number(x.views)||0]));
  const daily=dailyRes.data||[];

  const total=STATS_PAGES.reduce((sum,[page])=>sum+(summaryMap.get(page)||0),0);
  const todayKey=statsTodayWarsaw();
  const today=daily
    .filter(x=>String(x.day)===todayKey)
    .reduce((sum,x)=>sum+(Number(x.views)||0),0);

  let topPage=null,topViews=-1;
  STATS_PAGES.forEach(([page,label,icon])=>{
    const n=summaryMap.get(page)||0;
    if(n>topViews){topViews=n;topPage={page,label,icon,n}}
  });

  const maxViews=Math.max(1,...STATS_PAGES.map(([page])=>summaryMap.get(page)||0));

  // Dzienny podział
  const byDay=new Map();
  daily.forEach(x=>{
    const day=String(x.day);
    if(!byDay.has(day))byDay.set(day,new Map());
    byDay.get(day).set(String(x.page),Number(x.views)||0);
  });

  const daysSorted=[...byDay.keys()].sort((a,b)=>b.localeCompare(a));

  q("#statsContent").innerHTML=`
    <div class="stats-overview">
      <div class="stats-kpi">
        <span>Łącznie wejść</span>
        <b>${total.toLocaleString("pl-PL")}</b>
      </div>
      <div class="stats-kpi">
        <span>Dzisiaj</span>
        <b>${today.toLocaleString("pl-PL")}</b>
      </div>
      <div class="stats-kpi stats-kpi-wide">
        <span>Najczęściej odwiedzany dział</span>
        <b>${topViews>0?`${topPage.icon} ${esc(topPage.label)} — ${topViews.toLocaleString("pl-PL")}`:"Brak danych"}</b>
      </div>
    </div>

    <section class="stats-section">
      <h4>Wejścia według działów</h4>
      <div class="stats-page-list">
        ${STATS_PAGES.map(([page,label,icon])=>{
          const n=summaryMap.get(page)||0;
          const pct=Math.round((n/maxViews)*100);
          return `<div class="stats-page-row">
            <div class="stats-page-label"><span>${icon}</span><b>${esc(label)}</b></div>
            <div class="stats-bar"><span style="width:${pct}%"></span></div>
            <strong>${n.toLocaleString("pl-PL")}</strong>
          </div>`;
        }).join("")}
      </div>
    </section>

    <section class="stats-section">
      <div class="stats-section-title">
        <h4>Podział na poszczególne dni</h4>
        <span>${daysSorted.length} ${daysSorted.length===1?"dzień":"dni"}</span>
      </div>

      <div class="stats-days">
        ${daysSorted.length?daysSorted.map(day=>{
          const map=byDay.get(day);
          const dayTotal=[...map.values()].reduce((a,b)=>a+b,0);
          return `<article class="stats-day-card">
            <div class="stats-day-head">
              <b>${statsDateLabel(day)}</b>
              <strong>${dayTotal.toLocaleString("pl-PL")} ${dayTotal===1?"wejście":"wejść"}</strong>
            </div>
            <div class="stats-day-grid">
              ${STATS_PAGES.map(([page,label,icon])=>{
                const n=map.get(page)||0;
                return `<div class="stats-day-item ${n?"has-views":""}">
                  <span>${icon} ${esc(label)}</span>
                  <b>${n.toLocaleString("pl-PL")}</b>
                </div>`;
              }).join("")}
            </div>
          </article>`;
        }).join(""):`<div class="admin-empty">Nie ma jeszcze danych w wybranym zakresie.</div>`}
      </div>
    </section>

    <p class="stats-note">ℹ️ Statystyki zaczynają być zbierane dopiero od momentu uruchomienia tej funkcji. Z jednego urządzenia ponowne wejście do tego samego działu w ciągu 10 minut nie jest liczone ponownie. Nadal są to anonimowe wejścia do działów, a nie identyfikacja konkretnych rodziców.</p>
  `;
}

function adminImagePath(table,row){
  if(!row)return "";
  if(table==="surveys")return row.results_image_url||"";
  if(["events","menus","gallery_albums","announcements"].includes(table)){
    return row.image_url||"";
  }
  return "";
}

function adminImageColumn(table){
  return table==="surveys"?"results_image_url":"image_url";
}

function adminImageFolder(table){
  return table==="events"?"events":
    table==="gallery_albums"?"gallery":
    table==="announcements"?"announcements":
    table==="surveys"?"survey-results":
    "menus";
}

function looksEcoOptimized(path){
  return /-full\.webp(?:$|\?)/i.test(String(path||""));
}

function ecoThumbPath(fullPath){
  const p=String(fullPath||"");
  if(/-full\.webp$/i.test(p)){
    return p.replace(/-full\.webp$/i,"-thumb.webp");
  }
  // Starsze zdjęcia nie mają osobnej miniatury.
  return p;
}

function ecoBaseName(name){
  return String(name||"image")
    .replace(/\.[^.]+$/,"")
    .replace(/-(full|thumb)$/i,"")
    .replace(/[^a-zA-Z0-9._-]/g,"_");
}

async function optimizeExistingAdminImage(table,id,path,button){
  if(!path)return;

  if(!confirm("Zoptymalizować to zdjęcie? Aplikacja utworzy lekką wersję pełną oraz miniaturę do listy."))return;

  const originalText=button?.textContent||"♻️ Optymalizuj zdjęcie";
  if(button){
    button.disabled=true;
    button.textContent="Optymalizuję…";
  }

  try{
    const signed=await sign(path);
    if(!signed)throw new Error("Nie udało się przygotować dostępu do obecnego zdjęcia.");

    const response=await withTimeout(
      fetch(signed,{cache:"no-store"}),
      60000,
      "Pobieranie obecnego zdjęcia trwało zbyt długo."
    );

    if(!response.ok){
      throw new Error(`Nie udało się pobrać zdjęcia (${response.status}).`);
    }

    const blob=await response.blob();
    if(!blob.size)throw new Error("Pobrane zdjęcie jest puste.");

    const originalName=String(path).split("/").pop()||"image.jpg";
    const file=new File([blob],originalName,{type:blob.type||"image/jpeg"});

    const setButtonStatus=text=>{
      if(button)button.textContent=text;
    };

    const eco=await prepareEcoPlusImages(file,table,setButtonStatus);

    const folder=adminImageFolder(table);
    const base=ecoBaseName(originalName);
    const stamp=Date.now();

    const fullPath=`${folder}/${stamp}-${base}-full.webp`;

    setButtonStatus("Wysyłam pełny…");

    const fullUpload=await withTimeout(
      sb.storage.from(cfg.bucket).upload(
        fullPath,
        eco.full.bytes,
        {
          contentType:"image/webp",
          cacheControl:"31536000",
          upsert:false
        }
      ),
      60000,
      "Wysyłanie pełnego zdjęcia trwało zbyt długo."
    );

    if(fullUpload.error)throw new Error(fullUpload.error.message);

    if(eco.thumb){
      const thumbPath=`${folder}/${stamp}-${base}-thumb.webp`;

      setButtonStatus("Wysyłam miniaturę…");

      const thumbUpload=await withTimeout(
        sb.storage.from(cfg.bucket).upload(
          thumbPath,
          eco.thumb.bytes,
          {
            contentType:"image/webp",
            cacheControl:"31536000",
            upsert:false
          }
        ),
        60000,
        "Wysyłanie miniatury trwało zbyt długo."
      );

      if(thumbUpload.error){
        console.warn("THUMB UPLOAD ERROR:",thumbUpload.error);
      }
    }

    setButtonStatus("Podmieniam…");

    const column=adminImageColumn(table);
    const update=await sb
      .from(table)
      .update({[column]:fullPath})
      .eq("id",id);

    if(update.error){
      throw new Error("Nie udało się podmienić wpisu: "+update.error.message);
    }

    const totalAfter=eco.full.size+(eco.thumb?.size||0);
    const saving=Math.max(
      0,
      Math.round((1-totalAfter/Math.max(1,eco.originalSize))*100)
    );

    alert(
      `✅ Zdjęcie zostało zoptymalizowane do ECO+.\n\n`+
      `Oryginał: ${formatFileSize(eco.originalSize)}\n`+
      `Pełny: ${formatFileSize(eco.full.size)}\n`+
      `${eco.thumb?`Miniatura: ${formatFileSize(eco.thumb.size)}\n`:""}`+
      `Łączna oszczędność miejsca: ${saving}%\n\n`+
      `Największa oszczędność transferu będzie przy listach, bo rodzice pobiorą miniaturę zamiast pełnego obrazu.`
    );

    await render(table);
    await load();

    if(table==="gallery_albums"&&!q("#galleryAlbums")?.hidden){
      await loadGallery();
    }
  }catch(e){
    console.error("EXISTING IMAGE OPTIMIZATION ERROR:",e);
    alert(e?.message||"Nie udało się zoptymalizować zdjęcia.");
  }finally{
    if(button&&document.body.contains(button)){
      button.disabled=false;
      button.textContent=originalText;
    }
  }
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
        <button class="primary admin-save-btn" type="submit">Zapisz</button>
        <div class="admin-save-status" aria-live="polite"></div>
      </form>
    </div>

    <section class="admin-content-manager">
      <div class="admin-content-head">
        <div>
          <h3>Opublikowane i zapisane treści</h3>
          <p>Użyj strzałek ↑ ↓, aby ustawić kolejność wyświetlania w aplikacji.</p>
        </div>
        <span class="admin-count">${rows.length} ${rows.length===1?"wpis":"wpisów"}</span>
      </div>

      <div class="admin-content-list">
        ${rows.length ? rows.map((x,i)=>{
          const meta=adminMeta(table,x);
          const isPublished=!!x.published;
          const imagePath=adminImagePath(table,x);
          const ecoOptimized=looksEcoOptimized(imagePath);
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
              ${imagePath?`
                <div class="admin-image-eco">
                  ${ecoOptimized
                    ? `<span class="admin-image-eco-ok">✅ Zdjęcie ECO+</span>`
                    : `<button type="button" class="admin-image-optimize" data-optimize-image="${x.id}" data-image-path="${esc(imagePath)}">♻️ Optymalizuj zdjęcie</button>`}
                </div>
              `:""}
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

  qa("[data-optimize-image]").forEach(b=>b.onclick=()=>optimizeExistingAdminImage(
    table,
    b.dataset.optimizeImage,
    b.dataset.imagePath,
    b
  ));
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
function formatFileSize(bytes){
  const n=Number(bytes)||0;
  if(n<1024)return `${n} B`;
  if(n<1024*1024)return `${(n/1024).toFixed(0)} KB`;
  return `${(n/1024/1024).toFixed(1)} MB`;
}

function loadImageForOptimization(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();

    img.onload=()=>{
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror=()=>{
      URL.revokeObjectURL(url);
      reject(new Error("Nie udało się przygotować zdjęcia do optymalizacji."));
    };

    img.src=url;
  });
}

async function canvasToBlob(canvas,type,quality){
  return await new Promise(resolve=>canvas.toBlob(resolve,type,quality));
}

async function optimizeImageForUpload(file,table,setStatus){
  const originalBytes=await withTimeout(
    file.arrayBuffer(),
    30000,
    "Odczyt zdjęcia trwał zbyt długo. Wybierz zdjęcie ponownie."
  );

  if(!originalBytes?.byteLength){
    throw new Error("Wybrany plik jest pusty. Wybierz zdjęcie ponownie.");
  }

  const type=String(file.type||"").toLowerCase();

  // Nie dotykamy plików, które nie są obrazami.
  if(!type.startsWith("image/") || type==="image/gif" || type==="image/svg+xml"){
    return {
      bytes:originalBytes,
      mime:type||"application/octet-stream",
      fileName:file.name||"plik",
      before:originalBytes.byteLength,
      after:originalBytes.byteLength,
      optimized:false
    };
  }

  // Małe zdjęcia nie wymagają ponownego kodowania.
  if(originalBytes.byteLength<=350*1024){
    return {
      bytes:originalBytes,
      mime:type||"image/jpeg",
      fileName:file.name||"image.jpg",
      before:originalBytes.byteLength,
      after:originalBytes.byteLength,
      optimized:false
    };
  }

  try{
    setStatus("Optymalizuję zdjęcie, aby oszczędzić transfer…");

    const img=await withTimeout(
      loadImageForOptimization(file),
      30000,
      "Optymalizacja zdjęcia trwała zbyt długo."
    );

    const textHeavy=table==="menus"||table==="surveys";
    const maxSide=textHeavy?1800:1600;
    const quality=textHeavy?0.84:0.80;

    let width=img.naturalWidth||img.width;
    let height=img.naturalHeight||img.height;

    if(!width||!height)throw new Error("Nie udało się odczytać wymiarów zdjęcia.");

    const scale=Math.min(1,maxSide/Math.max(width,height));
    width=Math.max(1,Math.round(width*scale));
    height=Math.max(1,Math.round(height*scale));

    const canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;

    const ctx=canvas.getContext("2d",{alpha:true});
    if(!ctx)throw new Error("Przeglądarka nie obsługuje optymalizacji obrazu.");

    ctx.drawImage(img,0,0,width,height);

    const blob=await canvasToBlob(canvas,"image/webp",quality);
    if(!blob||!blob.size)throw new Error("Nie udało się utworzyć zoptymalizowanego zdjęcia.");

    // Jeśli optymalizacja nic realnie nie daje, wysyłamy oryginał.
    if(blob.size>=originalBytes.byteLength*0.92){
      return {
        bytes:originalBytes,
        mime:type||"image/jpeg",
        fileName:file.name||"image.jpg",
        before:originalBytes.byteLength,
        after:originalBytes.byteLength,
        optimized:false
      };
    }

    const optimizedBytes=await blob.arrayBuffer();
    const originalName=(file.name||"image").replace(/\.[^.]+$/,"");

    return {
      bytes:optimizedBytes,
      mime:"image/webp",
      fileName:`${originalName}.webp`,
      before:originalBytes.byteLength,
      after:optimizedBytes.byteLength,
      optimized:true
    };
  }catch(e){
    // Optymalizacja nie może blokować publikacji.
    console.debug("IMAGE OPTIMIZATION FALLBACK:",e);
    return {
      bytes:originalBytes,
      mime:type||"image/jpeg",
      fileName:file.name||"image.jpg",
      before:originalBytes.byteLength,
      after:originalBytes.byteLength,
      optimized:false
    };
  }
}


async function optimizeImageVariant(file,{maxSide,quality}){
  const originalBytes=await file.arrayBuffer();
  if(!originalBytes?.byteLength)throw new Error("Wybrany plik jest pusty.");

  const type=String(file.type||"").toLowerCase();
  if(!type.startsWith("image/") || type==="image/gif" || type==="image/svg+xml"){
    return {
      bytes:originalBytes,
      mime:type||"application/octet-stream",
      size:originalBytes.byteLength,
      optimized:false
    };
  }

  const img=await loadImageForOptimization(file);
  let width=img.naturalWidth||img.width;
  let height=img.naturalHeight||img.height;

  if(!width||!height)throw new Error("Nie udało się odczytać wymiarów zdjęcia.");

  const scale=Math.min(1,maxSide/Math.max(width,height));
  width=Math.max(1,Math.round(width*scale));
  height=Math.max(1,Math.round(height*scale));

  const canvas=document.createElement("canvas");
  canvas.width=width;
  canvas.height=height;

  const ctx=canvas.getContext("2d",{alpha:true});
  if(!ctx)throw new Error("Przeglądarka nie obsługuje optymalizacji obrazu.");

  ctx.drawImage(img,0,0,width,height);

  const blob=await canvasToBlob(canvas,"image/webp",quality);
  if(!blob?.size)throw new Error("Nie udało się utworzyć obrazu WebP.");

  return {
    bytes:await blob.arrayBuffer(),
    mime:"image/webp",
    size:blob.size,
    optimized:true
  };
}

async function prepareEcoPlusImages(file,table,setStatus){
  const originalBytes=await withTimeout(
    file.arrayBuffer(),
    30000,
    "Odczyt zdjęcia trwał zbyt długo."
  );

  if(!originalBytes?.byteLength){
    throw new Error("Wybrany plik jest pusty.");
  }

  const type=String(file.type||"").toLowerCase();

  // Dla plików innych niż obrazy zachowujemy dotychczasowy sposób.
  if(!type.startsWith("image/") || type==="image/gif" || type==="image/svg+xml"){
    return {
      originalSize:originalBytes.byteLength,
      full:{
        bytes:originalBytes,
        mime:type||"application/octet-stream",
        size:originalBytes.byteLength,
        ext:"bin"
      },
      thumb:null
    };
  }

  setStatus("Tworzę lekką wersję zdjęcia…");

  const textHeavy=table==="menus"||table==="surveys";
  const fullMax=textHeavy?1800:1600;
  const fullQuality=textHeavy?0.84:0.80;

  const full=await withTimeout(
    optimizeImageVariant(file,{maxSide:fullMax,quality:fullQuality}),
    45000,
    "Optymalizacja pełnego zdjęcia trwała zbyt długo."
  );

  // Miniatura ma być bardzo lekka.
  // Jadłospisy mają większą miniaturę, aby tekst nadal był czytelny.
  const thumbMax=table==="menus"?760:560;
  const thumbQuality=table==="menus"?0.74:0.68;

  let thumb=null;
  if(table!=="surveys"){
    setStatus("Tworzę miniaturę…");
    thumb=await withTimeout(
      optimizeImageVariant(file,{maxSide:thumbMax,quality:thumbQuality}),
      45000,
      "Tworzenie miniatury trwało zbyt długo."
    );
  }

  return {
    originalSize:originalBytes.byteLength,
    full:{...full,ext:"webp"},
    thumb:thumb?{...thumb,ext:"webp"}:null
  };
}

function withTimeout(promise,ms,message){
  let timer;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(message)),ms);
  });
  return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}

async function save(ev){
  ev.preventDefault();

  const form=ev.target;
  const saveBtn=form.querySelector(".admin-save-btn");
  const saveStatus=form.querySelector(".admin-save-status");

  const setStatus=(text)=>{
    if(saveStatus)saveStatus.textContent=text||"";
  };

  const setBusy=(busy)=>{
    if(saveBtn){
      saveBtn.disabled=busy;
      saveBtn.textContent=busy?"Zapisywanie…":"Zapisz";
      saveBtn.classList.toggle("is-saving",busy);
    }
  };

  setBusy(true);
  setStatus("Przygotowuję wpis…");

  try{
    const table=q("#editor").dataset.table,
          d=D[table],
          fd=new FormData(form),
          id=fd.get("id"),
          o={};

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
      if(o.ends_at)o.ends_at=warsawLocalToISO(o.ends_at);
    }

    const file=fd.get("file");

    if(file?.size){
      const folder=
        table==="events"?"events":
        table==="gallery_albums"?"gallery":
        table==="announcements"?"announcements":
        table==="surveys"?"survey-results":
        "menus";

      setStatus("Przygotowuję zdjęcie…");

      const eco=await prepareEcoPlusImages(file,table,setStatus);
      const base=ecoBaseName(file.name||"image");
      const stamp=Date.now();

      const fullPath=`${folder}/${stamp}-${base}-full.${eco.full.ext}`;

      setStatus(
        eco.full.size<eco.originalSize
          ? `Pełny obraz: ${formatFileSize(eco.originalSize)} → ${formatFileSize(eco.full.size)}. Wysyłam…`
          : "Wysyłam pełny obraz…"
      );

      const fullUpload=await withTimeout(
        sb.storage.from(cfg.bucket).upload(
          fullPath,
          eco.full.bytes,
          {
            contentType:eco.full.mime,
            cacheControl:"31536000",
            upsert:false
          }
        ),
        60000,
        "Wysyłanie pełnego zdjęcia trwało zbyt długo."
      );

      if(fullUpload.error)throw new Error(fullUpload.error.message);

      if(eco.thumb){
        const thumbPath=`${folder}/${stamp}-${base}-thumb.webp`;

        setStatus(`Wysyłam miniaturę (${formatFileSize(eco.thumb.size)})…`);

        const thumbUpload=await withTimeout(
          sb.storage.from(cfg.bucket).upload(
            thumbPath,
            eco.thumb.bytes,
            {
              contentType:"image/webp",
              cacheControl:"31536000",
              upsert:false
            }
          ),
          60000,
          "Wysyłanie miniatury trwało zbyt długo."
        );

        if(thumbUpload.error){
          // Pełny obraz jest już zapisany. Nie blokujemy publikacji:
          // aplikacja po prostu użyje pełnej wersji jako fallback.
          console.warn("THUMB UPLOAD ERROR:",thumbUpload.error);
        }
      }

      if(table==="surveys")o.results_image_url=fullPath;
      else o.image_url=fullPath;
    }

    setStatus("Zapisuję wpis…");

    if(!id){
      try{
        o.sort_order=await withTimeout(
          nextSortOrder(table),
          20000,
          "Nie udało się ustawić kolejności wpisu."
        );
      }catch(e){
        throw new Error(
          "Nie udało się ustawić kolejności nowego wpisu: "+(e?.message||e)
        );
      }
    }

    const savePromise=id
      ? sb.from(table).update(o).eq("id",id)
      : sb.from(table).insert(o).select().single();

    const r=await withTimeout(
      savePromise,
      30000,
      "Zapisywanie wpisu trwało zbyt długo. Sprawdź internet i spróbuj ponownie."
    );

    if(r.error)throw new Error(r.error.message);

    if(table==="notifications"&&!id&&r.data){
      setStatus("Wysyłam powiadomienie PUSH…");

      const sent=await withTimeout(
        sb.functions.invoke("send-push",{body:{notification_id:r.data.id}}),
        45000,
        "Wpis zapisano, ale wysyłanie PUSH trwało zbyt długo."
      );

      if(sent.error){
        alert(
          "Powiadomienie zapisano, ale wysyłka push zgłosiła błąd: "+
          sent.error.message
        );
      }else{
        alert(
          `Powiadomienie zapisane i wysłane. Urządzenia: ${sent.data?.sent??0}`
        );
      }
    }

    setStatus("✅ Zapisano");
    await render(table);
    load();
    if(table==="notifications")loadNotifications();

  }catch(e){
    console.error("ADMIN SAVE ERROR:",e);
    setStatus("❌ Nie udało się zapisać.");
    alert(e?.message||"Nie udało się zapisać wpisu. Spróbuj ponownie.");
  }finally{
    // Po udanym render() stary formularz może już nie istnieć.
    if(document.body.contains(form))setBusy(false);
  }
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

function openSurveyResults(url,title="Wyniki ankiety"){
  let d=q("#surveyResultsPreview");
  if(!d){
    d=document.createElement("dialog");
    d.id="surveyResultsPreview";
    d.className="photo-preview survey-results-preview";
    d.innerHTML=`<button class="preview-close" aria-label="Zamknij">✕</button><div class="survey-results-preview-title"></div><div class="preview-stage"><img alt="Wyniki ankiety"></div><div class="preview-hint">Przesuwaj obraz palcem • użyj gestu powiększania</div>`;
    document.body.appendChild(d);
    d.querySelector(".preview-close").onclick=()=>d.close();
    d.onclick=e=>{if(e.target===d)d.close()};
  }
  d.querySelector(".survey-results-preview-title").textContent=title;
  d.querySelector("img").src=url;
  d.querySelector("img").alt=`Wyniki ankiety: ${title}`;
  d.showModal();
}

const TRACKED_PAGES=new Set([
  "home",
  "notificationsPage",
  "announcementsPage",
  "menu",
  "calendar",
  "surveysPage",
  "gallery",
  "payments"
]);

const STATS_DEDUPE_MS=10*60*1000;
let lastTrackedPage=null;

function statsLastCountedKey(page){
  return `sowki_stats_last_counted_${page}_v1`;
}

function canCountPageView(page){
  const last=Number(localStorage.getItem(statsLastCountedKey(page))||0);
  return !last || (Date.now()-last)>=STATS_DEDUPE_MS;
}

function rememberCountedPageView(page){
  localStorage.setItem(statsLastCountedKey(page),String(Date.now()));
}

async function trackPageView(page){
  if(!TRACKED_PAGES.has(page))return;
  if(lastTrackedPage===page)return;

  lastTrackedPage=page;

  // Z jednego urządzenia nie liczymy ponownie tego samego działu
  // częściej niż raz na 10 minut.
  if(!canCountPageView(page))return;

  try{
    const {error}=await sb.rpc("track_page_view",{p_page:page});
    if(error)throw error;

    // Dopiero po poprawnym zapisie do Supabase uruchamiamy 10-minutową blokadę.
    rememberCountedPageView(page);
  }catch(e){
    // Statystyki są dodatkiem — błąd nie może wpływać na działanie aplikacji.
    console.debug("Page view tracking unavailable:",e);
  }
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
 closeSectionInfo();

 const previous=q(".page.active")?.id||"";
 qa(".page").forEach(x=>x.classList.remove("active"));

 const page=q("#"+id);
 if(page)page.classList.add("active");

 setActiveNav(id);
 markSectionContentSeen(id);

 if(page && previous!==id)trackPageView(id);

 hydratePageImages(id);
 scrollTo(0,0);
}
setActiveNav(q(".page.active")?.id||"home");
q("#galleryUnlock").onclick=()=>{if(q("#galleryPass").value==="SowkiGrupa3"){q("#galleryGate").hidden=true;q("#galleryAlbums").hidden=false;q("#galleryErr").textContent="";loadGallery()}else q("#galleryErr").textContent="Nieprawidłowe hasło"};
q("#galleryPass").onkeydown=e=>{if(e.key==="Enter")q("#galleryUnlock").click()};
async function loadGallery(){
 const {data,error}=await sb.from("gallery_albums").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false});
 if(error){q("#galleryAlbums").innerHTML=`<div class="item err">${esc(error.message)}</div>`;return}
 setNewContentTokens("gallery",(data||[]).map(x=>`gallery:${x.id}`));
 let out=[];
 for(const x of data||[]){
   out.push(`<article class="item">${storageImg(x.image_url,{className:"album-cover",alt:x.title||"Album zdjęć"})}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3><p>${richDisplay(x.description||"")}</p>${x.download_url?`<a class="primary album-download" target="_blank" rel="noopener" href="${esc(x.download_url)}">📥 Pobierz wszystkie zdjęcia</a>`:""}</article>`);
 }
 q("#galleryAlbums").innerHTML=out.join("")||empty("Nie ma jeszcze albumów.");
 hydratePageImages("gallery");
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

async function updateAppIconBadge(unread){
  try{
    // iOS / iPadOS Home Screen Web Apps oraz wspierane przeglądarki desktopowe.
    if(unread>0 && "setAppBadge" in navigator){
      await navigator.setAppBadge(unread);
      return;
    }

    if(unread<=0 && "clearAppBadge" in navigator){
      await navigator.clearAppBadge();
    }
  }catch(e){
    // Badge aplikacji jest dodatkiem — jego brak nie może wpływać na działanie PWA.
    console.debug("App badge unavailable:",e);
  }
}

function updateNotificationBadge(data){
  const read=getReadNotificationIds();
  const unread=(data||[]).filter(x=>!read.has(String(x.id))).length;
  const badge=q("#notificationBadge");
  if(badge){
    badge.textContent=unread>9?"9+":String(unread);
    badge.hidden=!unread;
  }

  // Ten sam licznik pokazujemy na ikonie zainstalowanej aplikacji,
  // jeśli dany system/przeglądarka obsługuje Badging API.
  updateAppIconBadge(unread);
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

// Jeśli aplikacja została otwarta normalnie, bez przejścia z PUSH-a,
// liczymy pierwsze wejście do aktualnie widocznego działu.
if(lastTrackedPage===null){
  trackPageView(q(".page.active")?.id||"home");
}

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
