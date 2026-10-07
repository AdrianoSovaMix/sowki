
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

function notificationPlainText(v){
 let s=String(v||"");

 s=s
   .replace(/<br\s*\/?>/gi,"\n")
   .replace(/<li\b[^>]*>/gi,"• ")
   .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi,"\n")
   .replace(/<[^>]+>/g,"");

 const ta=document.createElement("textarea");
 ta.innerHTML=s;
 s=ta.value;

 return s
   .replace(/\r\n?/g,"\n")
   .replace(/[ \t]+\n/g,"\n")
   .replace(/\n{3,}/g,"\n\n")
   .trim();
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
   let savedRange=null;

   const sync=()=>hidden.value=richSanitize(ed.innerHTML);

   const saveSelection=()=>{
     const sel=window.getSelection();
     if(!sel?.rangeCount)return;
     const range=sel.getRangeAt(0);
     if(ed.contains(range.commonAncestorContainer)){
       savedRange=range.cloneRange();
     }
   };

   const restoreSelection=()=>{
     ed.focus();
     if(!savedRange)return;
     const sel=window.getSelection();
     sel.removeAllRanges();
     sel.addRange(savedRange);
   };

   ed.addEventListener("mouseup",saveSelection);
   ed.addEventListener("keyup",saveSelection);
   ed.addEventListener("input",()=>{sync();saveSelection()});

   w.querySelectorAll("[data-cmd]").forEach(b=>{
     b.onmousedown=e=>e.preventDefault();
     b.onclick=()=>{
       restoreSelection();
       document.execCommand(b.dataset.cmd,false,null);
       sync();
       saveSelection();
     };
   });

   const cp=w.querySelector('input[type="color"]');
   if(cp){
     cp.addEventListener("mousedown",saveSelection);
     cp.oninput=()=>{
       restoreSelection();
       document.execCommand("foreColor",false,cp.value);
       sync();
       saveSelection();
     };
   }

   const link=w.querySelector("[data-link]");
   if(link){
     link.onmousedown=e=>e.preventDefault();
     link.onclick=()=>{
       const u=prompt("Wklej adres linku (https://...)");
       if(u&&/^https?:\/\//i.test(u)){
         restoreSelection();
         document.execCommand("createLink",false,u);
         sync();
         saveSelection();
       }
     };
   }

   const clear=w.querySelector("[data-clear]");
   if(clear){
     clear.onmousedown=e=>e.preventDefault();
     clear.onclick=()=>{
       restoreSelection();
       document.execCommand("removeFormat",false,null);
       sync();
       saveSelection();
     };
   }

   sync();
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
// v0.7.15 — neutralna Sówka SVG w interfejsie; logo aplikacji pozostaje tylko logo aplikacji
// =========================================================
const parentMessageDlg=q("#parentMessageDlg");
const parentMessageForm=q("#parentMessageForm");
const parentMessageStatus=q("#parentMessageStatus");
const parentMessagePhoneInput=parentMessageForm?.querySelector('input[name="contact"]');

function formatPolishLocalPhone(value){
  let digits=String(value||"").replace(/\D/g,"");

  // Ułatwienie przy wklejeniu pełnego numeru +48XXXXXXXXX.
  if(digits.length>9 && digits.startsWith("48")){
    digits=digits.slice(2);
  }

  digits=digits.slice(0,9);

  const parts=[];
  if(digits.length)parts.push(digits.slice(0,3));
  if(digits.length>3)parts.push(digits.slice(3,6));
  if(digits.length>6)parts.push(digits.slice(6,9));

  return parts.join("-");
}

function polishPhonePayload(value){
  const formatted=formatPolishLocalPhone(value);
  const digits=formatted.replace(/\D/g,"");
  return digits.length===9 ? `+48 ${formatted}` : "";
}

if(parentMessagePhoneInput){
  parentMessagePhoneInput.addEventListener("input",()=>{
    const formatted=formatPolishLocalPhone(parentMessagePhoneInput.value);
    if(parentMessagePhoneInput.value!==formatted){
      parentMessagePhoneInput.value=formatted;
    }
  });

  parentMessagePhoneInput.addEventListener("blur",()=>{
    parentMessagePhoneInput.value=formatPolishLocalPhone(parentMessagePhoneInput.value);
  });
}

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

  const localPhone=String(fd.get("contact")||"").trim();
  const formattedContact=polishPhonePayload(localPhone);

  const payload={
    p_parent_name:String(fd.get("parent_name")||"").trim(),
    p_child_name:String(fd.get("child_name")||"").trim(),
    p_contact:formattedContact,
    p_message:String(fd.get("message")||"").trim()
  };

  if(!payload.p_parent_name||!payload.p_child_name||!localPhone||!payload.p_message){
    parentMessageStatus.textContent="Uzupełnij wszystkie pola.";
    return;
  }

  if(!formattedContact){
    parentMessageStatus.textContent="Numer telefonu musi zawierać dokładnie 9 cyfr.";
    parentMessagePhoneInput?.focus();
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

function recordImageUrls(row){
  if(!row)return [];

  let urls=[];
  const raw=row.image_urls;

  if(Array.isArray(raw)){
    urls=raw;
  }else if(typeof raw==="string"&&raw.trim()){
    try{
      const parsed=JSON.parse(raw);
      if(Array.isArray(parsed))urls=parsed;
    }catch{}
  }

  urls=urls.map(x=>String(x||"").trim()).filter(Boolean);

  if(!urls.length&&row.image_url){
    urls=[String(row.image_url).trim()];
  }

  return [...new Set(urls)].slice(0,4);
}

function multiStorageImages(row,{className="",alt="",preview=true}={}){
  const urls=recordImageUrls(row);
  if(!urls.length)return "";

  return `<div class="post-image-grid post-image-count-${urls.length}">
    ${urls.map((url,i)=>storageImg(url,{
      className:`${className} post-image-grid-item`,
      alt:urls.length>1?`${alt} – zdjęcie ${i+1}`:alt,
      title:preview?"Dotknij, aby powiększyć":"",
      preview
    })).join("")}
  </div>`;
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


// v0.7.7 — dashboard statystyk + anonimowa identyfikacja urządzeń; dodano „Bajkowe podróże sowiej rodziny”.
// Rodzic nadal ma lokalne oznaczenie w localStorage. Dodatkowo aplikacja wysyła do Supabase
// anonimowe potwierdzenie urządzenia, bez imienia, e-maila, numeru telefonu ani konta rodzica.
const SOWKI_READ_STORAGE_PREFIX="sowki_read_v1";
const SOWKI_DEVICE_STORAGE_KEY="sowki_reader_device_v1";
const SOWKI_SYNC_STORAGE_PREFIX="sowki_read_synced_v1";

function sowkiReadStorageKey(kind,id){
  return `${SOWKI_READ_STORAGE_PREFIX}:${String(kind||"")}:${String(id||"")}`;
}

function sowkiIsMarkedRead(kind,id){
  try{
    return localStorage.getItem(sowkiReadStorageKey(kind,id))==="1";
  }catch{
    return false;
  }
}

function sowkiMarkRead(kind,id){
  try{
    localStorage.setItem(sowkiReadStorageKey(kind,id),"1");
    return true;
  }catch{
    return false;
  }
}

function sowkiDeviceToken(){
  try{
    let token=localStorage.getItem(SOWKI_DEVICE_STORAGE_KEY);
    if(token && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token))return token;

    if(globalThis.crypto?.randomUUID){
      token=crypto.randomUUID();
    }else{
      token="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
        const r=Math.random()*16|0;
        const v=c==="x"?r:(r&0x3|0x8);
        return v.toString(16);
      });
    }

    localStorage.setItem(SOWKI_DEVICE_STORAGE_KEY,token);
    return token;
  }catch{
    return null;
  }
}

function sowkiSyncStorageKey(kind,id){
  return `${SOWKI_SYNC_STORAGE_PREFIX}:${String(kind||"")}:${String(id||"")}`;
}

function sowkiIsSynced(kind,id){
  try{return localStorage.getItem(sowkiSyncStorageKey(kind,id))==="1"}catch{return false}
}

function sowkiMarkSynced(kind,id){
  try{localStorage.setItem(sowkiSyncStorageKey(kind,id),"1")}catch{}
}

async function sowkiSyncReceipt(kind,id){
  if(!["notice","event","announcement"].includes(String(kind||"")))return false;
  if(!id || sowkiIsSynced(kind,id))return true;

  const deviceToken=sowkiDeviceToken();
  if(!deviceToken)return false;

  try{
    const {data,error}=await sb.rpc("give_sowka",{
      p_kind:String(kind),
      p_item_id:Number(id),
      p_device_token:deviceToken
    });

    if(error){
      console.warn("Nie udało się zsynchronizować Sówki:",error.message);
      return false;
    }

    if(data===true){
      sowkiMarkSynced(kind,id);
      return true;
    }
  }catch(error){
    console.warn("Nie udało się zsynchronizować Sówki:",error);
  }

  return false;
}

function sowkiKindForTable(table){
  return table==="monthly_notices"?"notice":
    table==="events"?"event":
    table==="announcements"?"announcement":"";
}

async function loadAdminSowkaCounts(kind){
  if(!kind)return null;
  try{
    const {data,error}=await sb.rpc("get_sowka_counts",{p_kind:kind});
    if(error){
      console.warn("Nie udało się pobrać liczników Sówek:",error.message);
      return null;
    }
    return new Map((data||[]).map(x=>[String(x.item_id),Number(x.sowka_count)||0]));
  }catch(error){
    console.warn("Nie udało się pobrać liczników Sówek:",error);
    return null;
  }
}

function adminSowkaCountBadge(id,counts){
  if(!(counts instanceof Map))return "";
  const count=counts.get(String(id))||0;
  const label=count===1
    ? "1 urządzenie oznaczyło tę informację jako przeczytaną"
    : `${count} urządzeń oznaczyło tę informację jako przeczytaną`;

  return `<span class="admin-sowka-count" title="${esc(label)}" aria-label="${esc(label)}">
    ${sowkiOwlSvg(true)}
    <strong>${count}</strong>
  </span>`;
}

function sowkiHeartPath(){
  return 'M12 21.1 10.55 19.78C5.4 15.1 2 12.02 2 8.25 2 5.17 4.42 2.75 7.5 2.75c1.74 0 3.41.81 4.5 2.09a6.02 6.02 0 0 1 4.5-2.09c3.08 0 5.5 2.42 5.5 5.5 0 3.77-3.4 6.85-8.55 11.54L12 21.1Z';
}

function sowkiOwlSvg(read=false){
  const eyes=read
    ? `<path class="sowki-owl-happy-eye" d="M18.5 22.5c2-2.4 5.2-2.4 7.2 0"/><path class="sowki-owl-happy-eye" d="M38.3 22.5c2-2.4 5.2-2.4 7.2 0"/>`
    : `<g class="sowki-owl-eyes"><circle cx="22" cy="21" r="6.5" fill="#fff"/><circle cx="42" cy="21" r="6.5" fill="#fff"/><circle cx="22" cy="21" r="3.1" fill="#2f211c"/><circle cx="42" cy="21" r="3.1" fill="#2f211c"/><circle cx="20.9" cy="19.7" r="1" fill="#fff"/><circle cx="40.9" cy="19.7" r="1" fill="#fff"/></g>`;
  return `<svg class="sowki-read-owl-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <ellipse cx="32" cy="58" rx="17" ry="3" fill="#6a3b2b" opacity=".13"/>
    <path d="M15 18 12 8l10 6c3-2 6.4-3 10-3s7 1 10 3l10-6-3 10c4 4.2 6 9.7 6 16 0 14-9.5 24-23 24S9 48 9 34c0-6.3 2-11.8 6-16Z" fill="#9b5a32"/>
    <path d="M18 17c4-4.2 9-6 14-6s10 1.8 14 6c-2 7-7.3 11-14 11S20 24 18 17Z" fill="#c77b43"/>
    <ellipse cx="32" cy="39" rx="15" ry="16" fill="#f2c98f"/>
    <path d="M14 32c-4 5-4 11 1 15 2.7 2.2 5.5 1.7 8-.1-4.3-3.6-6.9-8.8-9-14.9ZM50 32c4 5 4 11-1 15-2.7 2.2-5.5 1.7-8-.1 4.3-3.6 6.9-8.8 9-14.9Z" fill="#7b4328"/>
    ${eyes}
    <path d="m32 26-4 4h8l-4-4Z" fill="#f59b32"/>
    <path d="M24 54c2.7 1 5.3 1.4 8 1.4s5.3-.4 8-1.4" fill="none" stroke="#7b4328" stroke-width="2" stroke-linecap="round"/>
    <g transform="translate(22 33) scale(.82)">
      <g class="sowki-owl-heart">
        <path d="${sowkiHeartPath()}" fill="#ff3e6f"/>
        <path d="M7.6 5.4c1.2-.8 2.8-.7 3.8.5" fill="none" stroke="#ff9ab6" stroke-width="1.4" stroke-linecap="round" opacity=".9"/>
      </g>
    </g>
  </svg>`;
}

function sowkiCheckSvg(){
  return `<svg class="sowki-read-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m7.4 12.4 3 3.1 6.4-7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function sowkiArrowSvg(){
  return `<svg class="sowki-read-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function sowkiBurstHearts(){
  const p=sowkiHeartPath();
  return `<span class="sowki-read-burst" aria-hidden="true">
    <svg class="sowki-burst-heart h1" viewBox="0 0 24 24"><path d="${p}"/></svg>
    <svg class="sowki-burst-heart h2" viewBox="0 0 24 24"><path d="${p}"/></svg>
    <svg class="sowki-burst-heart h3" viewBox="0 0 24 24"><path d="${p}"/></svg>
  </span>`;
}

function sowkiReadButtonInner(read){
  if(read){
    return `${sowkiOwlSvg(true)}${sowkiCheckSvg()}`;
  }
  return `${sowkiOwlSvg(false)}${sowkiBurstHearts()}`;
}

function sowkiReadReaction(kind,id){
  const read=sowkiIsMarkedRead(kind,id);
  if(read && !sowkiIsSynced(kind,id)){
    queueMicrotask(()=>sowkiSyncReceipt(kind,id));
  }
  const safeKind=esc(kind);
  const safeId=esc(id);
  return `<div class="sowki-read-row ${read?"is-read":""}">
    <span class="sowki-read-note">${read?"Przeczytane":"Daj Sówkę"}</span>
    <button type="button" class="sowki-read-btn ${read?"is-read":""}" data-sowki-read data-kind="${safeKind}" data-id="${safeId}" ${read?"disabled":""} title="${read?"Przeczytane na tym urządzeniu":"Daj Sówkę – oznacz jako przeczytane"}" aria-label="${read?"Przeczytane. Sówka została już dana na tym urządzeniu.":"Daj Sówkę, aby oznaczyć tę informację jako przeczytaną."}">
      ${sowkiReadButtonInner(read)}
    </button>
  </div>`;
}

function sowkiSetReadButtonState(btn,read){
  if(!btn)return;
  const row=btn.closest(".sowki-read-row");
  btn.classList.remove("is-celebrating");
  btn.classList.toggle("is-read",read);
  btn.disabled=!!read;
  btn.innerHTML=sowkiReadButtonInner(read);
  btn.setAttribute("aria-label",read
    ? "Przeczytane. Sówka została już dana na tym urządzeniu."
    : "Daj Sówkę, aby oznaczyć tę informację jako przeczytaną.");
  btn.setAttribute("title",read ? "Przeczytane na tym urządzeniu" : "Daj Sówkę – oznacz jako przeczytane");
  if(row){
    row.classList.toggle("is-read",read);
    const note=row.querySelector(".sowki-read-note");
    if(note)note.textContent=read?"Przeczytane":"Daj Sówkę";
  }
}

document.addEventListener("click",e=>{
  const btn=e.target.closest?.("[data-sowki-read]");
  if(!btn||btn.disabled||btn.classList.contains("is-read"))return;

  const kind=btn.dataset.kind||"";
  const id=btn.dataset.id||"";
  if(!kind||!id)return;

  // Zapisujemy od razu lokalnie, żeby nawet szybkie zamknięcie strony nie zgubiło odczytania.
  sowkiMarkRead(kind,id);
  // Licznik administratora jest anonimowy i nie blokuje animacji/interfejsu.
  sowkiSyncReceipt(kind,id);
  btn.disabled=true;
  btn.classList.add("is-celebrating");

  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  window.setTimeout(()=>sowkiSetReadButtonState(btn,true),reduced?80:1050);
});

// v0.7.4 — stabilne pobieranie danych publicznych.
// Zapytania startują równolegle, a chwilowy błąd sieci/Supabase jest automatycznie ponawiany.
const PUBLIC_LOAD_RETRY_DELAYS=[350,900,1800];
let publicLoadGeneration=0;

function publicLoadSleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function publicQueryWithRetry(label,queryFactory){
  let lastResult={data:null,error:{message:`Nie udało się pobrać: ${label}`}};

  for(let attempt=0;attempt<=PUBLIC_LOAD_RETRY_DELAYS.length;attempt++){
    try{
      const result=await queryFactory();
      lastResult=result||lastResult;
      if(!result?.error)return result;
      console.warn(`Sówki: błąd pobierania ${label}, próba ${attempt+1}:`,result.error.message);
    }catch(error){
      lastResult={data:null,error:{message:error?.message||String(error)}};
      console.warn(`Sówki: wyjątek podczas pobierania ${label}, próba ${attempt+1}:`,error);
    }

    if(attempt<PUBLIC_LOAD_RETRY_DELAYS.length){
      await publicLoadSleep(PUBLIC_LOAD_RETRY_DELAYS[attempt]);
    }
  }

  return lastResult;
}

function publicLoadingCard(text){
  return `<div class="item muted public-loading-card"><span class="public-loading-dot" aria-hidden="true"></span>${esc(text)}</div>`;
}

function publicLoadErrorCard(sectionName){
  return `<div class="item public-load-error">
    <b>⚠️ Nie udało się pobrać ${esc(sectionName)}.</b>
    <p class="muted">Aplikacja próbowała ponownie automatycznie. Sprawdź połączenie z internetem i spróbuj jeszcze raz.</p>
    <button type="button" class="secondary public-retry-btn" data-public-retry>🔄 Spróbuj ponownie</button>
  </div>`;
}

function publicShowLoadingIfEmpty(selector,text){
  const el=q(selector);
  if(el && !el.innerHTML.trim())el.innerHTML=publicLoadingCard(text);
}

function bindPublicRetryButtons(){
  qa('[data-public-retry]').forEach(btn=>{
    btn.onclick=()=>load();
  });
}

async function load(){
 const loadGeneration=++publicLoadGeneration;

 publicShowLoadingIfEmpty("#notices","Ładowanie najważniejszych informacji…");
 publicShowLoadingIfEmpty("#events","Ładowanie wydarzeń…");
 publicShowLoadingIfEmpty("#announcements","Ładowanie ogłoszeń…");
 publicShowLoadingIfEmpty("#menus","Ładowanie jadłospisu…");
 publicShowLoadingIfEmpty("#surveys","Ładowanie ankiet…");

 const [noticesResult,eventsResult,announcementsResult,menusResult,surveysResult,galleryCheck]=await Promise.all([
   publicQueryWithRetry("najważniejszych informacji",()=>sb.from("monthly_notices").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false})),
   publicQueryWithRetry("wydarzeń",()=>sb.from("events").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false})),
   publicQueryWithRetry("ogłoszeń",()=>sb.from("announcements").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false})),
   publicQueryWithRetry("jadłospisu",()=>sb.from("menus").select("*").eq("published",true).order("date_from",{ascending:false}).order("id",{ascending:false})),
   publicQueryWithRetry("ankiet",()=>sb.from("surveys").select("*").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false})),
   publicQueryWithRetry("galerii",()=>sb.from("gallery_albums").select("id").eq("published",true).order("sort_order",{ascending:true}).order("id",{ascending:false}))
 ]);

 // Jeżeli w międzyczasie uruchomiono nowsze load(), starsza odpowiedź nie może nadpisać ekranu.
 if(loadGeneration!==publicLoadGeneration)return;

 // Najważniejsze informacje
 let homeNoticeRows=[];
 if(noticesResult.error){
   q("#notices").innerHTML=publicLoadErrorCard("najważniejszych informacji");
 }else{
   homeNoticeRows=noticesResult.data||[];
   q("#notices").innerHTML=homeNoticeRows.length
     ? homeNoticeRows.map(x=>`<div class="item"><div class="date">${date(x.event_date)}</div><h3>${esc(x.icon||"📌")} ${esc(x.title)}</h3><div class="muted">${richDisplay(x.content||"")}</div>${sowkiReadReaction("notice",x.id)}</div>`).join("")
     : empty("Brak nowych ogłoszeń.");
 }

 // Wydarzenia
 let homeEventRows=[];
 if(eventsResult.error){
   q("#events").innerHTML=publicLoadErrorCard("wydarzeń");
 }else{
   homeEventRows=eventsResult.data||[];
   const eventCards=[];
   for(const x of homeEventRows){
     eventCards.push(`<div class="item">${multiStorageImages(x,{className:"event-photo",alt:x.title||"Wydarzenie",preview:true})}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3><p>${richDisplay(x.content||"")}</p>${sowkiReadReaction("event",x.id)}</div>`);
   }
   q("#events").innerHTML=eventCards.join("")||empty("Brak wydarzeń.");
 }

 if(!noticesResult.error || !eventsResult.error){
   setNewContentTokens("home",[
     ...(!noticesResult.error?homeNoticeRows.map(x=>`notice:${x.id}`):newContentState.home.filter(x=>String(x).startsWith("notice:"))),
     ...(!eventsResult.error?homeEventRows.map(x=>`event:${x.id}`):newContentState.home.filter(x=>String(x).startsWith("event:")))
   ]);
 }

 // Ogłoszenia
 if(announcementsResult.error){
   q("#announcements").innerHTML=publicLoadErrorCard("ogłoszeń");
 }else{
   const announcementRows=announcementsResult.data||[];
   const announcementCards=[];
   setNewContentTokens("announcementsPage",announcementRows.map(x=>`announcement:${x.id}`));
   for(const x of announcementRows){
     announcementCards.push(`<article class="item announcement">${multiStorageImages(x,{className:"announcement-photo",alt:x.title||"Ogłoszenie",preview:true})}<div class="date">${date(x.event_date)}</div><h3>${esc(x.title)}</h3>${x.description?`<div class="muted">${richDisplay(x.description)}</div>`:""}${sowkiReadReaction("announcement",x.id)}</article>`);
   }
   q("#announcements").innerHTML=announcementCards.join("")||empty("Nie ma jeszcze ogłoszeń.");
 }

 // Jadłospis
 if(menusResult.error){
   q("#menus").innerHTML=publicLoadErrorCard("jadłospisu");
 }else{
   const menuRows=menusResult.data||[];
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
 }

 // Ankiety
 if(surveysResult.error){
   q("#surveys").innerHTML=publicLoadErrorCard("ankiet");
   q("#surveyArchive").innerHTML="";
 }else{
   const surveyRows=surveysResult.data||[];
   const now=new Date(), active=[], archive=[];
   for(const x of surveyRows){
     const st=x.starts_at?new Date(x.starts_at):null,en=x.ends_at?new Date(x.ends_at):null;
     (en&&en<now?archive:(!st||st<=now?active:archive)).push(x);
   }
   const pending=active.filter(x=>localStorage.getItem(`sowki_survey_done_${x.id}`)!=="1");
   setNewContentTokens("surveysPage",pending.map(x=>`survey:${x.id}`));
   q("#surveys").innerHTML=pending.length
     ? `<div class="survey-top-note">📌 <b>Ważne:</b> Po wysłaniu odpowiedzi w formularzu prosimy o kliknięcie przycisku <b>„✅ Wypełniłem/am tę ankietę”</b>. Dziękujemy!</div>`+pending.map(x=>{const embed=surveyEmbedUrl(x.form_url);return `<article class="item survey-card" data-survey-id="${x.id}"><div class="survey-done-box"><b>Jeśli wysłałeś już odpowiedź w tej ankiecie:</b><button type="button" class="survey-done-btn" data-survey-done="${x.id}">✅ Wypełniłem/am tę ankietę</button></div><h3>${esc(x.title)}</h3>${x.ends_at?`<div class="date">Ankieta do ${formatWarsawDateTime(x.ends_at)}</div>`:""}<div class="survey-fallback">Ankieta powinna wyświetlić się poniżej. <a target="_blank" rel="noopener" href="${esc(x.form_url)}">Ankieta się nie wyświetla? Otwórz ją tutaj ↗</a></div><iframe class="survey-frame" src="${esc(embed)}" loading="lazy" allowfullscreen scrolling="no" title="${esc(x.title)}"></iframe></article>`}).join("")
     : `<div class="item survey-all-done"><h3>✅ Wypełniłeś już wszystkie ankiety, które dotychczas były dostępne.</h3><p class="muted">Gdy pojawi się nowa ankieta, zostanie tutaj automatycznie wyświetlona.</p></div>`;

   qa("[data-survey-done]").forEach(b=>b.onclick=()=>{
     localStorage.setItem(`sowki_survey_done_${b.dataset.surveyDone}`,"1");
     load();
   });

   const archiveCards=[];
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
 }

 if(!galleryCheck.error){
   setNewContentTokens("gallery",(galleryCheck.data||[]).map(x=>`gallery:${x.id}`));
 }

 bindPublicRetryButtons();
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
  else if(b.dataset.tab==="message_recipients")renderMessageRecipients();
  else if(b.dataset.tab==="owl_trips")renderOwlTripsAdmin();
  else if(b.dataset.tab==="sowki_calendar")renderSowkiCalendarAdmin();
  else render(b.dataset.tab);
});

async function renderMessageRecipients(editId=null){
  setActiveAdminTab("message_recipients");
  q("#editor").dataset.table="message_recipients";
  q("#editor").innerHTML=`<div class="admin-messages-loading">Ładowanie odbiorców…</div>`;

  const {data,error}=await sb
    .from("message_recipients")
    .select("*")
    .order("active",{ascending:false})
    .order("display_name",{ascending:true});

  if(error){
    q("#editor").innerHTML=`
      <div class="admin-order-warning">
        <b>⚠️ Nie udało się pobrać odbiorców.</b><br>
        ${esc(error.message)}<br><br>
        Uruchom plik SQL dołączony do wersji v0.6.9.
      </div>`;
    return;
  }

  const rows=data||[];
  const editRow=editId?rows.find(x=>String(x.id)===String(editId)):null;

  q("#editor").innerHTML=`
    <section class="admin-message-recipients">
      <div class="admin-content-head">
        <div>
          <h3>Odbiorcy wiadomości</h3>
          <p>Aktywne osoby otrzymują osobny e-mail po wysłaniu formularza „Napisz do Pani Kasi”. Adresy są widoczne tylko w panelu administratora.</p>
        </div>
        <span class="admin-count">${rows.filter(x=>x.active).length} aktywnych</span>
      </div>

      <div class="form recipient-form-wrap">
        <h3>${editRow?"Edytuj odbiorcę":"Dodaj odbiorcę"}</h3>
        <form id="recipientForm">
          <label>Imię / nazwa</label>
          <input name="display_name" type="text" maxlength="120" required value="${esc(editRow?.display_name||"")}">

          <label>Rola / opis</label>
          <input name="role" type="text" maxlength="120" placeholder="np. Wychowawczyni, Trójka klasowa" value="${esc(editRow?.role||"")}">

          <label>Adres e-mail</label>
          <input name="email" type="email" maxlength="254" autocomplete="off" required value="${esc(editRow?.email||"")}">

          <label class="check">
            <input name="active" type="checkbox" ${editRow?(editRow.active?"checked":""):"checked"}>
            Aktywny odbiorca
          </label>

          <input name="id" type="hidden" value="${editRow?.id||""}">
          <div class="recipient-form-actions">
            <button class="primary" type="submit">${editRow?"Zapisz zmiany":"Dodaj odbiorcę"}</button>
            ${editRow?`<button class="secondary" type="button" id="recipientCancelEdit">Anuluj</button>`:""}
          </div>
          <div id="recipientStatus" class="admin-save-status" aria-live="polite"></div>
        </form>
      </div>

      <div class="admin-recipient-list">
        ${rows.length?rows.map(x=>`
          <article class="adminitem recipient-item">
            <div class="adminitem-main">
              <div class="adminitem-title-row">
                <b>${esc(x.display_name)}</b>
                <span class="admin-status ${x.active?"is-published":"is-hidden"}">${x.active?"● Aktywny":"○ Wyłączony"}</span>
              </div>
              ${x.role?`<div class="adminitem-meta">${esc(x.role)}</div>`:""}
              <div class="recipient-email">${esc(x.email)}</div>
            </div>
            <div class="actions adminitem-actions">
              <button type="button" data-recipient-edit="${x.id}" title="Edytuj" aria-label="Edytuj">✏️</button>
              <button type="button"
                class="admin-visibility-btn ${x.active?"is-visible":"is-hidden"}"
                data-recipient-toggle="${x.id}"
                data-active="${x.active?"1":"0"}"
                title="${x.active?"Wyłącz odbiorcę":"Włącz odbiorcę"}"
                aria-label="${x.active?"Wyłącz odbiorcę":"Włącz odbiorcę"}">${x.active?"👁️":"🙈"}</button>
              <button type="button" class="danger-lite" data-recipient-delete="${x.id}" title="Usuń" aria-label="Usuń">🗑️</button>
            </div>
          </article>
        `).join(""):`<div class="admin-empty">Nie dodano jeszcze żadnych odbiorców.</div>`}
      </div>
    </section>
  `;

  q("#recipientForm").onsubmit=async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    const fd=new FormData(form);
    const status=q("#recipientStatus");
    const id=String(fd.get("id")||"").trim();

    const payload={
      display_name:String(fd.get("display_name")||"").trim(),
      role:String(fd.get("role")||"").trim()||null,
      email:String(fd.get("email")||"").trim().toLowerCase(),
      active:fd.get("active")==="on"
    };

    if(!payload.display_name||!payload.email){
      status.textContent="Uzupełnij nazwę i adres e-mail.";
      return;
    }

    status.textContent="Zapisywanie…";

    const result=id
      ? await sb.from("message_recipients").update(payload).eq("id",id)
      : await sb.from("message_recipients").insert(payload);

    if(result.error){
      status.textContent="❌ "+result.error.message;
      return;
    }

    renderMessageRecipients();
  };

  q("#recipientCancelEdit")?.addEventListener("click",()=>renderMessageRecipients());

  qa("[data-recipient-edit]").forEach(b=>b.onclick=()=>renderMessageRecipients(b.dataset.recipientEdit));

  qa("[data-recipient-toggle]").forEach(b=>b.onclick=async()=>{
    const next=b.dataset.active!=="1";
    const {error}=await sb
      .from("message_recipients")
      .update({active:next})
      .eq("id",b.dataset.recipientToggle);

    if(error){alert(error.message);return}
    renderMessageRecipients();
  });

  qa("[data-recipient-delete]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Usunąć tego odbiorcę wiadomości?"))return;

    const {error}=await sb
      .from("message_recipients")
      .delete()
      .eq("id",b.dataset.recipientDelete);

    if(error){alert(error.message);return}
    renderMessageRecipients();
  });
}

const D={monthly_notices:{title:"Najważniejsze",fields:[["title","Tytuł","text"],["content","Opis","textarea"],["event_date","Data","date"],["published","Opublikuj od razu na stronie","checkbox"]]},events:{title:"Wydarzenia",fields:[["title","Tytuł","text"],["content","Treść","textarea"],["event_date","Data","date"],["images","Zdjęcia (maksymalnie 4)","multi-file"],["published","Opublikuj od razu na stronie","checkbox"]]},menus:{title:"Jadłospis",fields:[["title","Tytuł","text"],["date_from","Od","date"],["date_to","Do","date"],["file","Zdjęcie","file"],["published","Opublikuj od razu na stronie","checkbox"]]},surveys:{title:"Ankiety",fields:[["title","Tytuł","text"],["form_url","Link do Microsoft Forms","url"],["ends_at","Koniec","datetime-local"],["file","Zdjęcie wyników ankiety","file"],["published","Opublikuj od razu na stronie","checkbox"]]},
announcements:{title:"Ogłoszenia",fields:[["title","Tytuł","text"],["description","Opis","textarea"],["event_date","Data","date"],["images","Zdjęcia ogłoszenia (maksymalnie 4)","multi-file"],["published","Opublikuj od razu na stronie","checkbox"]]},
notifications:{title:"Powiadomienia",fields:[
["title","Tytuł","text"],
["body","Treść powiadomienia","plain-textarea"],
["target_page","Wybierz gdzie ma przejść po kliknięciu w powiadomienie","select",[
["","Brak – nie przechodź do żadnej karty"],
["home","START"],
["announcementsPage","Ogłoszenia"],
["menu","Jadłospis"],
["calendar","Kalendarz"],
["surveysPage","Ankiety"],
["gallery","Galeria"],
["payments","Rozliczenia"],
["owlTripsPage","Sowie podróże"]
]],
["__send_mode","Sposób wysyłki","notification-mode"],
["__schedule","Termin wysyłki","notification-schedule"],
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
    if(x.push_sent_at)return "✅ Wysłane: "+formatWarsawDateTime(x.push_sent_at);
    if(x.scheduled_at)return "🕒 Zaplanowane: "+formatWarsawDateTime(x.scheduled_at);
    return x.created_at ? "Utworzono: "+formatWarsawDateTime(x.created_at) : "";
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

function parentMessageEmailStatus(row){
  const status=String(row?.email_status||"legacy");
  const total=Number(row?.email_recipient_count||0);
  const sent=Number(row?.email_success_count||0);

  if(status==="sent"){
    return `<span class="message-email-status is-sent">📧 E-mail wysłany${sent?` do ${sent} ${sent===1?"osoby":"osób"}`:""}</span>`;
  }

  if(status==="partial"){
    return `<span class="message-email-status is-warning">⚠️ E-mail wysłany do ${sent}/${total} odbiorców</span>`;
  }

  if(status==="failed"){
    return `<span class="message-email-status is-error" title="${esc(row?.email_error||"")}">⚠️ Błąd wysyłki e-mail</span>`;
  }

  if(status==="no_recipients"){
    return `<span class="message-email-status is-warning">ℹ️ Brak aktywnych odbiorców e-mail</span>`;
  }

  if(status==="pending"){
    return `<span class="message-email-status is-pending">⏳ Przekazywanie e-mail…</span>`;
  }

  return `<span class="message-email-status is-legacy">Starsza wiadomość</span>`;
}

function parentMessagePhone(row){
  const raw=String(row?.contact||"").trim();
  if(!raw)return `<span class="admin-parent-message-phone is-missing">☎️ Brak numeru (starsza wiadomość)</span>`;
  const tel=raw.replace(/[^\d+]/g,"");
  return `<a class="admin-parent-message-phone" href="tel:${esc(tel)}">☎️ ${esc(raw)}</a>`;
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
          <p>Rodzic/opiekun wysyła wiadomość bez logowania. W wiadomości przekazuje dane dziecka, swoje imię i nazwisko, numer telefonu oraz treść kontaktu.</p>
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
                <div class="admin-parent-message-contact">
                  ${parentMessagePhone(x)}
                </div>
                <div class="admin-parent-message-email">
                  ${parentMessageEmailStatus(x)}
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

const STATS_CONTENT_KIND={
  notice:{label:"Ważne",icon:"📌"},
  event:{label:"Wydarzenia",icon:"📰"},
  announcement:{label:"Ogłoszenia",icon:"📢"}
};

let statsDashboardState={
  range:"7",
  tab:"summary",
  customFrom:"",
  customTo:"",
  sowkaKind:"all"
};

function statsTodayWarsaw(){
  const p=warsawParts(new Date());
  return p?`${p.year}-${p.month}-${p.day}`:"";
}

function statsDateLabel(day,short=false){
  if(!day)return "";
  const m=String(day).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return String(day);
  return short?`${m[3]}.${m[2]}`:`${m[3]}.${m[2]}.${m[1]}`;
}

function statsShiftIsoDate(iso,days){
  const m=String(iso||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return iso;
  const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+Number(days||0),12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

function statsRangeDates(){
  const today=statsTodayWarsaw();
  const range=statsDashboardState.range;
  if(range==="today")return {from:today,to:today,label:"Dzisiaj"};
  if(range==="30")return {from:statsShiftIsoDate(today,-29),to:today,label:"Ostatnie 30 dni"};
  if(range==="month")return {from:`${today.slice(0,8)}01`,to:today,label:"Ten miesiąc"};
  if(range==="custom"){
    const from=statsDashboardState.customFrom||today;
    const to=statsDashboardState.customTo||today;
    return {from:from<=to?from:to,to:from<=to?to:from,label:`${statsDateLabel(from<=to?from:to)} – ${statsDateLabel(from<=to?to:from)}`};
  }
  return {from:statsShiftIsoDate(today,-6),to:today,label:"Ostatnie 7 dni"};
}

function sowkiAppOwlIcon(className="sowki-app-owl-inline"){
  return `<img src="owl-ui.svg" alt="" aria-hidden="true" class="sowki-app-owl-img ${className}">`;
}

function statsKpi(icon,label,value,sub=""){
  return `<div class="stats-kpi-v2"><span class="stats-kpi-icon">${icon}</span><div><small>${esc(label)}</small><b>${esc(value)}</b>${sub?`<em>${esc(sub)}</em>`:""}</div></div>`;
}

function statsPageMeta(page){
  return STATS_PAGES.find(x=>x[0]===page)||[page,page,"•"];
}

function statsCompactBars(rows,key,maxValue){
  if(!rows.length)return `<div class="admin-empty">Brak danych w tym okresie.</div>`;
  const max=Math.max(1,Number(maxValue)||Math.max(...rows.map(x=>Number(x[key])||0),1));
  return `<div class="stats-spark-bars">${rows.map(x=>{
    const n=Number(x[key])||0;
    const pct=Math.max(n?6:0,Math.round(n/max*100));
    return `<div class="stats-spark-col" title="${esc(statsDateLabel(x.day))}: ${n}"><span style="height:${pct}%"></span><small>${esc(statsDateLabel(x.day,true))}</small></div>`;
  }).join("")}</div>`;
}

function statsSowkaRow(x,knownDevices){
  const kind=STATS_CONTENT_KIND[String(x.content_kind)]||{label:String(x.content_kind||""),icon:sowkiAppOwlIcon("sowki-app-owl-stat-mini")};
  const count=Number(x.sowka_count)||0;
  const known=Number(x.known_devices)||Number(knownDevices)||0;
  const pct=known?Math.min(100,Math.round((count/known)*100)):0;
  return `<article class="stats-sowka-card" data-stats-sowka-kind="${esc(x.content_kind)}">
    <div class="stats-sowka-main">
      <span class="stats-sowka-owl">${sowkiAppOwlIcon("sowki-app-owl-stat-card")}</span>
      <div class="stats-sowka-copy">
        <div class="stats-sowka-meta"><span>${kind.icon} ${esc(kind.label)}</span>${x.item_date?`<time>${esc(statsDateLabel(x.item_date))}</time>`:""}</div>
        <b>${esc(x.title||`Wpis #${x.item_id}`)}</b>
        <div class="stats-sowka-progress"><span style="width:${pct}%"></span></div>
        <small>${count.toLocaleString("pl-PL")} / ${known.toLocaleString("pl-PL")} znanych urządzeń</small>
      </div>
      <strong class="stats-sowka-percent">${pct}%</strong>
    </div>
  </article>`;
}

function statsApplySowkaFilter(){
  const filter=statsDashboardState.sowkaKind||"all";
  qa("[data-stats-sowka-kind]").forEach(el=>{
    el.hidden=filter!=="all"&&el.dataset.statsSowkaKind!==filter;
  });
  qa("[data-sowka-filter]").forEach(b=>b.classList.toggle("active",b.dataset.sowkaFilter===filter));
}

async function renderStats(options={}){
  if(typeof options==="number"){
    statsDashboardState.range=String(options===30?30:options===7?7:30);
  }else if(options&&typeof options==="object"){
    Object.assign(statsDashboardState,options);
  }

  setActiveAdminTab("stats");
  q("#editor").dataset.table="stats";
  const range=statsRangeDates();

  q("#editor").innerHTML=`
    <section class="stats-panel stats-dashboard-v2">
      <div class="stats-head stats-head-v2">
        <div>
          <h3>📊 Dashboard statystyk</h3>
          <p>Anonimowe statystyki aplikacji. Urządzenie otrzymuje losowy identyfikator zapisany tylko lokalnie; w bazie przechowujemy wyłącznie jego anonimowy skrót.</p>
        </div>
        <span class="stats-range-label">${esc(range.label)}</span>
      </div>

      <div class="stats-range stats-range-v2" role="group" aria-label="Zakres statystyk">
        <button type="button" data-stats-range="today" ${statsDashboardState.range==="today"?'class="active"':""}>Dzisiaj</button>
        <button type="button" data-stats-range="7" ${statsDashboardState.range==="7"?'class="active"':""}>7 dni</button>
        <button type="button" data-stats-range="30" ${statsDashboardState.range==="30"?'class="active"':""}>30 dni</button>
        <button type="button" data-stats-range="month" ${statsDashboardState.range==="month"?'class="active"':""}>Ten miesiąc</button>
        <button type="button" data-stats-range="custom" ${statsDashboardState.range==="custom"?'class="active"':""}>📅 Zakres</button>
      </div>

      <div class="stats-custom-range" ${statsDashboardState.range==="custom"?"":"hidden"}>
        <label>Od<input type="date" id="statsFrom" value="${esc(range.from)}"></label>
        <label>Do<input type="date" id="statsTo" value="${esc(range.to)}"></label>
        <button type="button" class="primary" id="statsApplyDates">Pokaż</button>
      </div>

      <div class="stats-subtabs" role="tablist" aria-label="Rodzaj statystyk">
        <button type="button" data-stats-tab="summary" ${statsDashboardState.tab==="summary"?'class="active"':""}>📊 Podsumowanie</button>
        <button type="button" data-stats-tab="traffic" ${statsDashboardState.tab==="traffic"?'class="active"':""}>👁️ Oglądalność</button>
        <button type="button" data-stats-tab="sowki" ${statsDashboardState.tab==="sowki"?'class="active"':""}>${sowkiAppOwlIcon("sowki-app-owl-stat-tab")} Sówki</button>
      </div>

      <div id="statsContent"><div class="stats-loading">Ładowanie statystyk…</div></div>
    </section>`;

  qa("[data-stats-range]").forEach(b=>b.onclick=()=>{
    statsDashboardState.range=b.dataset.statsRange;
    renderStats();
  });
  qa("[data-stats-tab]").forEach(b=>b.onclick=()=>{
    statsDashboardState.tab=b.dataset.statsTab;
    renderStats();
  });
  const apply=q("#statsApplyDates");
  if(apply)apply.onclick=()=>{
    statsDashboardState.customFrom=q("#statsFrom")?.value||range.from;
    statsDashboardState.customTo=q("#statsTo")?.value||range.to;
    statsDashboardState.range="custom";
    renderStats();
  };

  const args={p_from:range.from,p_to:range.to};
  const [kpiRes,pageRes,dailyRes,sowkaRes]=await Promise.all([
    sb.rpc("get_stats_kpis_v2",args),
    sb.rpc("get_page_view_stats_v2",args),
    sb.rpc("get_device_activity_daily_v2",args),
    sb.rpc("get_sowka_dashboard_v2",args)
  ]);

  const errors=[kpiRes,pageRes,dailyRes,sowkaRes].map(x=>x.error).filter(Boolean);
  if(errors.length){
    q("#statsContent").innerHTML=`<div class="admin-order-warning"><b>⚠️ Dashboard wymaga aktualizacji bazy v0.7.6.</b><br>${esc(errors[0].message||"Nie udało się pobrać statystyk.")}</div>`;
    return;
  }

  const kpi=(kpiRes.data||[])[0]||{};
  const pageRows=pageRes.data||[];
  const daily=(dailyRes.data||[]).slice().sort((a,b)=>String(a.day).localeCompare(String(b.day)));
  const sowki=sowkaRes.data||[];
  const pageViews=Number(kpi.page_views)||0;
  const activeDevices=Number(kpi.active_devices)||0;
  const knownDevices=Number(kpi.known_devices)||0;
  const sowkaActions=Number(kpi.sowka_actions)||0;

  const pageMap=new Map(pageRows.map(x=>[String(x.page),x]));
  const orderedPages=STATS_PAGES.map(([page,label,icon])=>({page,label,icon,...(pageMap.get(page)||{views:0,unique_devices:0})}));
  const topPage=orderedPages.slice().sort((a,b)=>(Number(b.views)||0)-(Number(a.views)||0))[0];
  const maxPageViews=Math.max(1,...orderedPages.map(x=>Number(x.views)||0));
  const maxDailyDevices=Math.max(1,...daily.map(x=>Number(x.active_devices)||0));

  const kpis=`<div class="stats-kpis-v2">
    ${statsKpi("📱","Aktywne urządzenia",activeDevices.toLocaleString("pl-PL"),"unikalne w wybranym okresie")}
    ${statsKpi("📲","Znane urządzenia",knownDevices.toLocaleString("pl-PL"),"od uruchomienia identyfikacji")}
    ${statsKpi("👁️","Wejścia do działów",pageViews.toLocaleString("pl-PL"),"maks. 1× / dział / 24 h / urządzenie")}
    ${statsKpi(sowkiAppOwlIcon("sowki-app-owl-kpi"),"Sówki w okresie",sowkaActions.toLocaleString("pl-PL"),"oznaczenia „Przeczytane”")}
  </div>`;

  if(statsDashboardState.tab==="summary"){
    q("#statsContent").innerHTML=`
      ${kpis}
      <section class="stats-section">
        <div class="stats-section-title"><h4>Aktywne urządzenia dzień po dniu</h4><span>${daily.length} dni</span></div>
        ${statsCompactBars(daily,"active_devices",maxDailyDevices)}
      </section>
      <section class="stats-section">
        <div class="stats-section-title"><h4>Najpopularniejsze działy</h4><span>${topPage&&Number(topPage.views)>0?`${topPage.icon} ${esc(topPage.label)}`:"brak danych"}</span></div>
        <div class="stats-page-list">${orderedPages.map(x=>{
          const n=Number(x.views)||0;
          const pct=Math.round(n/maxPageViews*100);
          return `<div class="stats-page-row stats-page-row-v2"><div class="stats-page-label"><span>${x.icon}</span><b>${esc(x.label)}</b></div><div class="stats-bar"><span style="width:${pct}%"></span></div><strong>${n.toLocaleString("pl-PL")}</strong></div>`;
        }).join("")}</div>
      </section>
      <p class="stats-note">ℹ️ Statystyki liczone są jako jedno urządzenie, które może zostać policzone jako wejście do tego samego działu maksymalnie raz w ciągu kolejnych 24 godzin.</p>`;
  }else if(statsDashboardState.tab==="traffic"){
    q("#statsContent").innerHTML=`
      ${kpis}
      <section class="stats-section">
        <h4>Oglądalność działów</h4>
        <div class="stats-traffic-table">
          ${orderedPages.map(x=>`<div class="stats-traffic-row"><span>${x.icon} <b>${esc(x.label)}</b></span><span><strong>${Number(x.unique_devices||0).toLocaleString("pl-PL")}</strong><small> urządzeń</small></span><span><strong>${Number(x.views||0).toLocaleString("pl-PL")}</strong><small> wejść</small></span></div>`).join("")}
        </div>
      </section>
      <section class="stats-section">
        <div class="stats-section-title"><h4>Dzienna aktywność</h4><span>przewijana lista</span></div>
        <div class="stats-daily-scroll">${daily.slice().reverse().map(x=>`<div class="stats-daily-row"><time>${esc(statsDateLabel(x.day))}</time><span>📱 <b>${Number(x.active_devices||0).toLocaleString("pl-PL")}</b> urządzeń</span><span>👁️ <b>${Number(x.views||0).toLocaleString("pl-PL")}</b> wejść</span></div>`).join("")||`<div class="admin-empty">Brak danych.</div>`}</div>
      </section>
      <p class="stats-note">ℹ️ „Urządzenia” oznaczają anonimowe instalacje/przeglądarki. Ten sam rodzic używający telefonu i komputera będzie widoczny jako dwa urządzenia. Wyczyszczenie danych przeglądarki może utworzyć nowy anonimowy identyfikator.</p>`;
  }else{
    q("#statsContent").innerHTML=`
      ${kpis}
      <section class="stats-section">
        <div class="stats-section-title"><h4>${sowkiAppOwlIcon("sowki-app-owl-stat-heading")} Przeczytane informacje</h4><span>${sowki.length} wpisów</span></div>
        <div class="stats-sowka-filters">
          <button type="button" data-sowka-filter="all">Wszystkie</button>
          <button type="button" data-sowka-filter="notice">📌 Ważne</button>
          <button type="button" data-sowka-filter="event">📰 Wydarzenia</button>
          <button type="button" data-sowka-filter="announcement">📢 Ogłoszenia</button>
        </div>
        <div class="stats-sowka-list">${sowki.map(x=>statsSowkaRow(x,knownDevices)).join("")||`<div class="admin-empty">Brak wpisów w wybranym zakresie.</div>`}</div>
      </section>
      <p class="stats-note">ℹ️ Procent pokazuje, jaki udział wszystkich znanych anonimowych urządzeń dał Sówkę przy konkretnym wpisie. Nie zapisujemy imion rodziców ani dzieci. Liczba znanych urządzeń będzie dokładniejsza po tym, jak rodzice otworzą aplikację w wersji v0.7.6.</p>`;
    qa("[data-sowka-filter]").forEach(b=>b.onclick=()=>{statsDashboardState.sowkaKind=b.dataset.sowkaFilter;statsApplySowkaFilter()});
    statsApplySowkaFilter();
  }
}

function usesPublicMediaBucket(table){
  return ["events","menus","announcements","surveys","gallery_albums"].includes(table);
}

const R2_MEDIA_BASE=(cfg.r2MediaBase||"https://media.sowkitarczyn.pl").replace(/\/+$/,"");
const MEDIA_WORKER_URL=(cfg.mediaWorker||"https://sowki-media-upload.adrian-mencel.workers.dev").replace(/\/+$/,"");

function mediaBucketForTable(table){
  return usesPublicMediaBucket(table)
    ? (cfg.publicBucket||"sowki-public")
    : cfg.bucket;
}

function publicMediaUrl(objectPath){
  if(!objectPath)return "";
  const bucket=cfg.publicBucket||"sowki-public";
  return sb.storage.from(bucket).getPublicUrl(objectPath)?.data?.publicUrl||"";
}

function r2MediaUrl(objectPath){
  if(!objectPath)return "";
  return `${R2_MEDIA_BASE}/${String(objectPath).replace(/^\/+/,"")}`;
}

function storedMediaValue(table,objectPath){
  if(!objectPath)return "";
  return usesPublicMediaBucket(table)
    ? r2MediaUrl(objectPath)
    : objectPath;
}

function isPublicMediaUrl(path){
  const p=String(path||"");
  const bucket=cfg.publicBucket||"sowki-public";
  return p.includes(`/storage/v1/object/public/${bucket}/`);
}

function isR2MediaUrl(path){
  const p=String(path||"");
  return p===R2_MEDIA_BASE || p.startsWith(`${R2_MEDIA_BASE}/`);
}

function hasEcoPlusFileName(path){
  return /-full\.webp(?:$|\?)/i.test(String(path||""));
}

function isFullyEgressOptimized(table,path){
  if(!hasEcoPlusFileName(path))return false;
  if(usesPublicMediaBucket(table))return isR2MediaUrl(path);
  return true;
}

async function getAdminAccessToken(){
  const {data,error}=await sb.auth.getSession();
  if(error)throw new Error("Nie udało się odczytać sesji administratora.");
  const token=data?.session?.access_token;
  if(!token){
    throw new Error("Sesja administratora wygasła. Zaloguj się ponownie.");
  }
  return token;
}

async function uploadR2Object(objectPath,bytes){
  const token=await getAdminAccessToken();

  const response=await withTimeout(
    fetch(`${MEDIA_WORKER_URL}/upload`,{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${token}`,
        "Content-Type":"image/webp",
        "X-Sowki-Path":objectPath
      },
      body:bytes
    }),
    60000,
    "Wysyłanie zdjęcia do Cloudflare R2 trwało zbyt długo."
  );

  let data=null;
  try{ data=await response.json(); }catch{}

  if(!response.ok || !data?.ok){
    if(response.status===401){
      throw new Error("Sesja administratora wygasła. Wyloguj się i zaloguj ponownie.");
    }
    throw new Error(data?.error||`Cloudflare R2 zwrócił błąd ${response.status}.`);
  }

  return data;
}

async function deleteR2Object(objectPath){
  const token=await getAdminAccessToken();
  const response=await fetch(
    `${MEDIA_WORKER_URL}/delete?path=${encodeURIComponent(objectPath)}`,
    {
      method:"DELETE",
      headers:{"Authorization":`Bearer ${token}`}
    }
  );

  if(!response.ok){
    let data=null;
    try{data=await response.json();}catch{}
    throw new Error(data?.error||"Nie udało się usunąć pliku z R2.");
  }
}

function adminImageValues(table,row){
  if(!row)return [];
  if(table==="surveys")return row.results_image_url?[row.results_image_url]:[];

  if(table==="events"||table==="announcements"){
    return recordImageUrls(row);
  }

  if(["menus","gallery_albums"].includes(table)){
    return row.image_url?[row.image_url]:[];
  }

  return [];
}

function adminImagePath(table,row){
  return adminImageValues(table,row)[0]||"";
}

function adminImageColumn(table){
  return table==="surveys"?"results_image_url":"image_url";
}

function relatedEcoPaths(path){
  const p=String(path||"");
  if(!p)return [];

  if(/-full\.webp(?:$|\?)/i.test(p)){
    return [
      p,
      p.replace(/-full\.webp(?:$|\?)/i,"-thumb.webp")
    ];
  }

  return [p];
}

function r2ObjectPathFromUrl(url){
  const p=String(url||"");
  if(!isR2MediaUrl(p))return "";
  return p.slice(R2_MEDIA_BASE.length).replace(/^\/+/,"").split("?")[0];
}

function supabaseStoredObject(table,value){
  const p=String(value||"").trim();
  if(!p || isR2MediaUrl(p))return null;

  const publicBucket=cfg.publicBucket||"sowki-public";
  const privateBucket=cfg.bucket;

  if(p.startsWith("http")){
    const publicMarker=`/storage/v1/object/public/${publicBucket}/`;
    const publicIndex=p.indexOf(publicMarker);

    if(publicIndex>=0){
      return {
        bucket:publicBucket,
        path:decodeURIComponent(
          p.slice(publicIndex+publicMarker.length).split("?")[0]
        )
      };
    }

    const privateMarker=`/storage/v1/object/sign/${privateBucket}/`;
    const privateIndex=p.indexOf(privateMarker);

    if(privateIndex>=0){
      return {
        bucket:privateBucket,
        path:decodeURIComponent(
          p.slice(privateIndex+privateMarker.length).split("?")[0]
        )
      };
    }

    return null;
  }

  return {
    bucket:usesPublicMediaBucket(table)?publicBucket:privateBucket,
    path:p
  };
}

async function cleanupMediaForRecord(table,imageValue){
  const value=String(imageValue||"").trim();
  if(!value)return {ok:true,deleted:0};

  // Cloudflare R2
  if(isR2MediaUrl(value)){
    const objectPath=r2ObjectPathFromUrl(value);
    if(!objectPath)return {ok:true,deleted:0};

    const paths=relatedEcoPaths(objectPath);

    for(const p of paths){
      try{
        await deleteR2Object(p);
      }catch(e){
        console.warn("R2 cleanup failed:",p,e);
        return {ok:false,deleted:0,error:e?.message||String(e)};
      }
    }

    return {ok:true,deleted:paths.length};
  }

  // Supabase Storage
  const stored=supabaseStoredObject(table,value);
  if(!stored?.path)return {ok:true,deleted:0};

  const paths=relatedEcoPaths(stored.path);

  const result=await sb.storage
    .from(stored.bucket)
    .remove(paths);

  if(result.error){
    console.warn("Supabase cleanup failed:",result.error);
    return {ok:false,deleted:0,error:result.error.message};
  }

  return {ok:true,deleted:paths.length};
}

function adminImageFolder(table){
  return table==="events"?"events":
    table==="gallery_albums"?"gallery":
    table==="announcements"?"announcements":
    table==="surveys"?"survey-results":
    "menus";
}

function looksEcoOptimized(path){
  return hasEcoPlusFileName(path);
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

  const moveToR2=usesPublicMediaBucket(table)&&!isR2MediaUrl(path);
  const actionText=moveToR2
    ? "Przenieść ten obraz do Cloudflare R2? Aplikacja utworzy lekką wersję pełną i miniaturę, zapisze je w R2 i automatycznie podmieni adres w istniejącym wpisie."
    : "Zoptymalizować to zdjęcie? Aplikacja utworzy lekką wersję pełną oraz miniaturę do listy.";

  if(!confirm(actionText))return;

  const originalText=button?.textContent||"♻️ Optymalizuj zdjęcie";
  if(button){
    button.disabled=true;
    button.textContent=moveToR2?"Przenoszę do R2…":"Optymalizuję…";
  }

  try{
    const sourceUrl=await sign(path);
    if(!sourceUrl)throw new Error("Nie udało się przygotować dostępu do obecnego zdjęcia.");

    const response=await withTimeout(
      fetch(sourceUrl,{cache:"no-store"}),
      60000,
      "Pobieranie obecnego zdjęcia trwało zbyt długo."
    );

    if(!response.ok){
      throw new Error(`Nie udało się pobrać zdjęcia (${response.status}).`);
    }

    const blob=await response.blob();
    if(!blob.size)throw new Error("Pobrane zdjęcie jest puste.");

    const originalName=String(path).split("/").pop()?.split("?")[0]||"image.jpg";
    const file=new File([blob],originalName,{type:blob.type||"image/jpeg"});

    const setButtonStatus=text=>{
      if(button)button.textContent=text;
    };

    const eco=await prepareEcoPlusImages(file,table,setButtonStatus);

    const folder=adminImageFolder(table);
    const base=ecoBaseName(originalName);
    const stamp=Date.now();

    const fullObjectPath=`${folder}/${stamp}-${base}-full.webp`;

    setButtonStatus(usesPublicMediaBucket(table)?"Wysyłam pełny do R2…":"Wysyłam pełny…");

    if(usesPublicMediaBucket(table)){
      await uploadR2Object(fullObjectPath,eco.full.bytes);
    }else{
      const fullUpload=await withTimeout(
        sb.storage.from(cfg.bucket).upload(
          fullObjectPath,
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
    }

    if(eco.thumb){
      const thumbObjectPath=`${folder}/${stamp}-${base}-thumb.webp`;

      setButtonStatus(usesPublicMediaBucket(table)?"Wysyłam miniaturę do R2…":"Wysyłam miniaturę…");

      if(usesPublicMediaBucket(table)){
        await uploadR2Object(thumbObjectPath,eco.thumb.bytes);
      }else{
        const thumbUpload=await withTimeout(
          sb.storage.from(cfg.bucket).upload(
            thumbObjectPath,
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
    }

    setButtonStatus("Podmieniam…");

    const column=adminImageColumn(table);
    const storedValue=storedMediaValue(table,fullObjectPath);

    if(!storedValue){
      throw new Error("Nie udało się utworzyć adresu nowego zdjęcia.");
    }

    const update=await sb
      .from(table)
      .update({[column]:storedValue})
      .eq("id",id);

    if(update.error){
      throw new Error("Nie udało się podmienić wpisu: "+update.error.message);
    }

    let oldMediaCleanup={ok:true,deleted:0};

    // Po poprawnym przeniesieniu i podmianie wpisu usuwamy
    // stare pliki z Supabase, żeby nie zajmowały miejsca.
    if(moveToR2){
      oldMediaCleanup=await cleanupMediaForRecord(table,path);
    }

    const totalAfter=eco.full.size+(eco.thumb?.size||0);
    const saving=Math.max(
      0,
      Math.round((1-totalAfter/Math.max(1,eco.originalSize))*100)
    );

    alert(
      `✅ Gotowe.\n\n`+
      `${moveToR2?"Obraz został przeniesiony do Cloudflare R2 i ":"Obraz został "}zoptymalizowany do ECO+.\n\n`+
      `Oryginał: ${formatFileSize(eco.originalSize)}\n`+
      `Pełny: ${formatFileSize(eco.full.size)}\n`+
      `${eco.thumb?`Miniatura: ${formatFileSize(eco.thumb.size)}\n`:""}`+
      `Łączna oszczędność miejsca: ${saving}%\n\n`+
      `${usesPublicMediaBucket(table)?"Rodzice pobierają ten obraz z media.sowkitarczyn.pl, a nie z Supabase Storage.":"Okładka galerii jest przechowywana w Cloudflare R2."}`+
      `${moveToR2
        ? (oldMediaCleanup.ok
            ? `\n\n🧹 Stary plik w Supabase został usunięty.`
            : `\n\n⚠️ Obraz działa już z R2, ale nie udało się usunąć starego pliku z Supabase: ${oldMediaCleanup.error||"nieznany błąd"}`)
        : ""}`
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
  const sowkaKind=sowkiKindForTable(table);
  const sowkaCounts=sowkaKind?await loadAdminSowkaCounts(sowkaKind):null;

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
          const ecoOptimized=isFullyEgressOptimized(table,imagePath);
          const needsR2Move=usesPublicMediaBucket(table)&&!isR2MediaUrl(imagePath);
          return `<article class="adminitem adminitem-order">
            <div class="admin-order-controls" aria-label="Zmień kolejność">
              <button type="button" class="order-btn" data-move="up" data-id="${x.id}" ${i===0?"disabled":""} title="Przesuń wyżej" aria-label="Przesuń wyżej">↑</button>
              <button type="button" class="order-btn" data-move="down" data-id="${x.id}" ${i===rows.length-1?"disabled":""} title="Przesuń niżej" aria-label="Przesuń niżej">↓</button>
            </div>
            <div class="adminitem-main">
              <div class="adminitem-title-row">
                <b>${esc(x.title||"#"+x.id)}</b>
                <span class="admin-status ${isPublished?"is-published":"is-hidden"}">${isPublished?"● Opublikowane":"○ Ukryte"}</span>
                ${isPublished&&sowkaKind?adminSowkaCountBadge(x.id,sowkaCounts):""}
              </div>
              ${meta?`<div class="adminitem-meta">${esc(meta)}</div>`:""}
              ${imagePath&&!ecoOptimized?`
                <div class="admin-image-eco">
                  <button type="button" class="admin-image-optimize" data-optimize-image="${x.id}" data-image-path="${esc(imagePath)}">♻️ Optymalizuj obraz</button>
                </div>
              `:""}
            </div>
            <div class="actions adminitem-actions">
              <button type="button" data-e="${x.id}" title="Edytuj" aria-label="Edytuj">✏️</button>
              <button
                type="button"
                class="admin-visibility-btn ${isPublished?"is-visible":"is-hidden"}"
                data-visibility="${x.id}"
                data-published="${isPublished?"1":"0"}"
                title="${isPublished?"Ukryj w aplikacji":"Pokaż w aplikacji"}"
                aria-label="${isPublished?"Ukryj w aplikacji":"Pokaż w aplikacji"}"
              >${isPublished?"👁️":"🙈"}</button>
              <button type="button" data-d="${x.id}" class="danger-lite" title="Usuń" aria-label="Usuń">🗑️</button>
            </div>
          </article>`;
        }).join("") : `<div class="admin-empty">Nie ma jeszcze żadnych wpisów w tym dziale.</div>`}
      </div>
    </section>`;

  q("#f").onsubmit=save;
  bindRichEditors();
  bindNotificationScheduleFields();

  qa("[data-e]").forEach(b=>b.onclick=()=>render(table,b.dataset.e));

  qa("[data-visibility]").forEach(b=>b.onclick=async()=>{
    const currentlyPublished=b.dataset.published==="1";
    const nextPublished=!currentlyPublished;

    b.disabled=true;

    const result=await sb
      .from(table)
      .update({published:nextPublished})
      .eq("id",b.dataset.visibility);

    if(result.error){
      b.disabled=false;
      alert(result.error.message);
      return;
    }

    await render(table);
    await load();

    if(table==="notifications")await loadNotifications();
    if(table==="gallery_albums"&&!q("#galleryAlbums")?.hidden)await loadGallery();
  });

  qa("[data-d]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Usunąć wpis? Jeśli ma przypisane zdjęcie, zostanie ono również usunięte ze Storage."))return;

    const row=rows.find(x=>String(x.id)===String(b.dataset.d));
    const imageValues=adminImageValues(table,row);

    // Najpierw usuwamy rekord z bazy. Dzięki temu ewentualny błąd
    // czyszczenia pliku nie pozostawi wpisu wskazującego na usunięty obraz.
    const del=await sb.from(table).delete().eq("id",b.dataset.d);

    if(del.error){
      alert(del.error.message);
      return;
    }

    let cleanupErrors=[];

    for(const imageValue of imageValues){
      try{
        const cleanup=await cleanupMediaForRecord(table,imageValue);
        if(!cleanup.ok)cleanupErrors.push(cleanup.error||"Nieznany błąd.");
      }catch(e){
        cleanupErrors.push(e?.message||String(e));
      }
    }

    if(cleanupErrors.length){
      alert(
        "Wpis został usunięty, ale nie udało się usunąć wszystkich powiązanych obrazów.\n\n"+
        cleanupErrors.join("\n")
      );
    }

    render(table);
    load();

    if(table==="notifications")loadNotifications();
    if(table==="gallery_albums"&&!q("#galleryAlbums")?.hidden)loadGallery();
  });
  qa("[data-move]").forEach(b=>b.onclick=()=>moveAdminItem(table,b.dataset.id,b.dataset.move));

  qa("[data-optimize-image]").forEach(b=>b.onclick=()=>optimizeExistingAdminImage(
    table,
    b.dataset.optimizeImage,
    b.dataset.imagePath,
    b
  ));
}
function bindNotificationScheduleFields(){
  const mode=q(".notification-send-mode");
  const schedule=q(".notification-schedule-fields");
  if(!mode||!schedule)return;
  const sync=()=>{schedule.hidden=mode.value!=="scheduled"};
  mode.addEventListener("change",sync);
  sync();
}

function field(f,e){
 let[n,l,t,opts]=f,v=e?.[n]??"";
 if(t==="textarea")return richEditor(n,l,v);
 if(t==="plain-textarea"){
   const plain=notificationPlainText(v);
   return `<label>${l}</label>
     <textarea name="${n}" class="admin-plain-textarea" rows="6" maxlength="1500">${esc(plain)}</textarea>
     <div class="admin-field-note">Powiadomienia PUSH są wysyłane jako zwykły tekst – bez kolorów, pogrubienia i innych stylów.</div>`;
 }
 if(t==="notification-mode"){
   if(e?.push_sent_at){
     return `<div class="notification-sent-info">✅ To powiadomienie zostało już wysłane.</div><input type="hidden" name="send_mode" value="sent">`;
   }
   const mode=e?.scheduled_at?"scheduled":"now";
   return `<label>${l}</label>
     <select name="send_mode" class="admin-select notification-send-mode">
       <option value="now" ${mode==="now"?"selected":""}>Wyślij teraz</option>
       <option value="scheduled" ${mode==="scheduled"?"selected":""}>Zaplanuj</option>
     </select>`;
 }
 if(t==="notification-schedule"){
   if(e?.push_sent_at)return "";
   let scheduleDate="";
   let scheduleHour="08:00";
   if(e?.scheduled_at){
     const local=isoToWarsawLocal(e.scheduled_at);
     const parts=String(local||"").split("T");
     scheduleDate=parts[0]||"";
     scheduleHour=(parts[1]||"08:00").slice(0,2)+":00";
   }
   const hours=Array.from({length:24},(_,i)=>String(i).padStart(2,"0")+":00");
   return `<div class="notification-schedule-fields">
     <label>${l}</label>
     <div class="notification-schedule-grid">
       <input type="date" name="schedule_date" value="${esc(scheduleDate)}">
       <select name="schedule_hour" class="admin-select">
         ${hours.map(h=>`<option value="${h}" ${h===scheduleHour?"selected":""}>${h}</option>`).join("")}
       </select>
     </div>
     <div class="admin-field-note">Powiadomienie zostanie wysłane o wybranej pełnej godzinie.</div>
   </div>`;
 }
 if(t==="checkbox")return`<label class="check"><input type="checkbox" name="${n}" ${e?(v?"checked":""):"checked"}>${l}</label>`;
 if(t==="file")return`<label>${l}</label><input type="file" name="${n}" accept="image/*">`;
 if(t==="multi-file"){
   const existing=recordImageUrls(e);
   return `<label>${l}</label>
     <input type="file" name="${n}" accept="image/*" multiple data-max-files="4">
     <div class="admin-field-note">
       ${existing.length?`Aktualnie: ${existing.length} ${existing.length===1?"zdjęcie":"zdjęcia"}. `:""}
       Możesz wybrać od 1 do 4 zdjęć jednocześnie. Wybranie nowych zdjęć zastąpi obecny zestaw.
     </div>`;
 }
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

  // Miniatura nadal oszczędza transfer, ale ma wyższą jakość,
  // żeby tekst na jadłospisach i plakatach był wyraźniejszy.
  const thumbTextHeavy=table==="menus"||table==="announcements"||table==="events";
  const thumbMax=table==="menus"?1100:(thumbTextHeavy?900:760);
  const thumbQuality=table==="menus"?0.86:(thumbTextHeavy?0.82:0.80);

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

async function uploadAdminImageFile(table,file,setStatus,label="Zdjęcie"){
  const folder=adminImageFolder(table);

  setStatus(`Przygotowuję: ${label}…`);

  const eco=await prepareEcoPlusImages(file,table,setStatus);
  const base=ecoBaseName(file.name||"image");
  const stamp=Date.now()+"-"+Math.random().toString(36).slice(2,7);

  const fullObjectPath=`${folder}/${stamp}-${base}-full.${eco.full.ext}`;

  setStatus(
    usesPublicMediaBucket(table)
      ? `Wysyłam: ${label} (${formatFileSize(eco.full.size)})…`
      : `Wysyłam: ${label}…`
  );

  if(usesPublicMediaBucket(table)){
    if(eco.full.mime!=="image/webp"){
      throw new Error("Nie udało się przygotować obrazu WebP.");
    }
    await uploadR2Object(fullObjectPath,eco.full.bytes);
  }else{
    const fullUpload=await withTimeout(
      sb.storage.from(cfg.bucket).upload(
        fullObjectPath,
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
  }

  if(eco.thumb){
    const thumbObjectPath=`${folder}/${stamp}-${base}-thumb.webp`;

    if(usesPublicMediaBucket(table)){
      await uploadR2Object(thumbObjectPath,eco.thumb.bytes);
    }else{
      const thumbUpload=await withTimeout(
        sb.storage.from(cfg.bucket).upload(
          thumbObjectPath,
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
  }

  const storedValue=storedMediaValue(table,fullObjectPath);
  if(!storedValue)throw new Error("Nie udało się przygotować adresu zapisanego zdjęcia.");

  return storedValue;
}

function menuAutomaticNotificationTitle(menuRow){
  const from=menuRow?.date_from?date(menuRow.date_from):"";
  const to=menuRow?.date_to?date(menuRow.date_to):"";
  const range=[from,to].filter(Boolean).join(" – ");
  return range?`Aktualny jadłospis (${range})`:"Aktualny jadłospis";
}

async function createAndSendMenuNotification(menuRow,setStatus=()=>{}){
  setStatus("Tworzę powiadomienie o jadłospisie…");

  const notification={
    title:menuAutomaticNotificationTitle(menuRow),
    body:"Pojawił się aktualny jadłospis w przedszkolu na ten tydzień.",
    target_page:"menu",
    published:true,
    scheduled_at:null,
    push_sent_at:null,
    sort_order:await nextSortOrder("notifications")
  };

  const {data,error}=await sb
    .from("notifications")
    .insert(notification)
    .select()
    .single();

  if(error)throw new Error("Jadłospis zapisano, ale nie udało się utworzyć powiadomienia: "+error.message);

  setStatus("Wysyłam powiadomienie o nowym jadłospisie…");

  const sent=await withTimeout(
    sb.functions.invoke("send-push",{body:{notification_id:data.id}}),
    45000,
    "Jadłospis zapisano, ale wysyłanie automatycznego PUSH trwało zbyt długo."
  );

  if(sent.error){
    throw new Error("Jadłospis zapisano, ale automatyczna wysyłka PUSH zgłosiła błąd: "+sent.error.message);
  }

  return {
    notification:data,
    sent:Number(sent.data?.sent||0),
    failed:Number(sent.data?.failed||0)
  };
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
      if(["file","multi-file","notification-mode","notification-schedule"].includes(t))return;
      if(t==="checkbox")o[n]=fd.get(n)==="on";
      else{
        o[n]=fd.get(n)||null;
        if(t==="number"&&o[n])o[n]=+o[n];
      }
    });

    if(table==="surveys"){
      if(o.ends_at)o.ends_at=warsawLocalToISO(o.ends_at);
    }

    let notificationSendMode="";
    if(table==="notifications"){
      o.title=notificationPlainText(o.title||"");
      o.body=notificationPlainText(o.body||"");

      notificationSendMode=String(fd.get("send_mode")||"now");

      if(notificationSendMode==="scheduled"){
        const scheduleDate=String(fd.get("schedule_date")||"").trim();
        const scheduleHour=String(fd.get("schedule_hour")||"").trim();

        if(!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)){
          throw new Error("Wybierz datę wysyłki powiadomienia.");
        }
        if(!/^\d{2}:00$/.test(scheduleHour)){
          throw new Error("Wybierz pełną godzinę wysyłki.");
        }

        const scheduledISO=warsawLocalToISO(`${scheduleDate}T${scheduleHour}`);
        if(!scheduledISO||Number.isNaN(new Date(scheduledISO).getTime())){
          throw new Error("Nie udało się ustawić terminu wysyłki.");
        }
        if(new Date(scheduledISO).getTime()<=Date.now()){
          throw new Error("Termin wysyłki musi być w przyszłości.");
        }

        o.scheduled_at=scheduledISO;
        o.push_sent_at=null;
      }else if(notificationSendMode==="now"){
        o.scheduled_at=null;
        if(!id)o.push_sent_at=null;
      }else if(notificationSendMode==="sent"){
        delete o.scheduled_at;
        delete o.push_sent_at;
      }
    }

    const multiInput=form.querySelector('input[type="file"][name="images"]');
    const multiFiles=multiInput?[...multiInput.files]:[];
    let oldMultiImageValues=[];

    if(multiFiles.length){
      if(!["events","announcements"].includes(table)){
        throw new Error("Wielokrotny upload zdjęć jest niedostępny w tym dziale.");
      }

      if(multiFiles.length>4){
        throw new Error("Możesz dodać maksymalnie 4 zdjęcia do jednego wpisu.");
      }

      if(id){
        const oldRowResult=await sb
          .from(table)
          .select("image_url,image_urls")
          .eq("id",id)
          .single();

        if(oldRowResult.error){
          throw new Error("Nie udało się odczytać obecnych zdjęć wpisu: "+oldRowResult.error.message);
        }

        oldMultiImageValues=recordImageUrls(oldRowResult.data);
      }

      const uploadedValues=[];

      for(let i=0;i<multiFiles.length;i++){
        uploadedValues.push(
          await uploadAdminImageFile(
            table,
            multiFiles[i],
            setStatus,
            `zdjęcie ${i+1} z ${multiFiles.length}`
          )
        );
      }

      o.image_urls=uploadedValues;
      o.image_url=uploadedValues[0]||null;
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

      const fullObjectPath=`${folder}/${stamp}-${base}-full.${eco.full.ext}`;

      setStatus(
        usesPublicMediaBucket(table)
          ? `Wysyłam pełny obraz do Cloudflare R2 (${formatFileSize(eco.full.size)})…`
          : (
              eco.full.size<eco.originalSize
                ? `Pełny obraz: ${formatFileSize(eco.originalSize)} → ${formatFileSize(eco.full.size)}. Wysyłam…`
                : "Wysyłam pełny obraz…"
            )
      );

      if(usesPublicMediaBucket(table)){
        if(eco.full.mime!=="image/webp"){
          throw new Error("Publiczne materiały muszą być obrazem JPEG/PNG/WebP możliwym do zapisania jako WebP.");
        }
        await uploadR2Object(fullObjectPath,eco.full.bytes);
      }else{
        const fullUpload=await withTimeout(
          sb.storage.from(cfg.bucket).upload(
            fullObjectPath,
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
      }

      if(eco.thumb){
        const thumbObjectPath=`${folder}/${stamp}-${base}-thumb.webp`;

        setStatus(
          usesPublicMediaBucket(table)
            ? `Wysyłam miniaturę do R2 (${formatFileSize(eco.thumb.size)})…`
            : `Wysyłam miniaturę (${formatFileSize(eco.thumb.size)})…`
        );

        if(usesPublicMediaBucket(table)){
          await uploadR2Object(thumbObjectPath,eco.thumb.bytes);
        }else{
          const thumbUpload=await withTimeout(
            sb.storage.from(cfg.bucket).upload(
              thumbObjectPath,
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
      }

      const storedValue=storedMediaValue(table,fullObjectPath);

      if(!storedValue){
        throw new Error("Nie udało się przygotować adresu zapisanego zdjęcia.");
      }

      if(table==="surveys")o.results_image_url=storedValue;
      else o.image_url=storedValue;
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
      ? (table==="notifications"
          ? sb.from(table).update(o).eq("id",id).select().single()
          : sb.from(table).update(o).eq("id",id))
      : sb.from(table).insert(o).select().single();

    const r=await withTimeout(
      savePromise,
      30000,
      "Zapisywanie wpisu trwało zbyt długo. Sprawdź internet i spróbuj ponownie."
    );

    if(r.error)throw new Error(r.error.message);

    if(multiFiles.length&&oldMultiImageValues.length){
      const keep=new Set((o.image_urls||[]).map(String));

      for(const oldValue of oldMultiImageValues){
        if(keep.has(String(oldValue)))continue;
        const cleanup=await cleanupMediaForRecord(table,oldValue);
        if(!cleanup.ok){
          console.warn("Nie udało się usunąć starego zdjęcia po podmianie:",oldValue,cleanup.error);
        }
      }
    }

    if(table==="menus"&&!id&&r.data?.published){
      try{
        const automaticPush=await createAndSendMenuNotification(r.data,setStatus);
        alert(
          `✅ Jadłospis zapisany i automatyczne powiadomienie zostało wysłane. Urządzenia: ${automaticPush.sent}`
        );
      }catch(pushError){
        console.error("AUTO MENU PUSH ERROR:",pushError);
        alert(pushError?.message||"Jadłospis zapisano, ale nie udało się wysłać automatycznego powiadomienia.");
      }
    }

    if(table==="notifications"&&r.data){
      if(notificationSendMode==="now"&&!r.data.push_sent_at){
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
      }else if(notificationSendMode==="scheduled"){
        alert(`✅ Powiadomienie zaplanowane na ${formatWarsawDateTime(r.data.scheduled_at)}.`);
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


// =========================================================
// v0.8.1 — natywny Kalendarz Sówki: większe ikony kategorii i łączone wydarzenia wielodniowe
// Moduł pozostaje niezależny od „Wydarzeń przedszkolaków”.
// =========================================================

const SOWKI_CALENDAR_CATEGORIES={
  ogolne:{label:"Ogólne",className:"cat-ogolne",icon:"💗"},
  urodziny:{label:"Urodziny",className:"cat-urodziny",icon:"🟢"},
  swieta:{label:"Święta",className:"cat-swieta",icon:"🟡"},
  dyzury:{label:"Dyżury",className:"cat-dyzury",icon:"⚫"}
};

let sowkiCalendarMonthStart=null;
let sowkiCalendarSelectedDate=null;
let sowkiCalendarMonthRows=[];
let sowkiCalendarUpcomingRows=[];
let sowkiCalendarLoadedMonthKey="";

function calendarLocalToday(){
  return statsTodayWarsaw();
}

function calendarIsoFromDateUTC(d){
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

function calendarParseIso(iso){
  const m=String(iso||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return null;
  return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),12));
}

function calendarShiftIso(iso,days){
  const d=calendarParseIso(iso);
  if(!d)return "";
  d.setUTCDate(d.getUTCDate()+Number(days||0));
  return calendarIsoFromDateUTC(d);
}

function calendarAnnualOccurrenceDate(sourceIso,year){
  const source=calendarParseIso(sourceIso);
  if(!source)return "";

  const month=source.getUTCMonth();
  const day=source.getUTCDate();
  let occurrence=new Date(Date.UTC(Number(year),month,day,12));

  // 29 lutego w roku nieprzestępnym pokazujemy 28 lutego.
  if(occurrence.getUTCMonth()!==month || occurrence.getUTCDate()!==day){
    if(month===1 && day===29){
      occurrence=new Date(Date.UTC(Number(year),1,28,12));
    }else{
      return "";
    }
  }

  return calendarIsoFromDateUTC(occurrence);
}

function calendarYearlyOccurrence(row,year){
  if(!row?.repeats_yearly)return {...row};

  const occurrence=calendarAnnualOccurrenceDate(row.date_from,year);
  if(!occurrence)return null;

  return {
    ...row,
    source_date_from:row.date_from,
    source_date_to:row.date_to,
    date_from:occurrence,
    date_to:occurrence,
    occurrence_date:occurrence
  };
}

function calendarNextOccurrence(row,fromIso=calendarLocalToday()){
  if(!row?.repeats_yearly)return {...row};

  const from=calendarParseIso(fromIso);
  if(!from)return calendarYearlyOccurrence(row,new Date().getUTCFullYear());

  let year=from.getUTCFullYear();
  let occurrence=calendarYearlyOccurrence(row,year);

  if(!occurrence)return null;
  if(String(occurrence.date_from)<String(fromIso)){
    occurrence=calendarYearlyOccurrence(row,year+1);
  }

  return occurrence;
}

function calendarSortRows(a,b){
  const byDate=String(a?.date_from||"").localeCompare(String(b?.date_from||""));
  if(byDate!==0)return byDate;

  const ta=String(a?.event_time||"");
  const tb=String(b?.event_time||"");
  const byTime=ta.localeCompare(tb);
  if(byTime!==0)return byTime;

  return Number(a?.id||0)-Number(b?.id||0);
}

function calendarMonthStartFromIso(iso){
  const d=calendarParseIso(iso)||new Date();
  return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1,12));
}

function calendarMonthKey(d){
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`;
}

function calendarMonthName(d){
  const value=new Intl.DateTimeFormat("pl-PL",{
    month:"long",
    year:"numeric",
    timeZone:"UTC"
  }).format(d);
  return value.charAt(0).toUpperCase()+value.slice(1);
}

function calendarPolishDate(iso,withWeekday=false){
  const d=calendarParseIso(iso);
  if(!d)return "";
  return new Intl.DateTimeFormat("pl-PL",{
    ...(withWeekday?{weekday:"long"}:{}),
    day:"numeric",
    month:"long",
    year:"numeric",
    timeZone:"UTC"
  }).format(d);
}

function calendarCompactDate(iso){
  const d=calendarParseIso(iso);
  if(!d)return "";
  return new Intl.DateTimeFormat("pl-PL",{
    day:"2-digit",
    month:"2-digit",
    timeZone:"UTC"
  }).format(d);
}

function calendarRangeLaneMap(rows){
  const multi=(rows||[])
    .filter(row=>String(row?.date_to||row?.date_from)>String(row?.date_from||""))
    .slice()
    .sort((a,b)=>{
      const byStart=String(a.date_from||"").localeCompare(String(b.date_from||""));
      if(byStart!==0)return byStart;

      // Przy tym samym starcie dłuższy zakres dostaje poziom jako pierwszy.
      const byEnd=String(b.date_to||b.date_from||"").localeCompare(String(a.date_to||a.date_from||""));
      if(byEnd!==0)return byEnd;

      return Number(a.id||0)-Number(b.id||0);
    });

  const laneEnds=[];
  const map=new Map();

  for(const row of multi){
    const start=String(row.date_from||"");
    const end=String(row.date_to||row.date_from||"");

    let lane=laneEnds.findIndex(lastEnd=>String(lastEnd)<start);
    if(lane<0)lane=laneEnds.length;

    laneEnds[lane]=end;
    map.set(String(row.id),lane);
  }

  return map;
}

function calendarRangeLabel(row){
  const a=String(row?.date_from||"");
  const b=String(row?.date_to||a);
  if(!a)return "";
  if(!b||a===b)return calendarPolishDate(a,true);
  return `${calendarPolishDate(a)} – ${calendarPolishDate(b)}`;
}

function calendarTimeLabel(row){
  return row?.all_day||!row?.event_time ? "Cały dzień" : String(row.event_time).slice(0,5);
}

function calendarCategory(row){
  return SOWKI_CALENDAR_CATEGORIES[String(row?.category||"ogolne")]||SOWKI_CALENDAR_CATEGORIES.ogolne;
}

function calendarEventIncludesDate(row,iso){
  const from=String(row?.date_from||"");
  const to=String(row?.date_to||from);
  return Boolean(from&&from<=iso&&iso<=to);
}

function calendarEventsForDate(iso){
  return sowkiCalendarMonthRows.filter(row=>calendarEventIncludesDate(row,iso));
}

function calendarMonthBounds(d){
  return {
    first:calendarIsoFromDateUTC(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1,12))),
    last:calendarIsoFromDateUTC(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)))
  };
}

function calendarNormalizeState(){
  const today=calendarLocalToday();
  if(!sowkiCalendarMonthStart)sowkiCalendarMonthStart=calendarMonthStartFromIso(today);

  if(!sowkiCalendarSelectedDate){
    const key=calendarMonthKey(sowkiCalendarMonthStart);
    sowkiCalendarSelectedDate=today.startsWith(key)?today:`${key}-01`;
  }
}

async function loadSowkiCalendarMonth(force=false){
  calendarNormalizeState();

  const key=calendarMonthKey(sowkiCalendarMonthStart);
  const bounds=calendarMonthBounds(sowkiCalendarMonthStart);
  const title=q("#calendarMonthTitle");
  if(title)title.textContent=calendarMonthName(sowkiCalendarMonthStart);

  if(!force&&sowkiCalendarLoadedMonthKey===key){
    renderSowkiCalendar();
    return;
  }

  const grid=q("#calendarGrid");
  if(grid)grid.innerHTML=`<div class="calendar-loading">Ładowanie kalendarza…</div>`;

  const [monthResult,upcomingResult,yearlyResult]=await Promise.all([
    publicQueryWithRetry(
      "kalendarza",
      ()=>sb.from("sowki_calendar")
        .select("*")
        .eq("published",true)
        .eq("repeats_yearly",false)
        .lte("date_from",bounds.last)
        .gte("date_to",bounds.first)
        .order("date_from",{ascending:true})
        .order("id",{ascending:true})
    ),
    publicQueryWithRetry(
      "najbliższych terminów kalendarza",
      ()=>sb.from("sowki_calendar")
        .select("*")
        .eq("published",true)
        .eq("repeats_yearly",false)
        .gte("date_to",calendarLocalToday())
        .order("date_from",{ascending:true})
        .order("id",{ascending:true})
        .limit(6)
    ),
    publicQueryWithRetry(
      "wydarzeń corocznych",
      ()=>sb.from("sowki_calendar")
        .select("*")
        .eq("published",true)
        .eq("repeats_yearly",true)
        .order("date_from",{ascending:true})
        .order("id",{ascending:true})
    )
  ]);

  if(monthResult.error){
    if(grid)grid.innerHTML=publicLoadErrorCard("kalendarza");
    return;
  }

  const yearlyRows=yearlyResult.error?[]:(yearlyResult.data||[]);
  const monthYear=sowkiCalendarMonthStart.getUTCFullYear();

  const yearlyInMonth=yearlyRows
    .map(row=>calendarYearlyOccurrence(row,monthYear))
    .filter(Boolean)
    .filter(row=>String(row.date_from)>=bounds.first && String(row.date_from)<=bounds.last);

  sowkiCalendarMonthRows=[
    ...(monthResult.data||[]),
    ...yearlyInMonth
  ].sort(calendarSortRows);

  const today=calendarLocalToday();

  const yearlyUpcoming=yearlyRows
    .map(row=>calendarNextOccurrence(row,today))
    .filter(Boolean)
    .filter(row=>String(row.date_to||row.date_from)>=today);

  sowkiCalendarUpcomingRows=[
    ...(upcomingResult.error?[]:(upcomingResult.data||[])),
    ...yearlyUpcoming
  ]
    .sort(calendarSortRows)
    .slice(0,3);

  sowkiCalendarLoadedMonthKey=key;
  renderSowkiCalendar();
}

function renderSowkiCalendar(){
  calendarNormalizeState();

  const d=sowkiCalendarMonthStart;
  const y=d.getUTCFullYear();
  const m=d.getUTCMonth();
  const first=new Date(Date.UTC(y,m,1,12));
  const mondayIndex=(first.getUTCDay()+6)%7;
  const today=calendarLocalToday();

  const monthTitle=q("#calendarMonthTitle");
  if(monthTitle)monthTitle.textContent=calendarMonthName(d);

  const cells=[];
  const rangeLaneMap=calendarRangeLaneMap(sowkiCalendarMonthRows);

  for(let i=0;i<42;i++){
    const relativeDay=i-mondayIndex+1;
    const cellDate=new Date(Date.UTC(y,m,relativeDay,12));
    const iso=calendarIsoFromDateUTC(cellDate);
    const inMonth=cellDate.getUTCMonth()===m;
    const events=calendarEventsForDate(iso);
    const categories=[...new Set(events.map(x=>String(x.category||"ogolne")))].slice(0,3);
    const weekday=cellDate.getUTCDay();
    const isWeekend=weekday===0||weekday===6;

    const multiDayEvents=events
      .filter(row=>String(row.date_to||row.date_from)>String(row.date_from||""))
      .map(row=>({row,lane:rangeLaneMap.get(String(row.id))??0}))
      .filter(item=>item.lane<3)
      .sort((a,b)=>a.lane-b.lane);

    const rangeBars=multiDayEvents.map(({row,lane})=>{
      const cat=calendarCategory(row);
      const prevIso=calendarShiftIso(iso,-1);
      const nextIso=calendarShiftIso(iso,1);
      const continuesLeft=(i%7!==0)&&calendarEventIncludesDate(row,prevIso);
      const continuesRight=(i%7!==6)&&calendarEventIncludesDate(row,nextIso);
      const isStart=!continuesLeft;
      const isEnd=!continuesRight;

      return `<span
        class="calendar-range-bar calendar-range-pill ${cat.className}${continuesLeft?" continues-left":""}${continuesRight?" continues-right":""}${isStart?" is-start":""}${isEnd?" is-end":""}"
        style="--calendar-range-index:${lane}"
        title="${esc(row.title)}">
          ${isStart?`<i class="calendar-range-pill-icon">${cat.icon}</i>`:""}
        </span>`;
    }).join("");

    cells.push(`
      <button type="button"
        class="calendar-day${inMonth?"":" is-outside"}${isWeekend?" is-weekend":""}${iso===today?" is-today":""}${iso===sowkiCalendarSelectedDate?" is-selected":""}${events.length?" has-events":""}"
        data-calendar-date="${iso}">
        <span class="calendar-day-head">
          <span class="calendar-day-number">${cellDate.getUTCDate()}</span>
          ${iso===today?`<span class="calendar-today-mini">dziś</span>`:""}
        </span>
        <span class="calendar-day-icons">
          ${categories.map(cat=>{
            const meta=SOWKI_CALENDAR_CATEGORIES[cat]||SOWKI_CALENDAR_CATEGORIES.ogolne;
            return `<i class="calendar-day-icon ${meta.className}" title="${esc(meta.label)}">${meta.icon}</i>`;
          }).join("")}
        </span>
        ${rangeBars}
      </button>`);
  }

  q("#calendarGrid").innerHTML=cells.join("");

  qa("[data-calendar-date]").forEach(btn=>btn.onclick=()=>{
    const iso=String(btn.dataset.calendarDate||"");
    const clicked=calendarParseIso(iso);

    if(clicked&&clicked.getUTCMonth()!==sowkiCalendarMonthStart.getUTCMonth()){
      sowkiCalendarMonthStart=new Date(Date.UTC(clicked.getUTCFullYear(),clicked.getUTCMonth(),1,12));
      sowkiCalendarSelectedDate=iso;
      sowkiCalendarLoadedMonthKey="";
      loadSowkiCalendarMonth();
      return;
    }

    sowkiCalendarSelectedDate=iso;
    renderSowkiCalendar();
  });

  renderSowkiCalendarUpcoming();
  renderSowkiCalendarSelectedDay();
}

function calendarCardDateTile(iso,label=""){
  const d=calendarParseIso(iso);
  if(!d)return "";

  const day=d.getUTCDate();
  const month=new Intl.DateTimeFormat("pl-PL",{
    month:"short",
    timeZone:"UTC"
  }).format(d).replace(".","");

  return `
    <span class="calendar-event-date-tile">
      ${label?`<small class="calendar-event-date-label">${esc(label)}</small>`:""}
      <strong>${day}</strong>
      <small class="calendar-event-date-month">${esc(month)}</small>
    </span>`;
}

function calendarEventDateVisual(row){
  const from=String(row?.date_from||"");
  const to=String(row?.date_to||from);
  const isRange=Boolean(from&&to&&to>from);

  if(!isRange){
    return `<span class="calendar-event-date-visual is-single">${calendarCardDateTile(from)}</span>`;
  }

  return `
    <span class="calendar-event-date-visual is-range">
      ${calendarCardDateTile(from,"OD")}
      <span class="calendar-event-date-arrow" aria-hidden="true">→</span>
      ${calendarCardDateTile(to,"DO")}
    </span>`;
}

function calendarEventCard(row){
  const cat=calendarCategory(row);
  return `
    <button type="button" class="calendar-event-card ${cat.className}${String(row.date_to||row.date_from)>String(row.date_from||"")?" has-date-range":""}" data-calendar-event="${row.id}">
      ${calendarEventDateVisual(row)}
      <span class="calendar-event-content">
        <span class="calendar-event-title">${esc(row.title)}</span>
        <span class="calendar-event-meta">
          <i class="calendar-category-emoji">${cat.icon}</i>
          ${esc(cat.label)} • ${esc(calendarTimeLabel(row))}${row.repeats_yearly?" • 🔁 Co roku":""}
        </span>
        ${row.description?`<span class="calendar-event-desc">${esc(row.description).replace(/\n/g," ")}</span>`:""}
      </span>
      <span class="calendar-event-arrow">›</span>
    </button>`;
}

function bindCalendarEventCards(){
  qa("[data-calendar-event]").forEach(btn=>btn.onclick=()=>{
    const id=String(btn.dataset.calendarEvent||"");
    const row=[...sowkiCalendarMonthRows,...sowkiCalendarUpcomingRows]
      .find(x=>String(x.id)===id);

    if(row)openSowkiCalendarEvent(row);
  });
}

function renderSowkiCalendarUpcoming(){
  const box=q("#calendarUpcoming");
  const count=q("#calendarUpcomingCount");
  if(!box||!count)return;

  count.textContent=sowkiCalendarUpcomingRows.length
    ?`${sowkiCalendarUpcomingRows.length} ${sowkiCalendarUpcomingRows.length===1?"najbliższy":"najbliższe"}`
    :"";

  box.innerHTML=sowkiCalendarUpcomingRows.length
    ?sowkiCalendarUpcomingRows.map(calendarEventCard).join("")
    :`<div class="calendar-empty">Brak nadchodzących terminów.</div>`;

  bindCalendarEventCards();
}

function renderSowkiCalendarSelectedDay(){
  const box=q("#calendarSelectedEvents");
  const label=q("#calendarSelectedLabel");
  if(!box||!label)return;

  const iso=sowkiCalendarSelectedDate;
  label.textContent=calendarPolishDate(iso);

  const rows=calendarEventsForDate(iso);
  box.innerHTML=rows.length
    ?rows.map(calendarEventCard).join("")
    :`<div class="calendar-empty">W tym dniu nie ma wpisów w kalendarzu.</div>`;

  bindCalendarEventCards();
}

function ensureSowkiCalendarDialog(){
  let dlg=q("#sowkiCalendarEventDlg");
  if(dlg)return dlg;

  dlg=document.createElement("dialog");
  dlg.id="sowkiCalendarEventDlg";
  dlg.className="calendar-event-dialog";
  dlg.innerHTML=`
    <div class="calendar-dialog-card">
      <button type="button" class="calendar-dialog-close" aria-label="Zamknij">×</button>
      <div id="sowkiCalendarDialogBody"></div>
    </div>`;

  document.body.appendChild(dlg);
  dlg.querySelector(".calendar-dialog-close").onclick=()=>dlg.close();
  dlg.onclick=e=>{if(e.target===dlg)dlg.close()};
  return dlg;
}

function openSowkiCalendarEvent(row){
  const dlg=ensureSowkiCalendarDialog();
  const cat=calendarCategory(row);
  const body=dlg.querySelector("#sowkiCalendarDialogBody");

  body.innerHTML=`
    <div class="calendar-detail-head">
      <div class="calendar-detail-category ${cat.className}">
        <i class="calendar-category-emoji">${cat.icon}</i>${esc(cat.label)}
      </div>
      <h2>${esc(row.title)}</h2>
    </div>

    <div class="calendar-detail-facts">
      <div><span>📅</span><b>Data</b><p>${esc(calendarRangeLabel(row))}</p></div>
      <div><span>🕒</span><b>Godzina</b><p>${esc(calendarTimeLabel(row))}</p></div>
    </div>

    ${row.description?`
      <div class="calendar-detail-description">
        ${esc(row.description).replace(/\n/g,"<br>")}
      </div>`:""}
`;

  dlg.showModal();
}

function initSowkiCalendarControls(){
  q("#calendarPrev")?.addEventListener("click",()=>{
    calendarNormalizeState();
    sowkiCalendarMonthStart=new Date(Date.UTC(
      sowkiCalendarMonthStart.getUTCFullYear(),
      sowkiCalendarMonthStart.getUTCMonth()-1,
      1,12
    ));
    sowkiCalendarSelectedDate=`${calendarMonthKey(sowkiCalendarMonthStart)}-01`;
    sowkiCalendarLoadedMonthKey="";
    loadSowkiCalendarMonth();
  });

  q("#calendarNext")?.addEventListener("click",()=>{
    calendarNormalizeState();
    sowkiCalendarMonthStart=new Date(Date.UTC(
      sowkiCalendarMonthStart.getUTCFullYear(),
      sowkiCalendarMonthStart.getUTCMonth()+1,
      1,12
    ));
    sowkiCalendarSelectedDate=`${calendarMonthKey(sowkiCalendarMonthStart)}-01`;
    sowkiCalendarLoadedMonthKey="";
    loadSowkiCalendarMonth();
  });

  q("#calendarToday")?.addEventListener("click",()=>{
    const today=calendarLocalToday();
    sowkiCalendarMonthStart=calendarMonthStartFromIso(today);
    sowkiCalendarSelectedDate=today;
    sowkiCalendarLoadedMonthKey="";
    loadSowkiCalendarMonth();
  });
}

initSowkiCalendarControls();

function calendarAdminReminderLabel(row){
  if(!row.reminder_enabled){
    return `<span class="admin-status calendar-reminder-off">🔕 Przypomnienie wyłączone</span>`;
  }

  const today=calendarLocalToday();
  const occurrence=row.repeats_yearly
    ?calendarNextOccurrence(row,today)
    :row;

  const occurrenceDate=String(occurrence?.date_from||row.date_from||"");
  const sentFor=String(row.reminder_sent_for_date||"");

  if(sentFor && sentFor===occurrenceDate && row.reminder_sent_at){
    return `<span class="admin-status calendar-reminder-sent">✅ PUSH wysłany: ${esc(formatWarsawDateTime(row.reminder_sent_at))}</span>`;
  }

  // Zgodność ze starymi wpisami jednorazowymi sprzed v0.8.8.
  if(!row.repeats_yearly && row.reminder_sent_at && !row.reminder_sent_for_date){
    return `<span class="admin-status calendar-reminder-sent">✅ PUSH wysłany: ${esc(formatWarsawDateTime(row.reminder_sent_at))}</span>`;
  }

  if(occurrenceDate && occurrenceDate<=today){
    return `<span class="admin-status calendar-reminder-missed">⚠️ Przypomnienie niewysłane</span>`;
  }

  return `<span class="admin-status calendar-reminder-planned">🔔 Dzień wcześniej • 18:00</span>`;
}

function calendarAdminDateText(row){
  return row.all_day
    ?calendarRangeLabel(row)
    :`${calendarRangeLabel(row)} • ${calendarTimeLabel(row)}`;
}

async function renderSowkiCalendarAdmin(editId=null){
  setActiveAdminTab("sowki_calendar");
  q("#editor").dataset.table="sowki_calendar";
  q("#editor").innerHTML=`<div class="admin-messages-loading">Ładowanie kalendarza…</div>`;

  const {data,error}=await sb
    .from("sowki_calendar")
    .select("*")
    .order("date_from",{ascending:true})
    .order("id",{ascending:true});

  if(error){
    q("#editor").innerHTML=`
      <div class="admin-order-warning">
        <b>⚠️ Nie udało się pobrać kalendarza.</b><br>
        ${esc(error.message)}
      </div>`;
    return;
  }

  const rows=data||[];
  const edit=editId?rows.find(x=>String(x.id)===String(editId)):null;
  const today=calendarLocalToday();

  q("#editor").innerHTML=`
    <div class="form calendar-admin-form" id="calendarAdminFormPanel">
      <div class="calendar-admin-form-head">
        <div>
          <h3>${edit?"Edytuj wpis":"Dodaj wpis do kalendarza"}</h3>
          
        </div>
        ${edit?`<button type="button" class="secondary" id="calendarAdminCancel">Anuluj edycję</button>`:""}
      </div>

      <form id="calendarAdminForm">
        <input type="hidden" name="id" value="${edit?.id||""}">

        <label>Tytuł
          <input type="text" name="title" maxlength="160" value="${esc(edit?.title||"")}" required placeholder="Np. Teatrzyk dla dzieci 🎭">
        </label>

        <label>Opis
          <textarea name="description" rows="4" maxlength="2000" placeholder="Dodatkowe informacje dla rodziców…">${esc(edit?.description||"")}</textarea>
        </label>

        ${(()=>{
          const isMultiDay=Boolean(edit && String(edit.date_to||edit.date_from)>String(edit.date_from||""));
          return `
            <div class="calendar-admin-date-grid">
              <label>
                <span id="calendarDateFromLabel">${isMultiDay?"Data od":"Data wydarzenia"}</span>
                <input type="date" name="date_from" value="${esc(edit?.date_from||"")}" required>
              </label>

              <label id="calendarDateToWrap" class="calendar-date-to-wrap" ${isMultiDay?"":"hidden"}>
                Data do
                <input type="date" name="date_to" value="${esc(edit?.date_to||edit?.date_from||"")}">
              </label>

              <label>Godzina
                <input type="time" name="event_time" value="${esc(edit?.event_time?String(edit.event_time).slice(0,5):"")}">
              </label>
            </div>

            <label class="check calendar-multiday-check">
              <input type="checkbox" name="multi_day" ${isMultiDay?"checked":""}>
              Wydarzenie trwa kilka dni
            </label>`;
        })()}

        <label class="check">
          <input type="checkbox" name="all_day" ${edit?(edit.all_day?"checked":""):"checked"}>
          Wydarzenie całodniowe
        </label>

        <fieldset class="calendar-category-fieldset">
          <legend>Kategoria</legend>
          <div class="calendar-category-picker">
            ${Object.entries(SOWKI_CALENDAR_CATEGORIES).map(([key,meta])=>`
              <label class="calendar-category-option ${meta.className}">
                <input type="radio" name="category" value="${key}" ${String(edit?.category||"ogolne")===key?"checked":""} required>
                <span>
                  <i class="calendar-category-picker-icon">${meta.icon}</i>
                  <b>${esc(meta.label)}</b>
                </span>
              </label>`).join("")}
          </div>
        </fieldset>

        <div class="calendar-admin-options">
          <label class="check calendar-yearly-check">
            <input type="checkbox" name="repeats_yearly" ${edit?.repeats_yearly?"checked":""}>
            🔁 Powtarzaj co roku
          </label>

          <label class="check">
            <input type="checkbox" name="reminder_enabled" ${edit?(edit.reminder_enabled?"checked":""):"checked"}>
            🔔 Wyślij przypomnienie dzień wcześniej o 18:00
          </label>

          <label class="check">
            <input type="checkbox" name="published" ${edit?(edit.published?"checked":""):"checked"}>
            Opublikuj w kalendarzu
          </label>
        </div>

        <button class="primary calendar-admin-save" type="submit">${edit?"Zapisz zmiany":"Dodaj do kalendarza"}</button>
        <div class="admin-save-status" aria-live="polite"></div>
      </form>
    </div>

    <section class="calendar-admin-manager">
      <div class="admin-content-head">
        <div>
          <h3>📅 Kalendarz Sówki</h3>
          
        </div>
        <span class="admin-count">${rows.length} ${rows.length===1?"wpis":"wpisów"}</span>
      </div>

      <div class="calendar-admin-list">
        ${rows.length?rows.map(row=>{
          const cat=calendarCategory(row);
          const isPast=!row.repeats_yearly && String(row.date_to||row.date_from)<today;
          return `
            <article class="calendar-admin-row ${isPast?"is-past":""}">
              <div class="calendar-admin-main">
                <div class="calendar-admin-title-line">
                  <i class="calendar-category-emoji calendar-admin-category-emoji">${cat.icon}</i>
                  <b>${esc(row.title)}</b>
                  <span class="admin-status ${row.published?"is-published":"is-hidden"}">${row.published?"● Widoczny":"○ Ukryty"}</span>
                  ${row.repeats_yearly?`<span class="admin-status calendar-yearly-badge">🔁 Co roku</span>`:""}
                  ${calendarAdminReminderLabel(row)}
                </div>
                <div class="calendar-admin-meta">
                  ${esc(calendarAdminDateText(row))} • ${esc(cat.label)}
                </div>
                ${row.description?`<div class="calendar-admin-desc">${esc(row.description).replace(/\n/g," ")}</div>`:""}
              </div>
              <div class="actions adminitem-actions">
                <button type="button" data-calendar-admin-edit="${row.id}" title="Edytuj" aria-label="Edytuj">✏️</button>
                <button type="button" data-calendar-admin-visibility="${row.id}" data-published="${row.published?"1":"0"}" title="${row.published?"Ukryj":"Pokaż"}" aria-label="${row.published?"Ukryj":"Pokaż"}">${row.published?"👁️":"🙈"}</button>
                <button type="button" data-calendar-admin-delete="${row.id}" class="danger-lite" title="Usuń" aria-label="Usuń">🗑️</button>
              </div>
            </article>`;
        }).join(""):`<div class="admin-empty">Nie ma jeszcze żadnych wpisów w kalendarzu.</div>`}
      </div>
    </section>

  `;

  const form=q("#calendarAdminForm");
  const allDay=form.querySelector('[name="all_day"]');
  const timeInput=form.querySelector('[name="event_time"]');
  const multiDay=form.querySelector('[name="multi_day"]');
  const yearly=form.querySelector('[name="repeats_yearly"]');
  const dateFromInput=form.querySelector('[name="date_from"]');
  const dateToInput=form.querySelector('[name="date_to"]');
  const dateToWrap=q("#calendarDateToWrap");
  const dateFromLabel=q("#calendarDateFromLabel");

  const syncTime=()=>{
    timeInput.disabled=allDay.checked;
    if(allDay.checked)timeInput.value="";
  };

  const syncMultiDay=()=>{
    const enabled=Boolean(multiDay?.checked);

    if(dateToWrap)dateToWrap.hidden=!enabled;
    if(dateFromLabel)dateFromLabel.textContent=enabled?"Data od":"Data wydarzenia";

    if(yearly){
      yearly.disabled=enabled;
      if(enabled)yearly.checked=false;
    }

    if(dateToInput){
      dateToInput.required=enabled;

      if(enabled){
        if(!dateToInput.value){
          dateToInput.value=dateFromInput?.value||"";
        }
        if(dateFromInput?.value && dateToInput.value<dateFromInput.value){
          dateToInput.value=dateFromInput.value;
        }
      }else{
        dateToInput.value=dateFromInput?.value||"";
      }
    }
  };

  allDay.addEventListener("change",syncTime);
  multiDay?.addEventListener("change",syncMultiDay);

  yearly?.addEventListener("change",()=>{
    if(yearly.checked && multiDay?.checked){
      multiDay.checked=false;
      syncMultiDay();
    }
  });

  dateFromInput?.addEventListener("change",()=>{
    if(!multiDay?.checked){
      if(dateToInput)dateToInput.value=dateFromInput.value;
    }else if(dateToInput && (!dateToInput.value || dateToInput.value<dateFromInput.value)){
      dateToInput.value=dateFromInput.value;
    }
  });

  syncTime();
  syncMultiDay();

  form.onsubmit=saveSowkiCalendarAdmin;

  q("#calendarAdminCancel")?.addEventListener("click",()=>renderSowkiCalendarAdmin());

  qa("[data-calendar-admin-edit]").forEach(btn=>btn.onclick=async()=>{
    await renderSowkiCalendarAdmin(btn.dataset.calendarAdminEdit);
    q("#calendarAdminFormPanel")?.scrollIntoView({behavior:"smooth",block:"start"});
  });

  qa("[data-calendar-admin-visibility]").forEach(btn=>btn.onclick=async()=>{
    const next=btn.dataset.published!=="1";
    const {error}=await sb.from("sowki_calendar")
      .update({published:next,updated_at:new Date().toISOString()})
      .eq("id",btn.dataset.calendarAdminVisibility);

    if(error){alert(error.message);return}

    sowkiCalendarLoadedMonthKey="";
    await renderSowkiCalendarAdmin();

    if(q("#calendar")?.classList.contains("active")){
      await loadSowkiCalendarMonth(true);
    }
  });

  qa("[data-calendar-admin-delete]").forEach(btn=>btn.onclick=async()=>{
    if(!confirm("Usunąć ten wpis z kalendarza?"))return;

    const {error}=await sb.from("sowki_calendar")
      .delete()
      .eq("id",btn.dataset.calendarAdminDelete);

    if(error){alert(error.message);return}

    sowkiCalendarLoadedMonthKey="";
    await renderSowkiCalendarAdmin();

    if(q("#calendar")?.classList.contains("active")){
      await loadSowkiCalendarMonth(true);
    }
  });
}

async function saveSowkiCalendarAdmin(ev){
  ev.preventDefault();

  const form=ev.target;
  const fd=new FormData(form);
  const id=String(fd.get("id")||"");
  const btn=form.querySelector(".calendar-admin-save");
  const status=form.querySelector(".admin-save-status");

  const dateFrom=String(fd.get("date_from")||"");
  const multiDay=fd.get("multi_day")==="on";
  const dateTo=multiDay
    ?String(fd.get("date_to")||dateFrom)
    :dateFrom;
  const allDay=fd.get("all_day")==="on";

  const payload={
    title:String(fd.get("title")||"").trim(),
    description:String(fd.get("description")||"").trim()||null,
    date_from:dateFrom,
    date_to:dateTo,
    all_day:allDay,
    event_time:allDay?null:(String(fd.get("event_time")||"").trim()||null),
    category:String(fd.get("category")||"ogolne"),
    repeats_yearly:fd.get("repeats_yearly")==="on",
    reminder_enabled:fd.get("reminder_enabled")==="on",
    published:fd.get("published")==="on",
    updated_at:new Date().toISOString()
  };

  if(!payload.title)return alert("Podaj tytuł wpisu.");
  if(!payload.date_from||!payload.date_to)return alert("Uzupełnij datę wydarzenia.");
  if(payload.date_to<payload.date_from)return alert("Data końcowa nie może być wcześniejsza od początkowej.");
  if(payload.repeats_yearly && multiDay)return alert("Powtarzanie co roku jest dostępne dla wydarzeń jednodniowych.");
  if(!SOWKI_CALENDAR_CATEGORIES[payload.category])return alert("Wybierz prawidłową kategorię.");

  btn.disabled=true;
  btn.textContent="Zapisywanie…";
  status.textContent="Zapisuję wpis…";

  try{
    const result=id
      ?await sb.from("sowki_calendar").update(payload).eq("id",id)
      :await sb.from("sowki_calendar").insert(payload);

    if(result.error)throw result.error;

    status.textContent="✅ Zapisano";
    sowkiCalendarLoadedMonthKey="";
    sowkiCalendarUpcomingRows=[];
    await renderSowkiCalendarAdmin();

    if(q("#calendar")?.classList.contains("active")){
      await loadSowkiCalendarMonth(true);
    }
  }catch(e){
    console.error("CALENDAR SAVE ERROR",e);
    status.textContent="❌ Nie udało się zapisać.";
    alert(e?.message||"Nie udało się zapisać wpisu.");
  }finally{
    if(document.body.contains(btn)){
      btn.disabled=false;
      btn.textContent=id?"Zapisz zmiany":"Dodaj do kalendarza";
    }
  }
}


// =========================================================
// v0.7.10 — Bajkowe podróże: status realizacji i status wysłania PUSH
// Harmonogram jest publiczny, anonimowy i edytowalny przez administratora.
// Rodzice nie są identyfikowani i nie przypisujemy urządzeń do numerów dzieci.
// =========================================================

let owlTripsScheduleCache=[];
let owlTripsFullScheduleCache=null;
let owlTripsFullSchedulePromise=null;
let owlTripsHoverTimer=null;

const OWL_TRIP_MEMBERS=[
  {key:"uszatka_no",name:"Mama Uszatka",short:"Uszatka",tone:"uszatka"},
  {key:"puchacz_no",name:"Tata Puchacz",short:"Puchacz",tone:"puchacz"},
  {key:"nocek_no",name:"Synek Nocek",short:"Nocek",tone:"nocek"},
  {key:"huhu_no",name:"Córka Huhu",short:"Huhu",tone:"huhu"}
];

function owlTripAvatar(tone,size="normal"){
  const palettes={
    uszatka:{body:"#9a5735",wing:"#6f3d2a",belly:"#f3d7a6",accent:"#6fb36a"},
    puchacz:{body:"#246aa3",wing:"#164a79",belly:"#dbeeff",accent:"#45a7e8"},
    nocek:{body:"#173e63",wing:"#102b49",belly:"#d8eadf",accent:"#26ad77"},
    huhu:{body:"#e27428",wing:"#a94b1b",belly:"#ffe0af",accent:"#ff9d21"}
  };
  const p=palettes[tone]||palettes.uszatka;
  return `<svg class="owl-trip-avatar-svg ${size==="small"?"is-small":""}" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M16 20 10 8l15 9M48 20 54 8l-15 9" fill="${p.wing}"/>
    <ellipse cx="32" cy="36" rx="20" ry="21" fill="${p.body}"/>
    <path d="M14 34c-5 2-7 8-4 12 2 3 6 3 10 1M50 34c5 2 7 8 4 12-2 3-6 3-10 1" fill="${p.wing}"/>
    <circle cx="24" cy="31" r="9" fill="#fff8e8"/>
    <circle cx="40" cy="31" r="9" fill="#fff8e8"/>
    <circle cx="24" cy="31" r="4" fill="#17324d"/>
    <circle cx="40" cy="31" r="4" fill="#17324d"/>
    <circle cx="25.4" cy="29.6" r="1.2" fill="#fff"/>
    <circle cx="41.4" cy="29.6" r="1.2" fill="#fff"/>
    <path d="M28 38h8l-4 5z" fill="${p.accent}"/>
    <ellipse cx="32" cy="48" rx="9" ry="7" fill="${p.belly}"/>
  </svg>`;
}

function owlTripsWarsawToday(){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Europe/Warsaw",
    year:"numeric",
    month:"2-digit",
    day:"2-digit"
  }).formatToParts(new Date());
  const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return `${m.year}-${m.month}-${m.day}`;
}

function owlTripDateParts(iso){
  const [y,m,d]=String(iso||"").slice(0,10).split("-").map(Number);
  return {y,m,d};
}

function owlTripRangeLabel(from,to){
  if(!from||!to)return "";
  const a=owlTripDateParts(from),b=owlTripDateParts(to);
  if(a.y===b.y&&a.m===b.m)return `${a.d}–${b.d}.${String(a.m).padStart(2,"0")}.${a.y}`;
  if(a.y===b.y)return `${a.d}.${String(a.m).padStart(2,"0")}–${b.d}.${String(b.m).padStart(2,"0")}.${a.y}`;
  return `${a.d}.${String(a.m).padStart(2,"0")}.${a.y}–${b.d}.${String(b.m).padStart(2,"0")}.${b.y}`;
}

function owlTripsSelection(rows){
  const today=owlTripsWarsawToday();
  const list=(rows||[])
    .filter(x=>x?.published!==false&&x?.date_from&&x?.date_to)
    .slice()
    .sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from)));

  const current=list.find(x=>String(x.date_from)<=today&&today<=String(x.date_to));
  if(current)return {row:current,mode:"current"};

  const next=list.find(x=>String(x.date_from)>today);
  if(next)return {row:next,mode:"next"};

  return {row:null,mode:"ended"};
}

function owlTripsAssignmentCards(row,compact=false){
  if(!row)return "";
  return `<div class="${compact?"owl-trips-pop-grid":"owl-trips-assignment-grid"}">
    ${OWL_TRIP_MEMBERS.map(member=>`
      <div class="${compact?"owl-trips-pop-member":"owl-trips-assignment-card"} tone-${member.tone}">
        <div class="${compact?"owl-trips-pop-avatar":"owl-trips-assignment-avatar"}">${owlTripAvatar(member.tone,compact?"small":"normal")}</div>
        <div class="${compact?"owl-trips-pop-name":"owl-trips-assignment-name"}">${esc(compact?member.name:member.name)}</div>
        <strong class="${compact?"owl-trips-pop-number":"owl-trips-assignment-number"}">${Number(row[member.key]||0)}</strong>
      </div>`).join("")}
  </div>`;
}

function renderOwlTripsHeader(error=null){
  const pop=q("#owlTripsPopover");
  const btn=q("#owlTripsBtn");
  if(!pop||!btn)return;

  if(error){
    pop.innerHTML=`
      <div class="owl-trips-pop-head">
        <b>Sowie podróże</b>
        <small>Harmonogram chwilowo niedostępny</small>
      </div>
      <div class="owl-trips-pop-error">⚠️ Nie udało się pobrać harmonogramu. Spróbuj ponownie za chwilę.</div>`;
    btn.classList.remove("has-trip");
    return;
  }

  const selected=owlTripsSelection(owlTripsScheduleCache);
  if(!selected.row){
    pop.innerHTML=`
      <div class="owl-trips-pop-head">
        <b>Sowie podróże</b>
        <small>Harmonogram zakończony</small>
      </div>
      <button type="button" class="owl-trips-more-btn" id="owlTripsMoreBtn">📚 Zasady i pełny harmonogram</button>`;
    btn.classList.remove("has-trip");
  }else{
    const label=selected.mode==="current"?"Ten weekend":"Najbliższy weekend";
    pop.innerHTML=`
      <div class="owl-trips-pop-head">
        <b>Sowie podróże</b>
        <small>${label}: ${esc(owlTripRangeLabel(selected.row.date_from,selected.row.date_to))}</small>
      </div>
      ${owlTripsAssignmentCards(selected.row,true)}
      <button type="button" class="owl-trips-more-btn" id="owlTripsMoreBtn">📚 Zasady i pełny harmonogram</button>`;
    btn.classList.add("has-trip");
  }

  const more=q("#owlTripsMoreBtn");
  if(more)more.onclick=()=>{
    closeOwlTripsPopover();
    showPage("owlTripsPage");
  };
}

function renderOwlTripsFullPage(){
  const current=q("#owlTripsCurrentPage");
  const full=q("#owlTripsScheduleFull");
  if(!current||!full)return;

  // Górna karta używa wyłącznie lekkiego cache:
  // aktualny + najbliższy weekend.
  const selected=owlTripsSelection(owlTripsScheduleCache);
  if(selected.row){
    const label=selected.mode==="current"?`${sowkiAppOwlIcon("sowki-app-owl-current")} Ten weekend`:"🗓️ Najbliższy weekend";
    current.innerHTML=`
      <section class="owl-trips-current-card">
        <div class="owl-trips-current-head">
          <div><span>${label}</span><strong>${esc(owlTripRangeLabel(selected.row.date_from,selected.row.date_to))}</strong></div>
          <small>Piątek → poniedziałek</small>
        </div>
        ${owlTripsAssignmentCards(selected.row,false)}
      </section>`;
  }else{
    current.innerHTML=`<div class="item muted">Harmonogram wizyt Sówek został zakończony.</div>`;
  }

  // Pełny harmonogram nie jest pobierany przy starcie aplikacji.
  if(owlTripsFullScheduleCache===null){
    full.innerHTML=`<div class="item muted">⏳ Ładowanie pełnego harmonogramu…</div>`;
    return;
  }

  const rows=(owlTripsFullScheduleCache||[])
    .slice()
    .sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from)));

  const today=owlTripsWarsawToday();

  // Pierwszy termin, który jeszcze się nie zakończył:
  // jeśli właśnie trwa — oznaczamy „TEN WEEKEND”,
  // w przeciwnym razie — „NAJBLIŻSZY WEEKEND”.
  const featuredRow=rows.find(row=>String(row.date_to||row.date_from)>=today)||null;

  full.innerHTML=rows.length?rows.map(row=>{
    const isPast=String(row.date_to||row.date_from)<today;
    const isFeatured=Boolean(featuredRow && String(featuredRow.id)===String(row.id));
    const isCurrent=isFeatured &&
      String(row.date_from||"")<=today &&
      String(row.date_to||row.date_from)>=today;

    return `
      <article class="owl-trips-schedule-row${isPast?" is-past":""}${isFeatured?" is-featured":""}">
        <div class="owl-trips-schedule-date">
          <time>${esc(owlTripRangeLabel(row.date_from,row.date_to))}</time>
          ${isPast?`<span class="owl-trips-schedule-status is-past">✓ TERMIN ZREALIZOWANY</span>`:""}
          ${isFeatured?`
            <span class="owl-trips-schedule-status is-featured">
              ${isCurrent?"🟣 TEN WEEKEND":"⭐ NAJBLIŻSZY WEEKEND"}
            </span>`:""}
        </div>
        <div class="owl-trips-schedule-members">
          ${OWL_TRIP_MEMBERS.map(member=>`
            <span class="tone-${member.tone}">
              ${owlTripAvatar(member.tone,"small")}
              <b>${esc(member.short)}</b>
              <strong>${Number(row[member.key]||0)}</strong>
            </span>`).join("")}
        </div>
      </article>`;
  }).join(""):`<div class="item muted">Brak wpisów w harmonogramie.</div>`;
}

async function loadOwlTripsSchedule(){
  const today=owlTripsWarsawToday();

  const result=await publicQueryWithRetry(
    "najbliższego harmonogramu Sówek",
    ()=>sb.from("owl_trips_schedule")
      .select("id,date_from,date_to,uszatka_no,puchacz_no,nocek_no,huhu_no,published")
      .eq("published",true)
      .gte("date_to",today)
      .order("date_from",{ascending:true})
      .order("id",{ascending:true})
      .limit(2)
  );

  if(result.error){
    console.debug("OWL TRIPS PREVIEW LOAD ERROR:",result.error);
    renderOwlTripsHeader(result.error);
    return;
  }

  owlTripsScheduleCache=result.data||[];
  renderOwlTripsHeader();

  // Jeśli rodzic jest już na stronie akcji, odświeżamy tylko kartę bieżącego weekendu.
  if(q("#owlTripsPage")?.classList.contains("active")){
    renderOwlTripsFullPage();
  }
}

async function loadOwlTripsFullSchedule(force=false){
  if(!force && owlTripsFullScheduleCache!==null){
    renderOwlTripsFullPage();
    return owlTripsFullScheduleCache;
  }

  if(!force && owlTripsFullSchedulePromise){
    return owlTripsFullSchedulePromise;
  }

  const full=q("#owlTripsScheduleFull");
  if(full)full.innerHTML=`<div class="item muted">⏳ Ładowanie pełnego harmonogramu…</div>`;

  owlTripsFullSchedulePromise=(async()=>{
    const result=await publicQueryWithRetry(
      "pełnego harmonogramu Sówek",
      ()=>sb.rpc("get_owl_trips_public_schedule")
    );

    if(result.error){
      console.debug("OWL TRIPS FULL LOAD ERROR:",result.error);
      if(full){
        full.innerHTML=`
          <div class="item err">
            ⚠️ Nie udało się pobrać pełnego harmonogramu.
            <button type="button" class="secondary" id="owlTripsRetryFull">Spróbuj ponownie</button>
          </div>`;
        q("#owlTripsRetryFull")?.addEventListener("click",()=>loadOwlTripsFullSchedule(true));
      }
      return null;
    }

    owlTripsFullScheduleCache=result.data||[];
    renderOwlTripsFullPage();
    return owlTripsFullScheduleCache;
  })();

  try{
    return await owlTripsFullSchedulePromise;
  }finally{
    owlTripsFullSchedulePromise=null;
  }
}

function invalidateOwlTripsFullSchedule(){
  owlTripsFullScheduleCache=null;
  owlTripsFullSchedulePromise=null;
}

function openOwlTripsPopover(){
  const pop=q("#owlTripsPopover"),btn=q("#owlTripsBtn");
  if(!pop||!btn)return;
  clearTimeout(owlTripsHoverTimer);
  pop.hidden=false;
  btn.setAttribute("aria-expanded","true");
}

function closeOwlTripsPopover(delay=0){
  clearTimeout(owlTripsHoverTimer);
  owlTripsHoverTimer=setTimeout(()=>{
    const pop=q("#owlTripsPopover"),btn=q("#owlTripsBtn");
    if(pop)pop.hidden=true;
    if(btn)btn.setAttribute("aria-expanded","false");
  },delay);
}

function initOwlTripsUi(){
  const wrap=q(".owl-trip-header-wrap");
  const btn=q("#owlTripsBtn");
  const pop=q("#owlTripsPopover");
  if(!wrap||!btn||!pop)return;

  btn.onclick=e=>{
    e.stopPropagation();
    if(pop.hidden)openOwlTripsPopover();
    else closeOwlTripsPopover();
  };

  wrap.addEventListener("mouseenter",()=>openOwlTripsPopover());
  wrap.addEventListener("mouseleave",()=>closeOwlTripsPopover(180));
  pop.onclick=e=>e.stopPropagation();

  document.addEventListener("click",e=>{
    if(!wrap.contains(e.target))closeOwlTripsPopover();
  });

  document.addEventListener("keydown",e=>{
    if(e.key==="Escape")closeOwlTripsPopover();
  });
}

function owlTripsAdminDateRange(row){
  return owlTripRangeLabel(row.date_from,row.date_to);
}

function owlTripsAdminTermStatus(row){
  const today=owlTripsWarsawToday();
  const from=String(row?.date_from||"");
  const to=String(row?.date_to||"");

  if(to && to<today){
    return {label:"✅ Zrealizowany",className:"is-done",rowClass:"is-completed"};
  }
  if(from && to && from<=today && today<=to){
    return {label:"🟣 W trakcie",className:"is-current",rowClass:"is-current"};
  }
  return {label:"⏳ Nadchodzący",className:"is-upcoming",rowClass:"is-upcoming"};
}

function owlTripsAdminPushStatus(row){
  if(row?.friday_push_sent_at){
    return {
      label:`🔔 Powiadomienie wysłane: ${formatWarsawDateTime(row.friday_push_sent_at)}`,
      className:"is-push-sent"
    };
  }

  const today=owlTripsWarsawToday();
  const to=String(row?.date_to||"");

  if(row?.published===false){
    return {label:"🔕 PUSH wyłączony — termin ukryty",className:"is-muted"};
  }
  if(to && to<today){
    return {label:"⚠️ Powiadomienie nie zostało wysłane",className:"is-warning"};
  }
  return {label:"🔔 PUSH: piątek 13:00",className:"is-scheduled"};
}

async function renderOwlTripsAdmin(editId=null){
  setActiveAdminTab("owl_trips");
  q("#editor").dataset.table="owl_trips";
  q("#editor").innerHTML=`<div class="admin-messages-loading">Ładowanie harmonogramu…</div>`;

  const {data,error}=await sb
    .from("owl_trips_schedule")
    .select("*")
    .order("date_from",{ascending:true})
    .order("id",{ascending:true});

  if(error){
    q("#editor").innerHTML=`
      <div class="admin-order-warning">
        <b>⚠️ Nie udało się pobrać harmonogramu.</b><br>
        ${esc(error.message)}
      </div>`;
    return;
  }

  const rows=data||[];
  const edit=editId?rows.find(x=>String(x.id)===String(editId)):null;
  const today=owlTripsWarsawToday();

  // Celowo wybieramy NAJBLIŻSZY PRZYSZŁY termin, a nie weekend,
  // który aktualnie trwa. Administrator od razu widzi "co będzie dalej".
  const nextWeekend=rows
    .filter(x=>x.published!==false && String(x.date_from||"")>today)
    .sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from)))[0]||null;

  const nextWeekendSummary=nextWeekend?`
    <div class="owl-trips-next-admin-card">
      <div class="owl-trips-next-admin-kicker">⭐ NAJBLIŻSZY NADCHODZĄCY WEEKEND</div>
      <div class="owl-trips-next-admin-main">
        <div>
          <b>📅 ${esc(owlTripsAdminDateRange(nextWeekend))}</b>
          <small>To ten termin będzie następny po aktualnej dacie.</small>
        </div>
        <div class="owl-trips-admin-mini-members owl-trips-next-admin-members">
          ${OWL_TRIP_MEMBERS.map(member=>`
            <span class="tone-${member.tone}">
              ${owlTripAvatar(member.tone,"small")}
              <small>${esc(member.short)}</small>
              <b>${Number(nextWeekend[member.key]||0)}</b>
            </span>`).join("")}
        </div>
      </div>
    </div>`:`
    <div class="owl-trips-next-admin-card is-empty">
      <div class="owl-trips-next-admin-kicker">⭐ NAJBLIŻSZY NADCHODZĄCY WEEKEND</div>
      <div class="owl-trips-next-admin-empty">Brak kolejnych opublikowanych terminów w harmonogramie.</div>
    </div>`;

  const formHtml=`
    <div class="form owl-trips-admin-form" id="owlTripsAdminFormPanel">
      <div class="owl-trips-admin-title">
        <div>
          <h3>${edit?"Edytuj weekend":"Dodaj weekend"}: Sowie podróże</h3>
          <p>Numery są anonimowe — wpisujesz wyłącznie numer dziecka przypisany do danej Sówki.</p>
        </div>
        ${edit?`<button type="button" class="secondary" id="owlTripsAdminCancel">Anuluj edycję</button>`:""}
      </div>

      <form id="owlTripsAdminForm">
        <input type="hidden" name="id" value="${edit?.id||""}">
        <div class="owl-trips-admin-date-grid">
          <label>Od (piątek)<input type="date" name="date_from" value="${esc(edit?.date_from||"")}" required></label>
          <label>Do (poniedziałek)<input type="date" name="date_to" value="${esc(edit?.date_to||"")}" required></label>
        </div>

        <div class="owl-trips-admin-number-grid">
          ${OWL_TRIP_MEMBERS.map(member=>`
            <label class="owl-trips-admin-number tone-${member.tone}">
              <span>${owlTripAvatar(member.tone,"small")} ${esc(member.name)}</span>
              <input type="number" name="${member.key}" min="1" max="99" step="1" value="${esc(edit?.[member.key]??"")}" required>
            </label>`).join("")}
        </div>

        <label class="check"><input type="checkbox" name="published" ${edit?(edit.published?"checked":""):"checked"}>Widoczny dla rodziców</label>
        <button class="primary admin-save-btn" type="submit">${edit?"Zapisz zmiany":"Dodaj termin"}</button>
        <div class="admin-save-status" aria-live="polite"></div>
      </form>
    </div>`;

  q("#editor").innerHTML=`
    <section class="admin-content-manager owl-trips-admin-schedule-first">
      <div class="admin-content-head">
        <div>
          <h3>Harmonogram całoroczny</h3>
          <p>Najpierw widzisz harmonogram i najbliższy przyszły weekend. Formularz dodawania jest pod listą.</p>
        </div>
        <div class="owl-trips-admin-head-actions">
          <span class="admin-count">${rows.length} ${rows.length===1?"termin":"terminów"}</span>
          <button type="button" class="secondary owl-trips-jump-add" id="owlTripsJumpAdd">＋ Dodaj termin</button>
        </div>
      </div>

      ${nextWeekendSummary}

      <div class="owl-trips-admin-list">
        ${rows.length?rows.map(row=>{
          const termStatus=owlTripsAdminTermStatus(row);
          const pushStatus=owlTripsAdminPushStatus(row);
          const isNext=Boolean(nextWeekend && String(row.id)===String(nextWeekend.id));
          return `
          <article class="owl-trips-admin-row ${termStatus.rowClass} ${isNext?"is-next-weekend":""}">
            <div class="owl-trips-admin-row-main">
              <div class="owl-trips-admin-row-head">
                <b>📅 ${esc(owlTripsAdminDateRange(row))}</b>
                ${isNext?`<span class="admin-status is-next-weekend-badge">⭐ NAJBLIŻSZY WEEKEND</span>`:""}
                <span class="admin-status ${row.published?"is-published":"is-hidden"}">${row.published?"● Widoczny":"○ Ukryty"}</span>
                <span class="admin-status ${termStatus.className}">${termStatus.label}</span>
                <span class="admin-status ${pushStatus.className}">${esc(pushStatus.label)}</span>
              </div>
              <div class="owl-trips-admin-mini-members">
                ${OWL_TRIP_MEMBERS.map(member=>`
                  <span class="tone-${member.tone}">
                    ${owlTripAvatar(member.tone,"small")}
                    <small>${esc(member.short)}</small>
                    <b>${Number(row[member.key]||0)}</b>
                  </span>`).join("")}
              </div>
            </div>
            <div class="actions adminitem-actions">
              <button type="button" data-owl-trip-edit="${row.id}" title="Edytuj" aria-label="Edytuj">✏️</button>
              <button type="button" data-owl-trip-visibility="${row.id}" data-published="${row.published?"1":"0"}" title="${row.published?"Ukryj":"Pokaż"}" aria-label="${row.published?"Ukryj":"Pokaż"}">${row.published?"👁️":"🙈"}</button>
              <button type="button" data-owl-trip-delete="${row.id}" class="danger-lite" title="Usuń" aria-label="Usuń">🗑️</button>
            </div>
          </article>`;
        }).join(""):`<div class="admin-empty">Nie ma jeszcze wpisów w harmonogramie.</div>`}
      </div>
    </section>

    ${formHtml}`;

  q("#owlTripsAdminForm").onsubmit=saveOwlTripsAdmin;
  q("#owlTripsAdminCancel")?.addEventListener("click",async()=>{
    await renderOwlTripsAdmin();
    q("#owlTripsAdminFormPanel")?.scrollIntoView({behavior:"smooth",block:"start"});
  });

  q("#owlTripsJumpAdd")?.addEventListener("click",()=>{
    q("#owlTripsAdminFormPanel")?.scrollIntoView({behavior:"smooth",block:"start"});
  });

  qa("[data-owl-trip-edit]").forEach(b=>b.onclick=async()=>{
    await renderOwlTripsAdmin(b.dataset.owlTripEdit);
    q("#owlTripsAdminFormPanel")?.scrollIntoView({behavior:"smooth",block:"start"});
  });

  qa("[data-owl-trip-visibility]").forEach(b=>b.onclick=async()=>{
    const next=b.dataset.published!=="1";
    const {error}=await sb.from("owl_trips_schedule").update({published:next}).eq("id",b.dataset.owlTripVisibility);
    if(error){alert(error.message);return}
    invalidateOwlTripsFullSchedule();
    await renderOwlTripsAdmin();
    await loadOwlTripsSchedule();
  });

  qa("[data-owl-trip-delete]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Usunąć ten termin z harmonogramu?"))return;
    const {error}=await sb.from("owl_trips_schedule").delete().eq("id",b.dataset.owlTripDelete);
    if(error){alert(error.message);return}
    invalidateOwlTripsFullSchedule();
    await renderOwlTripsAdmin();
    await loadOwlTripsSchedule();
  });
}

async function saveOwlTripsAdmin(ev){
  ev.preventDefault();
  const form=ev.target;
  const fd=new FormData(form);
  const id=String(fd.get("id")||"");
  const btn=form.querySelector(".admin-save-btn");
  const status=form.querySelector(".admin-save-status");

  const payload={
    date_from:String(fd.get("date_from")||""),
    date_to:String(fd.get("date_to")||""),
    uszatka_no:Number(fd.get("uszatka_no")),
    puchacz_no:Number(fd.get("puchacz_no")),
    nocek_no:Number(fd.get("nocek_no")),
    huhu_no:Number(fd.get("huhu_no")),
    published:fd.get("published")==="on"
  };

  if(!payload.date_from||!payload.date_to) return alert("Uzupełnij daty weekendu.");
  if(payload.date_to<payload.date_from) return alert("Data końcowa nie może być wcześniejsza od początkowej.");
  if([payload.uszatka_no,payload.puchacz_no,payload.nocek_no,payload.huhu_no].some(n=>!Number.isInteger(n)||n<1||n>99)){
    return alert("Numery dzieci muszą być liczbami od 1 do 99.");
  }

  btn.disabled=true;
  btn.textContent="Zapisywanie…";
  if(status)status.textContent="Zapisuję harmonogram…";

  try{
    const result=id
      ? await sb.from("owl_trips_schedule").update(payload).eq("id",id)
      : await sb.from("owl_trips_schedule").insert(payload);

    if(result.error)throw result.error;

    if(status)status.textContent="✅ Zapisano";
    invalidateOwlTripsFullSchedule();
    await renderOwlTripsAdmin();
    await loadOwlTripsSchedule();
  }catch(e){
    console.error("OWL TRIPS ADMIN SAVE:",e);
    if(status)status.textContent="❌ Nie udało się zapisać.";
    alert(e?.message||"Nie udało się zapisać terminu.");
  }finally{
    if(document.body.contains(btn)){
      btn.disabled=false;
      btn.textContent=id?"Zapisz zmiany":"Dodaj termin";
    }
  }
}

initOwlTripsUi();
loadOwlTripsSchedule();

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

const STATS_DEDUPE_MS=24*60*60*1000;
let lastTrackedPage=null;

function statsLastCountedKey(page){
  return `sowki_stats_last_counted_${page}_v2`;
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

  // v0.7.6: jedno urządzenie może nabić wejście do tego samego działu
  // maksymalnie raz w ciągu kolejnych 24 godzin. Supabase sprawdza to ponownie
  // po stronie serwera, więc wyczyszczenie samego znacznika czasu nie nabija statystyk.
  if(!canCountPageView(page))return;
  const deviceToken=sowkiDeviceToken();
  if(!deviceToken)return;

  try{
    const {data,error}=await sb.rpc("track_page_view_device",{
      p_page:page,
      p_device_token:deviceToken
    });
    if(error)throw error;
    // Niezależnie od tego, czy serwer dodał nowy rekord czy wykrył już wpis z 24 h,
    // ustawiamy lokalną blokadę, żeby nie wykonywać zbędnych zapytań.
    rememberCountedPageView(page);
    return data===true;
  }catch(e){
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

 if(id==="owlTripsPage"){
   renderOwlTripsFullPage();
   loadOwlTripsFullSchedule();
 }

 if(id==="calendar"){
   loadSowkiCalendarMonth();
 }

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
  const nowISO=new Date().toISOString();
  const {data,error}=await sb.from("notifications")
    .select("*")
    .eq("published",true)
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowISO}`)
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
        <h3>${esc(notificationPlainText(x.title||""))}</h3>
        <div class="notification-plain-body">${esc(notificationPlainText(x.body||"")).replace(/\n/g,"<br>")}</div>
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
