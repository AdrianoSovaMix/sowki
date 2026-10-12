/* SÓWKI GALLERY 2.0 – OneDrive Personal: MODERACJA + CZYTNIK
 * Same pliki zdjęć: wyłącznie OneDrive. Supabase: status zatwierdzenia.
 * Oryginałów NIE WOLNO udostępniać przez public_*.
 */
(()=>{
'use strict';
const esc=(v)=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const goodUrl=(v)=>{try{const u=new URL(v);return u.protocol==='https:'?u.toString():'';}catch{return '';}};
const invoke=async(action,p={})=>await sowkiOneDriveInvoke(action,p);
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
      let masks=[];let pointerStart=null;let pendingRect=null;let sending=false;
      // Zaznaczanie ręczne jest aktywne od chwili otwarcia edytora.
      canvas.classList.add('sowki-mod-draw');
      const step=(n,title,desc)=>{
        const box=elt('section','sowki-mod-step');
        const header=elt('div','sowki-mod-step-title');
        header.append(elt('span','sowki-mod-step-n',String(n)),elt('strong','',title));
        box.append(header,elt('p','sowki-mod-step-help',desc));return box;
      };
      const step1=step(1,'Zaznacz obszary do ukrycia',
        'Mozaika jest włączona od razu. Przeciągnij palcem lub myszą po twarzy, aby narysować prostokąt. Nie musisz wciskać żadnego dodatkowego przycisku.');
      const controls=elt('div','sowki-mod-file-actions sowki-mod-edit-buttons');
      const undo=elt('button','','↶ Cofnij ostatnią mozaikę');undo.type='button';
      const reset=elt('button','','🗑️ Usuń wszystkie mozaiki');reset.type='button';
      controls.append(undo,reset);step1.append(controls);
      const helper=elt('p','sowki-mod-inline-help',
        '✏️ TRYB RĘCZNY WŁĄCZONY: przyłóż palec do jednego rogu twarzy i przeciągnij do przeciwnego. Mozaika pojawi się od razu. Obejmij całą twarz z niewielkim marginesem.');
      step1.append(helper);
      const maskStatus=elt('p','sowki-mod-mask-status','');
      const maskList=elt('div','sowki-mod-mask-list');
      const step3=step(2,'Sprawdź całe zdjęcie','Dokładnie obejrzyj całe zdjęcie i upewnij się, że ręcznie zasłoniłeś każdą twarz oraz inne dane wymagające ukrycia.');
      const review=elt('label','sowki-mod-review');
      const checkbox=elt('input');checkbox.type='checkbox';checkbox.setAttribute('aria-label','Potwierdzam kontrolę całego zdjęcia przed zapisaniem');
      const reviewText=elt('span','sowki-mod-review-copy');
      reviewText.append(elt('strong','','✅ Sprawdziłem całe zdjęcie'),
        elt('small','','Wszystkie twarze i inne dane wymagające ukrycia są skutecznie zasłonięte. Potwierdzam podgląd przed zapisaniem kopii.'));
      review.append(checkbox,reviewText);step3.append(review);
      const step4=step(3,'Zapisz prywatną kopię na OneDrive','Zapis nie oznacza publikacji. Dopiero osobne zatwierdzenie umożliwi zobaczenie zdjęcia rodzicom.');
      const save=elt('button','primary sowki-mod-save','💾 Zapisz przygotowaną kopię na OneDrive');save.type='button';
      save.disabled=true;
      const saveInfo=elt('p','sowki-mod-save-info','🔒 Aby zapisać kopię, zaznacz potwierdzenie w kroku 2.');
      step4.append(save,saveInfo);
      const cancel=elt('button','sowki-mod-close','','');cancel.type='button';cancel.textContent='✕ Zamknij edytor';
      const msg=elt('p','sowki-mod-status','');msg.setAttribute('aria-live','polite');
      editor.replaceChildren(elt('h4','','🖼️ Edycja zdjęcia: '+file.name),step1,maskStatus,canvas,maskList,step3,step4,cancel,msg);
      function invalidateReview(){checkbox.checked=false;updateSaveState();}
      function updateSaveState(){
        save.disabled=sending||!checkbox.checked;
        saveInfo.textContent=checkbox.checked?'✅ Potwierdzono kontrolę wzrokową. Możesz zapisać przygotowaną kopię.':
          '🔒 Aby zapisać kopię, zaznacz potwierdzenie w kroku 2.';
      }
      checkbox.addEventListener('change',updateSaveState);
      // Trwała mozaika pikselowa: zmieniamy piksele eksportowanego JPG, a nie CSS.
      // Silna redukcja: ok. 5 x 5 dużych kafli na każdy zaznaczony obszar.
      function redactRegion(target,m){
        const W=target.canvas.width,H=target.canvas.height;
        const x=Math.max(0,Math.floor(m.x*W)),y=Math.max(0,Math.floor(m.y*H));
        const right=Math.min(W,Math.ceil((m.x+m.w)*W)),bottom=Math.min(H,Math.ceil((m.y+m.h)*H));
        const w=right-x,h=bottom-y;if(w<1||h<1)return;
        const block=Math.max(12,Math.ceil(Math.min(w,h)/5),Math.ceil(Math.min(W,H)/140));
        const tiny=document.createElement('canvas');
        tiny.width=Math.max(1,Math.ceil(w/block));tiny.height=Math.max(1,Math.ceil(h/block));
        const tinyCtx=tiny.getContext('2d');if(!tinyCtx)throw new Error('Przeglądarka nie obsługuje mozaiki.');
        // Próbkujemy wyłącznie wybrany fragment; oryginalna twarz nie jest nałożona
        // jako osobna warstwa i nie trafia do przygotowanego pliku.
        tinyCtx.imageSmoothingEnabled=true;
        tinyCtx.drawImage(image,x*image.naturalWidth/W,y*image.naturalHeight/H,
          w*image.naturalWidth/W,h*image.naturalHeight/H,0,0,tiny.width,tiny.height);
        target.save();target.beginPath();target.rect(x,y,w,h);target.clip();
        target.imageSmoothingEnabled=false;
        target.drawImage(tiny,x,y,w,h);
        target.restore();
      }
      function paint(target,includeGuides){
        const W=target.canvas.width,H=target.canvas.height;
        target.clearRect(0,0,W,H);target.imageSmoothingEnabled=true;
        target.drawImage(image,0,0,W,H);
        for(const [i,m] of masks.entries()){
          if(!m.active)continue;
          redactRegion(target,m);
          if(includeGuides){
            const x=m.x*W,y=m.y*H,w=m.w*W,h=m.h*H;
            target.save();target.strokeStyle='#ff2773';target.lineWidth=Math.max(2,W/550);
            target.setLineDash([Math.max(6,W/150),Math.max(4,W/270)]);
            target.strokeRect(x,y,w,h);target.setLineDash([]);
            target.fillStyle='#bf0550';target.fillRect(x,y,Math.max(19,W/55),Math.max(19,W/55));
            target.fillStyle='#fff';target.font=`bold ${Math.max(12,Math.round(W/80))}px sans-serif`;
            target.fillText(String(i+1),x+5,y+Math.max(14,W/90));target.restore();
          }
        }
        if(includeGuides&&pendingRect){target.save();target.strokeStyle='#02bb9e';target.lineWidth=Math.max(2,W/500);
          target.strokeRect(pendingRect.x*W,pendingRect.y*H,pendingRect.w*W,pendingRect.h*H);target.restore();}
      }
      function draw(){paint(ctx,true);updateMasks();}
      function updateMasks(){
        const active=masks.filter(m=>m.active).length;
        maskStatus.textContent=active?`🟪 Zaznaczonych mozaik: ${active}. Sprawdź, czy wszystkie zasłonięte twarze są nieczytelne.`:
          '✏️ Nie nałożono jeszcze mozaiki. Przeciągnij palcem lub myszą po wybranej twarzy.';
        maskList.replaceChildren();
        if(!masks.length)return;
        const title=elt('strong','', 'Zaznaczone obszary (możesz usunąć wybrany):');maskList.append(title);
        masks.forEach((m,i)=>{
          const item=elt('span','sowki-mod-mask-chip');
          item.append(elt('span','',`Mozaika ${i+1}`));
          const remove=elt('button','','✕ Usuń');remove.type='button';
          remove.setAttribute('aria-label',`Usuń obszar ${i+1}`);
          remove.addEventListener('click',()=>{masks.splice(i,1);invalidateReview();draw();});
          item.append(remove);maskList.append(item);
        });
      }
      const at=(e)=>{const r=canvas.getBoundingClientRect();return {
        x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),
        y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
      canvas.addEventListener('pointerdown',e=>{if(sending)return;
        e.preventDefault();pointerStart=at(e);canvas.setPointerCapture(e.pointerId);});
      canvas.addEventListener('pointermove',e=>{if(!pointerStart||sending)return;
        const p=at(e);pendingRect={x:Math.min(p.x,pointerStart.x),y:Math.min(p.y,pointerStart.y),
          w:Math.abs(p.x-pointerStart.x),h:Math.abs(p.y-pointerStart.y)};paint(ctx,true);});
      canvas.addEventListener('pointerup',e=>{if(!pointerStart||sending)return;
        const p=at(e);const r={x:Math.min(p.x,pointerStart.x),y:Math.min(p.y,pointerStart.y),
          w:Math.abs(p.x-pointerStart.x),h:Math.abs(p.y-pointerStart.y),active:true,source:'manual'};
        if(r.w>.007&&r.h>.007){masks.push(r);invalidateReview();}
        pointerStart=null;pendingRect=null;draw();});
      canvas.addEventListener('pointercancel',()=>{pointerStart=null;pendingRect=null;draw();});
      undo.onclick=()=>{
        if(!masks.length||sending)return;
        masks.pop();invalidateReview();draw();
      };
      reset.onclick=()=>{
        if(!masks.length||sending)return;
        if(!confirm('Usunąć wszystkie zaznaczone mozaiki?'))return;
        masks=[];invalidateReview();draw();
      };
      // Kopię zapisujemy dopiero po wyraźnej, osobnej kontroli właściciela.
      save.onclick=async()=>{
        if(!checkbox.checked||sending){msg.textContent='Najpierw sprawdź zdjęcie i potwierdź kontrolę w kroku 2.';return;}
        if(!masks.length&&!confirm('Nie zaznaczono ŻADNEJ mozaiki. Czy to zdjęcie na pewno nie wymaga ukrycia żadnej twarzy ani danych?'))return;
        if(!confirm('Zapisać PRYWATNĄ kopię z mozaiką na OneDrive? Oryginał pozostanie bez zmian. Nie opublikujemy jej automatycznie.'))return;
        sending=true;updateSaveState();msg.textContent='Przygotowuję zdjęcie JPG…';
        try{
          const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;
          const g=output.getContext('2d');if(!g)throw new Error('Błąd eksportu zdjęcia.');
          paint(g,false); // te same piksele w podglądzie i kopii; bez ramek i numerów
          const prepared=await new Promise((res,rej)=>output.toBlob(b=>b?res(b):rej(new Error('Nie udało się zapisać JPG.')),'image/jpeg',.91));
          msg.textContent='Przesyłam prywatną kopię bezpośrednio do OneDrive…';
          const session=await invoke('moderation_prepare_session',{album_id:albumId,item_id:file.id,size:prepared.size});
          let last;const step=Number(session.chunk_size||5*1024*1024);
          for(let from=0;from<prepared.size;from+=step){
            const end=Math.min(prepared.size,from+step);
            last=await sowkiOneDriveUploadChunk(session.upload_url,prepared.slice(from,end),from,prepared.size,
              sent=>{msg.textContent='Zapis OneDrive: '+Math.min(100,Math.floor(sent/prepared.size*100))+'%';});
            if(end<prepared.size&&last.status!==202)throw new Error('OneDrive przerwał przesyłanie kopii.');
          }
          const approvedId=String(last?.data?.id||'');
          if(!approvedId||![200,201].includes(last?.status))throw new Error('OneDrive nie potwierdził zapisu kopii.');
          await invoke('moderation_confirm_prepared',{album_id:albumId,source_item_id:file.id,
            approved_item_id:approvedId,masked_regions_count:masks.filter(m=>m.active).length,visually_reviewed:true});
          msg.textContent='✅ Kopia zapisana wyłącznie na OneDrive! Obejrzyj ją osobno przed ewentualną publikacją rodzicom.';
          URL.revokeObjectURL(tempUrl);tempUrl='';
          await load();
        }catch(e){msg.textContent='❌ '+errText(e);}
        finally{sending=false;updateSaveState();}
      };
      cancel.onclick=()=>{if(sending)return;editor.hidden=true;editor.replaceChildren();if(tempUrl)URL.revokeObjectURL(tempUrl);};
      draw();msg.textContent='✏️ Przeciągnij palcem lub myszą po każdej twarzy, aby nałożyć mozaikę. Zaznaczanie już działa.';
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
