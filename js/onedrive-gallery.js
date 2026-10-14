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
    <div class="sowki-mod-ready"></div><div class="sowki-mod-album-settings"></div>`;
  box.append(section);
  const summary=section.querySelector('.sowki-mod-summary');
  const photos=section.querySelector('.sowki-mod-list');
  const editor=section.querySelector('.sowki-mod-editor');
  const ready=section.querySelector('.sowki-mod-ready');
  const settings=section.querySelector('.sowki-mod-album-settings');
  const refresh=section.querySelector('.sowki-mod-refresh');
  let chosenAlbum='';let busy=false;
  const setMsg=(txt)=>{summary.textContent=txt;};
  function clear(){photos.replaceChildren();ready.replaceChildren();settings.replaceChildren();editor.replaceChildren();editor.hidden=true;}
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
        main.append(elt('small','',file.published?'🟢 Zatwierdzone do albumu':file.has_prepared?'🟡 Przygotowane – nieopublikowane':'⚪ Oczekuje na przygotowanie'));
        const button=elt('button','','🙈 Sprawdź i przygotuj');button.type='button';
        button.onclick=()=>startEditing(file,id);
        row.append(main,button);photos.append(row);
      }
      if(prepared.photos.length){
        ready.append(elt('h4','','✅ Zapisane kopie – publikuj dopiero po sprawdzeniu'));
        for(const p of prepared.photos){
          const row=elt('article','sowki-mod-file');
          const main=elt('div');main.append(elt('b','',p.approved_name));
          main.append(elt('small','',p.published?'🟢 Zatwierdzone do albumu • widoczność zależy od publikacji albumu':'🔒 Tylko właściciel • liczba masek: '+p.masked_regions_count));
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
          const publish=elt('button','',p.published?'🔒 Cofnij zatwierdzenie zdjęcia':'🌍 Zatwierdź zdjęcie');publish.type='button';
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
      const details=await invoke('moderation_album_get',{album_id:id});
      if(chosenAlbum===id)renderAlbumSettings(details,id);
    }catch(e){setMsg('⚠️ '+errText(e));}
    finally{busy=false;refresh.disabled=false;}
  }
  refresh.onclick=load;
  albumSelect.addEventListener('change',()=>{chosenAlbum='';clear();setMsg('Wybrano inny album. Kliknij „Pokaż zdjęcia”.');});

  function renderAlbumSettings(info,albumId){
    settings.replaceChildren();
    const data=info.album||{},covers=info.covers||[];
    const card=elt('section','sowki-mod-album-card');
    card.append(elt('h4','','🖼️ Karta albumu widoczna dla rodziców'));
    card.append(elt('p','sowki-mod-album-intro','Tytuł, opis, data i okładka będą wyglądały tak samo jak w pozostałych albumach galerii. Zapisanie nie udostępnia zdjęć.'));
    const field=(label,control)=>{const lbl=elt('label','sowki-album-label',label);lbl.append(control);card.append(lbl);};
    const title=elt('input');title.type='text';title.maxLength=140;title.value=data.title||'';
    field('Tytuł albumu',title);
    const description=elt('textarea');description.maxLength=3000;description.rows=3;description.value=data.description||'';
    description.placeholder='Co działo się podczas wydarzenia?';field('Opis albumu',description);
    const eventDate=elt('input');eventDate.type='date';eventDate.value=data.event_date||'';
    field('Data wydarzenia (opcjonalnie)',eventDate);
    const cover=elt('select');cover.append(new Option('— Wybierz zatwierdzone zdjęcie na okładkę —',''));
    for(const entry of covers)cover.append(new Option(entry.name,String(entry.id)));
    if(covers.some(e=>String(e.id)===String(data.cover_approved_item_id)))cover.value=String(data.cover_approved_item_id);
    field('Zdjęcie okładkowe — spośród zdjęć już zatwierdzonych',cover);
    const coverPreview=elt('img','sowki-album-cover-preview');coverPreview.hidden=true;
    coverPreview.alt='Podgląd okładki';coverPreview.referrerPolicy='no-referrer';
    const viewCover=elt('button','sowki-album-cover-button','👀 Pokaż wybraną okładkę');viewCover.type='button';
    const previewStatus=elt('small','sowki-album-preview-status');
    viewCover.onclick=async()=>{
      const selected=covers.find(e=>String(e.id)===cover.value);
      if(!selected){previewStatus.textContent='Najpierw wybierz zdjęcie okładkowe.';return;}
      viewCover.disabled=true;previewStatus.textContent='Wczytuję podgląd…';
      try{
        const res=await invoke('moderation_approved_preview',{source_item_id:selected.source_item_id});
        const url=goodUrl(res.url);if(!url)throw Error('Brak adresu okładki.');
        coverPreview.src=url;await coverPreview.decode();coverPreview.hidden=false;
        previewStatus.textContent='Podgląd zatwierdzonej kopii.';
      }catch(e){previewStatus.textContent='⚠️ '+errText(e);}
      finally{viewCover.disabled=false;}
    };
    cover.onchange=()=>{coverPreview.hidden=true;previewStatus.textContent='';};
    card.append(viewCover,coverPreview,previewStatus);
    const current=!!data.published;
    const state=elt('p','sowki-album-visibility',current?'✅ Album jest widoczny dla rodziców.':'🔒 Album jest ukryty przed rodzicami.');card.append(state);
    const buttons=elt('div','sowki-album-buttons');
    const save=elt('button','','💾 Zapisz tytuł, opis i okładkę');save.type='button';
    const publish=elt('button','primary',current?'🔒 Ukryj cały album':'🌍 Opublikuj cały album');publish.type='button';
    buttons.append(save,publish);card.append(buttons);
    const notice=elt('p','sowki-album-feedback');notice.setAttribute('role','status');card.append(notice);
    async function saveCard(makePublic){
      if(makePublic&&!covers.length){notice.textContent='Najpierw opublikuj przynajmniej jedno przygotowane zdjęcie.';return;}
      if(makePublic&&!cover.value){notice.textContent='Wybierz zdjęcie okładkowe.';return;}
      if(makePublic!==current){
        const text=makePublic?'Opublikować cały album w galerii rodziców?':'Ukryć cały album przed rodzicami?';
        if(!confirm(text))return;
      }
      save.disabled=true;publish.disabled=true;notice.textContent='Zapisuję kartę albumu…';
      try{
        await invoke('moderation_album_save',{album_id:albumId,title:title.value,
          description:description.value,event_date:eventDate.value,cover_approved_item_id:cover.value,
          published:makePublic});
        notice.textContent='✅ Zapisano kartę albumu.';
        await load();
      }catch(e){notice.textContent='⚠️ '+errText(e);save.disabled=false;publish.disabled=false;}
    }
    save.onclick=()=>saveCard(current);
    publish.onclick=()=>saveCard(!current);
    settings.append(card);
  }

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
  const mount=document.querySelector('#galleryAlbums');
  if(!mount||mount.hidden)return;
  const session=readPrivateAccessSession('gallery');
  if(!session?.token)return;
  // Wszystkie albumy (również zatwierdzone kopie OneDrive) tworzą JEDNĄ galerię.
  // Nie dodajemy rodzicom etykiet ani technicznych nagłówków OneDrive.
  const generation=String(1+Number(mount.dataset.sowkiGalleryGeneration||0));
  mount.dataset.sowkiGalleryGeneration=generation;
  mount.querySelectorAll('.sowki-od-album,.sowki-od-error').forEach(x=>x.remove());
  const action=async(type,extras={})=>{
    const s=readPrivateAccessSession('gallery');
    if(!s?.token)throw new Error('Sesja wygasła. Odblokuj galerię hasłem ponownie.');
    const response=await invoke(type,{gallery_token:s.token,device_id:privateAccessDeviceId(),...extras});
    if(response?.token&&response?.expires_at)savePrivateAccessSession('gallery',response);
    return response;
  };
  const formatDate=iso=>{
    if(!iso||!/^\d{4}-\d{2}-\d{2}$/.test(String(iso)))return '';
    const [year,month,day]=String(iso).split('-');return `${day}.${month}.${year}`;
  };
  try{
    const result=await action('public_albums');
    if(!mount.isConnected||mount.hidden||mount.dataset.sowkiGalleryGeneration!==generation)return;
    for(const album of result.albums||[]){
      const article=elt('article','item sowki-od-album');
      const url=goodUrl(album.cover_url);
      if(url){
        const cover=elt('img','album-cover');cover.alt='Okładka albumu '+album.title;
        cover.loading='lazy';cover.decoding='async';cover.referrerPolicy='no-referrer';cover.src=url;
        article.append(cover);
      }else{
        const cover=elt('div','album-cover sowki-od-no-cover');
        cover.setAttribute('aria-label','Okładka chwilowo niedostępna');
        article.append(cover);
      }
      if(album.event_date)article.append(elt('div','date',formatDate(album.event_date)));
      article.append(elt('h3','',album.title||'Album zdjęć'));
      if(album.description)article.append(elt('p','sowki-od-description',album.description));
      const button=elt('button','primary sowki-od-show-all','📸 Zobacz wszystkie zdjęcia tego albumu');
      button.type='button';article.append(button);
      button.onclick=()=>openAlbum(album,action);
      mount.append(article);
    }
  }catch(e){
    if(!mount.isConnected||mount.hidden||mount.dataset.sowkiGalleryGeneration!==generation)return;
    // Opis błędu nie ujawnia rodzicom architektury ani magazynu danych.
    const error=elt('p','sowki-od-error','Nie udało się wczytać części albumów. Spróbuj ponownie otworzyć galerię.');
    mount.append(error);
    console.warn('Sówki: problem z galerią',errText(e));
  }
};

async function openAlbum(album,action){
  const modal=elt('div','sowki-od-album-modal');
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','Album: '+album.title);
  const header=elt('header','sowki-od-album-bar');
  const back=elt('button','sowki-od-back','← Wróć do albumów');back.type='button';
  const heading=elt('h2','',album.title||'Galeria zdjęć');
  const close=elt('button','sowki-od-close','✕');close.type='button';close.setAttribute('aria-label','Zamknij album');
  header.append(back,heading,close);
  const content=elt('div','sowki-od-album-content');
  const help=elt('p','sowki-od-count','Ładowanie zdjęć…');
  const grid=elt('div','sowki-od-phone-grid');
  const more=elt('button','sowki-od-more','Pokaż więcej zdjęć');more.type='button';more.hidden=true;
  const note=elt('p','sowki-od-help','Dotknij zdjęcia, aby powiększyć. Przesuwaj palcem w lewo lub w prawo.');
  content.append(help,note,grid,more);modal.append(header,content);
  const oldFocus=document.activeElement;
  document.body.append(modal);document.body.classList.add('sowki-od-lock');
  let photos=[],offset=0,total=0,hasMore=true,loading=false,viewer=null,closeViewerFn=null,closed=false;
  function cleanup(){
    if(closed)return;
    closed=true;if(closeViewerFn)closeViewerFn();
    modal.remove();document.body.classList.remove('sowki-od-lock');
    document.removeEventListener('keydown',onKey);
    if(oldFocus?.isConnected&&typeof oldFocus.focus==='function')oldFocus.focus();
  }
  function onKey(ev){
    if(ev.key==='Escape'){
      ev.preventDefault();
      if(closeViewerFn)closeViewerFn();else cleanup();
    }
  }
  document.addEventListener('keydown',onKey);
  back.onclick=close.onclick=cleanup;
  more.onclick=loadMore;
  modal.addEventListener('click',e=>{if(e.target===modal)cleanup();});
  close.focus();
  async function loadMore(){
    if(loading||!hasMore||closed)return;
    loading=true;more.disabled=true;more.hidden=true;help.textContent='Wczytuję fotografie…';
    try{
      const page=await action('public_photos',{album_id:album.id,offset});
      if(closed)return;
      total=Number(page.count||0);
      for(const item of page.photos||[]){
        const i=photos.push(item)-1;
        const tile=elt('button','sowki-od-tile');tile.type='button';
        tile.setAttribute('aria-label','Powiększ zdjęcie '+(i+1));
        const img=elt('img');img.loading='lazy';img.decoding='async';
        img.referrerPolicy='no-referrer';img.alt=item.name||'Zdjęcie z albumu';
        img.src=goodUrl(item.thumbnail_url||item.url);
        img.onerror=()=>{if(img.src!==goodUrl(item.url))img.src=goodUrl(item.url);};
        tile.append(img);tile.onclick=()=>openViewer(i);
        grid.append(tile);
      }
      offset+=24;hasMore=!!page.has_more;
      help.textContent=total?`${photos.length} z ${total} zdjęć`:'Brak zdjęć w albumie.';
      more.hidden=!hasMore;
    }catch(e){
      help.textContent='Nie można pobrać zdjęć. Spróbuj ponownie.';
      more.hidden=false;more.textContent='↻ Spróbuj ponownie';
    }finally{loading=false;more.disabled=false;}
  }
  await loadMore();

  function openViewer(start){
    if(closeViewerFn)closeViewerFn();
    let current=start,touchStart=null;
    const box=elt('div','sowki-od-viewer');viewer=box;
    box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
    box.setAttribute('aria-label','Podgląd zdjęcia');
    const top=elt('div','sowki-od-viewer-bar');
    const counter=elt('span','sowki-od-counter');
    const download=elt('button','sowki-od-download','⬇ Pobierz');download.type='button';
    const end=elt('button','sowki-od-viewer-close','✕');end.type='button';end.setAttribute('aria-label','Zamknij zdjęcie');
    const image=elt('img','sowki-od-full-photo');image.referrerPolicy='no-referrer';
    const prev=elt('button','sowki-od-prev','‹');prev.type='button';prev.setAttribute('aria-label','Poprzednie zdjęcie');
    const next=elt('button','sowki-od-next','›');next.type='button';next.setAttribute('aria-label','Następne zdjęcie');
    top.append(counter,download,end);box.append(top,prev,image,next);modal.append(box);
    const closeViewer=()=>{box.remove();viewer=null;closeViewerFn=null;document.removeEventListener('keydown',onViewerKey);};
    closeViewerFn=closeViewer;
    end.onclick=closeViewer;
    box.onclick=e=>{if(e.target===box)closeViewer();};
    async function show(delta){
      const i=current+delta;
      if(i<0||i>=photos.length)return;
      current=i;
      const data=photos[i];image.alt=data.name||'Zdjęcie z albumu';
      image.src=goodUrl(data.url);counter.textContent=`${i+1} / ${total||photos.length}`;
      prev.disabled=i===0;next.disabled=i===photos.length-1&&!hasMore;
      if(i>=photos.length-3&&hasMore)void loadMore();
    }
    prev.onclick=()=>void show(-1);
    next.onclick=async()=>{if(current===photos.length-1&&hasMore)await loadMore();void show(1);};
    function onViewerKey(e){
      if(e.key==='ArrowLeft'){e.preventDefault();void show(-1);}
      if(e.key==='ArrowRight'){e.preventDefault();next.click();}
      if(e.key==='Escape'){document.removeEventListener('keydown',onViewerKey);}
    }
    document.addEventListener('keydown',onViewerKey);
    box.addEventListener('touchstart',e=>{if(e.touches.length===1){touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};}},{passive:true});
    box.addEventListener('touchend',e=>{
      if(!touchStart||e.changedTouches.length!==1)return;
      const dx=e.changedTouches[0].clientX-touchStart.x;
      const dy=e.changedTouches[0].clientY-touchStart.y;touchStart=null;
      if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4){if(dx<0)next.click();else prev.click();}
    },{passive:true});
    download.onclick=async()=>{
      download.disabled=true;download.textContent='Pobieram…';
      try{
        const item=photos[current],blob=await imgBlob(item.url);
        const local=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=local;a.download=item.name||'zdjecie.jpg';
        document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(local),60000);
      }catch(e){
        // Nie każdy wariant OneDrive dopuszcza fetch CORS w Safari.
        // Otwórz tymczasowy odnośnik, by użytkownik mógł zapisać zdjęcie ręcznie.
        const u=goodUrl(photos[current]?.url);
        if(u&&confirm('Nie udało się automatycznie pobrać pliku. Otworzyć zdjęcie w nowej karcie, aby je zapisać?'))
          window.open(u,'_blank','noopener,noreferrer');
      }finally{download.disabled=false;download.textContent='⬇ Pobierz';}
    };
    void show(0);
    end.focus();
  }
}

})();
