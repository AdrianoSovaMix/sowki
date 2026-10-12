/* SÓWKI GALLERY 2.0 – OneDrive Personal: MODERACJA + CZYTNIK
 * Same pliki zdjęć: wyłącznie OneDrive. Supabase: status zatwierdzenia.
 * Oryginałów NIE WOLNO udostępniać przez public_*.
 */
(()=>{
'use strict';
const esc=(v)=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const goodUrl=(v)=>{try{const u=new URL(v);return u.protocol==='https:'?u.toString():'';}catch{return '';}};
const invoke=async(action,p={})=>await sowkiOneDriveInvoke(action,p);
let detectorPromise=null;
async function faceDetector(){
  if(!detectorPromise)detectorPromise=(async()=>{
    const version='0.10.22';
    const lib=await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}/+esm`);
    const resolver=await lib.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}/wasm`);
    return await lib.FaceDetector.createFromOptions(resolver,{
      baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'},
      runningMode:'IMAGE',minDetectionConfidence:.4
    });
  })().catch(e=>{detectorPromise=null;throw e;});
  return await detectorPromise;
}
const imgBlob=async(url)=>{
  const safe=goodUrl(url);if(!safe)throw new Error('Nieprawidłowy adres zdjęcia OneDrive.');
  const r=await fetch(safe,{mode:'cors',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  if(!r.ok)throw new Error('OneDrive zwrócił błąd '+r.status+' podczas pobierania zdjęcia.');
  return await r.blob();
};
function elt(tag,cls='',content=''){
  const x=document.createElement(tag);if(cls)x.className=cls;if(content)x.textContent=content;return x;
}
function errText(e){return String(e?.message||e||'Nieznany błąd.').slice(0,300);}

window.sowkiOneDriveModerationMount=async function(box,albumSelect){
  if(!box?.isConnected)return;
  const section=elt('section','sowki-gallery-mod');
  section.innerHTML=`<div class="sowki-mod-title"><h3>🛡️ Galeria 2.0 – moderacja właściciela <span class="sowki-onedrive-pill">BETA</span></h3>
    <p>Tylko Ty widzisz oryginały. Przygotowane kopie JPG pozostają na OneDrive. <b>Bez Twojego zatwierdzenia nic nie będzie widoczne rodzicom.</b></p></div>
    <div class="sowki-mod-controls"><button type="button" class="sowki-mod-refresh">🔍 Pokaż zdjęcia z wybranego albumu</button>
    <span class="sowki-mod-summary" aria-live="polite"></span></div>
    <div class="sowki-mod-list"></div><div class="sowki-mod-editor" hidden></div>
    <div class="sowki-mod-ready"></div>`;
  box.append(section);
  const summary=section.querySelector('.sowki-mod-summary');
  const photos=section.querySelector('.sowki-mod-list');
  const editor=section.querySelector('.sowki-mod-editor');
  const ready=section.querySelector('.sowki-mod-ready');
  const refresh=section.querySelector('.sowki-mod-refresh');
  let chosenAlbum='';let busy=false;
  const setMsg=(txt)=>{summary.textContent=txt;};
  function clear(){photos.replaceChildren();ready.replaceChildren();editor.replaceChildren();editor.hidden=true;}
  async function load(){
    if(busy)return;
    const id=albumSelect.value;clear();chosenAlbum=id;
    if(!id){setMsg('Najpierw wybierz album.');return;}
    busy=true;refresh.disabled=true;setMsg('Pobieram listę zdjęć z OneDrive…');
    try{
      const [pending,prepared]=await Promise.all([
        invoke('moderation_list',{album_id:id}),invoke('moderation_prepared_list',{album_id:id})]);
      if(chosenAlbum!==id)return;
      setMsg(`${pending.files.length} zdjęć w albumie • ${prepared.photos.length} przygotowanych`+
        (pending.more?' • widoczne pierwsze 120 plików':'')+'.');
      if(!pending.files.length)photos.append(elt('p','', 'Brak zdjęć do weryfikacji.'));
      for(const file of pending.files){
        const row=elt('article','sowki-mod-file');
        const main=elt('div');main.append(elt('b','',file.name));
        main.append(elt('small','',file.published?'🟢 Opublikowane':file.has_prepared?'🟡 Przygotowane – nieopublikowane':'⚪ Oczekuje na przygotowanie'));
        const button=elt('button','','🙈 Sprawdź i przygotuj');button.type='button';
        button.onclick=()=>startEditing(file,id);
        row.append(main,button);photos.append(row);
      }
      if(prepared.photos.length){
        ready.append(elt('h4','','✅ Zapisane kopie – publikuj dopiero po sprawdzeniu'));
        for(const p of prepared.photos){
          const row=elt('article','sowki-mod-file');
          const main=elt('div');main.append(elt('b','',p.approved_name));
          main.append(elt('small','',p.published?'🟢 W galerii rodziców':'🔒 Tylko właściciel • liczba masek: '+p.masked_regions_count));
          const actions=elt('div','sowki-mod-file-actions');
          const preview=elt('button','','👀 Podgląd kopii');preview.type='button';
          let inspected=false;
          preview.onclick=async()=>{
            preview.disabled=true;
            try{
              const res=await invoke('moderation_approved_preview',{source_item_id:p.source_item_id});
              const url=goodUrl(res.url);if(!url)throw new Error('Brak adresu podglądu.');
              const wrap=elt('div','sowki-mod-approval-preview');
              const image=elt('img');image.alt='Przygotowana wersja zdjęcia po zasłonięciu twarzy';
              image.referrerPolicy='no-referrer';image.src=url;
              wrap.append(image);row.after(wrap);
              await image.decode(); // publikuj tylko po prawdziwym wyrenderowaniu zdjęcia
              inspected=true;
            }catch(e){alert('Nie można otworzyć gotowej kopii: '+errText(e));}
            finally{preview.disabled=false;}
          };
          const publish=elt('button','',p.published?'🔒 Ukryj rodzicom':'🌍 Zatwierdź publikację');publish.type='button';
          publish.onclick=async()=>{
            if(!p.published&&!inspected){alert('Najpierw kliknij „Podgląd kopii” i dokładnie obejrzyj gotowe zdjęcie.');return;}
            if(!confirm(p.published?'Ukryć to zdjęcie w galerii rodziców?':
              'Potwierdzasz, że obejrzałeś gotowy plik, wszystkie wymagane twarze są TRWALE zasłonięte i zdjęcie można pokazać rodzicom?'))return;
            publish.disabled=true;
            try{
              await invoke('moderation_publish',{source_item_id:p.source_item_id,published:!p.published,visually_reviewed:true});
              await load();
            }catch(e){alert('Nie udało się zmienić publikacji: '+errText(e));publish.disabled=false;}
          };
          actions.append(preview,publish);row.append(main,actions);ready.append(row);
        }
      }
    }catch(e){setMsg('⚠️ '+errText(e));}
    finally{busy=false;refresh.disabled=false;}
  }
  refresh.onclick=load;
  albumSelect.addEventListener('change',()=>{chosenAlbum='';clear();setMsg('Wybrano inny album. Kliknij „Pokaż zdjęcia”.');});

  async function startEditing(file,albumId){
    if(busy)return;
    const currentAlbum=albumSelect.value;
    if(currentAlbum!==albumId){setMsg('Wybierz ponownie album i odśwież listę.');return;}
    editor.replaceChildren();editor.hidden=false;
    editor.append(elt('h4','','🔍 Weryfikacja: '+file.name));
    const status=elt('p','sowki-mod-status','Pobieram oryginał z OneDrive…');editor.append(status);
    editor.scrollIntoView({behavior:'smooth',block:'nearest'});
    let tempUrl='';
    try{
      const result=await invoke('moderation_source',{album_id:albumId,item_id:file.id});
      const blob=await imgBlob(result.url);
      tempUrl=URL.createObjectURL(blob);
      const image=new Image();image.src=tempUrl;await image.decode();
      if(!image.naturalWidth||!image.naturalHeight)throw new Error('Ten format zdjęcia nie jest obsługiwany w tej przeglądarce. Możesz skonwertować go do JPG.');
      const canvas=elt('canvas','sowki-mod-canvas');
      canvas.width=Math.round(image.naturalWidth*Math.min(1,2400/image.naturalWidth,2400/image.naturalHeight));
      canvas.height=Math.round(image.naturalHeight*canvas.width/image.naturalWidth);
      const ctx=canvas.getContext('2d',{willReadFrequently:false});
      if(!ctx)throw new Error('Przeglądarka nie umożliwia edycji tego zdjęcia.');
      let masks=[];let drawMode=false;let pointerStart=null;let pendingRect=null;
      const controls=elt('div','sowki-mod-file-actions');
      const auto=elt('button','','🤖 Wykryj twarze');auto.type='button';
      const manual=elt('button','','✏️ Dodaj obszar ręcznie');manual.type='button';
      const reset=elt('button','','↩️ Usuń wszystkie zaznaczenia');reset.type='button';
      controls.append(auto,manual,reset);
      const helper=elt('p','sowki-onedrive-note','Czarne pola trwale zasłaniają wybrane obszary. Dotknij maski, by ją wyłączyć lub włączyć. Możesz ręcznie dorysować pominięte twarze.');
      const accept=elt('label','sowki-mod-check');
      const checkbox=elt('input');checkbox.type='checkbox';
      accept.append(checkbox,document.createTextNode(' Obejrzałem zdjęcie i sprawdziłem WSZYSTKIE twarze oraz inne dane, które wymagają ukrycia.'));
      const save=elt('button','primary','💾 Zapisz kopię do 02_ZATWIERDZONE');save.type='button';
      const cancel=elt('button','','Zamknij podgląd');cancel.type='button';
      const msg=elt('p','sowki-mod-status','');
      editor.replaceChildren(elt('h4','','🔍 '+file.name),controls,helper,canvas,accept,save,cancel,msg);
      function draw(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        for(const [i,m] of masks.entries()){
          const x=m.x*canvas.width,y=m.y*canvas.height,w=m.w*canvas.width,h=m.h*canvas.height;
          if(m.active){ctx.fillStyle='#121212';ctx.fillRect(x,y,w,h);}
          ctx.strokeStyle=m.active?'#f5005a':'#ffc400';ctx.lineWidth=Math.max(2,canvas.width/600);
          ctx.strokeRect(x,y,w,h);ctx.fillStyle='#fff';ctx.font=`${Math.max(11,Math.round(canvas.width/75))}px sans-serif`;
          ctx.fillText(String(i+1),x+5,y+Math.max(12,canvas.width/80));
        }
        if(pendingRect){ctx.strokeStyle='#29c9a2';ctx.lineWidth=Math.max(2,canvas.width/500);
          ctx.strokeRect(pendingRect.x*canvas.width,pendingRect.y*canvas.height,pendingRect.w*canvas.width,pendingRect.h*canvas.height);}
      }
      const at=(e)=>{const r=canvas.getBoundingClientRect();return {
        x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),
        y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
      canvas.addEventListener('pointerdown',e=>{if(!drawMode)return;
        e.preventDefault();pointerStart=at(e);canvas.setPointerCapture(e.pointerId);});
      canvas.addEventListener('pointermove',e=>{if(!drawMode||!pointerStart)return;
        const p=at(e);pendingRect={x:Math.min(p.x,pointerStart.x),y:Math.min(p.y,pointerStart.y),
          w:Math.abs(p.x-pointerStart.x),h:Math.abs(p.y-pointerStart.y)};draw();});
      canvas.addEventListener('pointerup',e=>{if(!drawMode||!pointerStart)return;
        const p=at(e);const r={x:Math.min(p.x,pointerStart.x),y:Math.min(p.y,pointerStart.y),
          w:Math.abs(p.x-pointerStart.x),h:Math.abs(p.y-pointerStart.y),active:true};
        if(r.w>.01&&r.h>.01)masks.push(r);
        pointerStart=null;pendingRect=null;draw();});
      canvas.addEventListener('click',e=>{if(drawMode)return;
        const p=at(e);const hit=[...masks].reverse().find(m=>p.x>=m.x&&p.y>=m.y&&p.x<=m.x+m.w&&p.y<=m.y+m.h);
        if(hit){hit.active=!hit.active;draw();}});
      manual.onclick=()=>{drawMode=!drawMode;manual.textContent=drawMode?'✅ Zakończ rysowanie':'✏️ Dodaj obszar ręcznie';
        canvas.classList.toggle('sowki-mod-draw',drawMode);};
      reset.onclick=()=>{if(!confirm('Usunąć wszystkie maski?'))return;masks=[];draw();checkbox.checked=false;};
      auto.onclick=async()=>{auto.disabled=true;msg.textContent='🤖 Trwa wykrywanie twarzy lokalnie w Twojej przeglądarce…';
        try{
          const detector=await faceDetector();const detections=detector.detect(image).detections||[];
          for(const det of detections){
            const b=det.boundingBox;if(!b)continue;
            const padX=b.width*.22,padY=b.height*.35;
            const x=Math.max(0,(b.originX-padX)/image.naturalWidth),y=Math.max(0,(b.originY-padY)/image.naturalHeight);
            const right=Math.min(1,(b.originX+b.width+padX)/image.naturalWidth),bottom=Math.min(1,(b.originY+b.height+padY)/image.naturalHeight);
            if(right>x&&bottom>y)masks.push({x,y,w:right-x,h:bottom-y,active:true});
          }
          draw();msg.textContent=`Wykryto ${detections.length} twarzy. Koniecznie sprawdź także pominięte twarze!`;
        }catch(e){msg.textContent='⚠️ Automatyczne wykrywanie jest niedostępne ('+errText(e)+'). Zaznacz twarze ręcznie.';}
        finally{auto.disabled=false;}
      };
      // Działamy prywatnie na lokalnej kopii; oczekuje na potwierdzenie właściciela.
      save.onclick=async()=>{
        if(!checkbox.checked){msg.textContent='Zaznacz potwierdzenie kontroli wzrokowej.';return;}
        if(!confirm('Zapisać NOWĄ wersję zdjęcia na Twoim prywatnym OneDrive? Oryginał pozostanie bez zmian.'))return;
        save.disabled=true;msg.textContent='Przygotowuję zdjęcie JPG…';
        try{
          // Zdjęcie wynikowe NIE zawiera obrysów i numerów masek; tylko trwałe czarne wypełnienia.
          const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;
          const g=output.getContext('2d');if(!g)throw new Error('Błąd eksportu zdjęcia.');
          g.drawImage(image,0,0,output.width,output.height);
          const active=masks.filter(m=>m.active);
          for(const m of active){g.fillStyle='#101010';g.fillRect(m.x*output.width,m.y*output.height,m.w*output.width,m.h*output.height);}
          const prepared=await new Promise((res,rej)=>output.toBlob(b=>b?res(b):rej(new Error('Nie udało się zapisać JPG.')),'image/jpeg',.91));
          msg.textContent='Przesyłam zatwierdzoną kopię bezpośrednio do OneDrive…';
          const session=await invoke('moderation_prepare_session',{album_id:albumId,item_id:file.id,size:prepared.size});
          let last;
          const step=Number(session.chunk_size||5*1024*1024);
          for(let from=0;from<prepared.size;from+=step){
            const end=Math.min(prepared.size,from+step);
            last=await sowkiOneDriveUploadChunk(session.upload_url,prepared.slice(from,end),from,prepared.size,
              sent=>{msg.textContent='Zapis OneDrive: '+Math.min(100,Math.floor(sent/prepared.size*100))+'%';});
            if(end<prepared.size&&last.status!==202)throw new Error('OneDrive przerwał przesyłanie kopii.');
          }
          const approvedId=String(last?.data?.id||'');
          if(!approvedId||![200,201].includes(last?.status))throw new Error('OneDrive nie potwierdził zapisu kopii.');
          await invoke('moderation_confirm_prepared',{album_id:albumId,source_item_id:file.id,
            approved_item_id:approvedId,masked_regions_count:active.length,visually_reviewed:true});
          msg.textContent='✅ Gotowa kopia zapisana wyłącznie na OneDrive! Aby ją pokazać rodzicom, obejrzyj zapisany plik i osobno zatwierdź publikację poniżej.';
          await load();
        }catch(e){msg.textContent='❌ '+errText(e);save.disabled=false;}
      };
      cancel.onclick=()=>{editor.hidden=true;editor.replaceChildren();URL.revokeObjectURL(tempUrl);};
      draw();msg.textContent='Sprawdź fotografię. Spróbuj wykrywania automatycznego, a pominięte twarze zasłoń ręcznie.';
    }catch(e){status.textContent='⚠️ '+errText(e);if(tempUrl)URL.revokeObjectURL(tempUrl);}
  }
};

window.sowkiOneDrivePublicMount=async function(){
  const mount=document.querySelector('#galleryAlbums');if(!mount||mount.hidden)return;
  const session=readPrivateAccessSession('gallery');
  if(!session?.token)return;
  let section=mount.querySelector('.sowki-od-public');
  if(!section){section=elt('section','sowki-od-public');mount.append(section);}
  section.replaceChildren(elt('h2','','☁️ Nowa galeria zdjęć – OneDrive'));
  const hint=elt('p','sowki-onedrive-note','Wyłącznie fotografie zatwierdzone przez właściciela. Oryginały są prywatne.');section.append(hint);
  const status=elt('p','','Wczytuję zatwierdzone albumy…');section.append(status);
  const groups=elt('div','sowki-od-albums');section.append(groups);
  const action=async(type,extras={})=>{
    const s=readPrivateAccessSession('gallery');
    if(!s?.token)throw new Error('Sesja wygasła. Odblokuj galerię hasłem ponownie.');
    const response=await invoke(type,{gallery_token:s.token,device_id:privateAccessDeviceId(),...extras});
    // private-access może wydać nową wersję sesji przy walidacji tokenu.
    if(response?.token&&response?.expires_at)savePrivateAccessSession('gallery',response);
    return response;
  };
  try{
    const result=await action('public_albums');
    if(!mount.isConnected||mount.hidden)return;
    status.textContent=result.albums.length?`Dostępne albumy OneDrive: ${result.albums.length}`:'Nie ma jeszcze zatwierdzonych zdjęć w nowej galerii.';
    for(const album of result.albums){
      const article=elt('article','item sowki-od-album');
      const heading=elt('h3','',`📁 ${album.name} (${album.count})`);
      const btn=elt('button','primary','📸 Zobacz zdjęcia');btn.type='button';
      const grid=elt('div','sowki-od-photos');grid.hidden=true;
      article.append(heading,btn,grid);groups.append(article);
      btn.onclick=async()=>{
        if(!grid.hidden){grid.hidden=true;btn.textContent='📸 Zobacz zdjęcia';return;}
        grid.hidden=false;btn.disabled=true;btn.textContent='Wczytuję…';grid.replaceChildren();
        try{
          let offset=0,total=0;
          do{
            const page=await action('public_photos',{album_id:album.id,offset});
            total=Number(page.count||0);
            for(const photo of page.photos){
              const figure=elt('figure','sowki-od-photo');
              const img=elt('img');img.alt=photo.name||'Zdjęcie z przedszkola';img.loading='lazy';img.referrerPolicy='no-referrer';
              img.src=goodUrl(photo.thumbnail_url||photo.url);img.decoding='async';
              const caption=elt('figcaption');
              const open=elt('button','','🔍 Powiększ');open.type='button';
              open.onclick=()=>{
                const light=elt('div','sowki-od-lightbox');light.setAttribute('role','dialog');light.setAttribute('aria-label','Podgląd zdjęcia');
                const photoCopy=elt('img');photoCopy.src=goodUrl(photo.url);photoCopy.alt=img.alt;photoCopy.referrerPolicy='no-referrer';
                const close=elt('button','','✕ Zamknij');close.type='button';close.onclick=()=>light.remove();
                light.addEventListener('click',e=>{if(e.target===light)light.remove();});
                light.append(close,photoCopy);document.body.append(light);
              };
              const download=elt('button','','📥 Pobierz');download.type='button';
              download.onclick=async()=>{
                download.disabled=true;
                try{
                  // Pobieranie przez CORS bez pośredniczenia serwera Supabase.
                  const content=await imgBlob(photo.url);
                  const local=URL.createObjectURL(content),a=document.createElement('a');
                  a.href=local;a.download=photo.name||'zdjecie.jpg';document.body.append(a);a.click();a.remove();
                  setTimeout(()=>URL.revokeObjectURL(local),60000);
                }catch(e){alert('Nie udało się pobrać zdjęcia. Spróbuj ponownie otworzyć album. '+errText(e));}
                finally{download.disabled=false;}
              };
              caption.append(open,download);figure.append(img,caption);grid.append(figure);
            }
            offset+=24;
            if(!page.has_more)break;
          }while(offset<Math.min(240,total));
          if(!grid.childElementCount)grid.append(elt('p','','Brak dostępnych fotografii.'));
          btn.textContent='🔼 Ukryj zdjęcia';
        }catch(e){grid.replaceChildren(elt('p','err','⚠️ '+errText(e)));btn.textContent='Spróbuj ponownie';}
        finally{btn.disabled=false;}
      };
    }
  }catch(e){status.textContent='⚠️ Nie udało się wczytać albumów OneDrive: '+errText(e);}
};
})();
