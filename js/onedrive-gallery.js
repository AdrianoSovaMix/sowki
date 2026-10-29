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

// Okładka nie jest częścią albumu zdjęć. Lokalne pomniejszenie i konwersja do JPG
// usuwa EXIF, ogranicza transfer i umożliwia zdjęcia HEIC na zgodnych urządzeniach.
async function prepareAlbumCover(file){
  if(!file||!file.size||file.size>25*1024*1024)throw Error('Zdjęcie okładki może mieć maksymalnie 25 MB.');
  if(!/\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name))throw Error('Wybierz plik JPG, PNG, WebP lub HEIC.');
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;
    try{await image.decode();}catch{throw Error('Przeglądarka nie potrafi otworzyć tego pliku. Wybierz JPG lub PNG.');}
    const w=image.naturalWidth,h=image.naturalHeight;
    if(!w||!h||w*h>90_000_000)throw Error('Zbyt duże zdjęcie okładki.');
    const scale=Math.min(1,1800/Math.max(w,h));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Brak możliwości przetwarzania zdjęcia.');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const jpeg=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.9));
    if(!jpeg||!jpeg.size||jpeg.size>8*1024*1024)throw Error('Nie udało się przygotować okładki. Wybierz mniejszy plik JPG.');
    return jpeg;
  }finally{URL.revokeObjectURL(url);}
}

window.sowkiOneDriveModerationMount=async function(box,albumSelect){
  const dialog=box?.sowkiGalleryDialog;if(!dialog)return;
  const settings=dialog.querySelector('#sowkiGalleryStage2');
  const stage3=dialog.querySelector('#sowkiGalleryStage3');
  const stage4=dialog.querySelector('#sowkiGalleryStage4');
  stage3.innerHTML='<div class="sowki-gallery-intro"><h3>🟪 Zaznacz twarze do ukrycia</h3><p>Wybierz folder, kliknij miniaturę i zaznacz twarze mozaiką. Po zapisaniu zdjęcie zniknie stąd i trafi do etapu 4.</p></div><div class="sowki-mod-controls"><button type="button" class="sowki-mod-refresh-3">↻ Odśwież zdjęcia</button><span class="sowki-mod-summary-3" role="status"></span></div><div class="sowki-mod-list sowki-gallery-image-grid"></div>';
  stage4.innerHTML='<div class="sowki-gallery-intro"><h3>✅ Ostatnia kontrola przed publikacją</h3><p>Obejrzyj przygotowaną wersję i potwierdź, że wszystkie potrzebne twarze są ukryte. Możesz wrócić do mozaiki.</p></div><div class="sowki-mod-controls"><button type="button" class="sowki-mod-refresh-4">↻ Odśwież zdjęcia</button><span class="sowki-mod-summary-4" role="status"></span></div><div class="sowki-mod-ready sowki-gallery-image-grid"></div><details class="sowki-gallery-published"><summary>🟢 Zdjęcia już zatwierdzone (zarządzanie)</summary><div class="sowki-gallery-published-list sowki-gallery-image-grid"></div></details>';
  const sourceVideos=elt('section','sowki-gallery-video-section');
  sourceVideos.innerHTML='<h3>🎬 Filmy do profesjonalnego montażu</h3><div class="sowki-gallery-video-pending" role="status"></div>';
  stage3.append(sourceVideos);
  const finalVideos=elt('section','sowki-gallery-video-section');
  finalVideos.innerHTML='<h3>🎞️ Gotowe filmy do sprawdzenia</h3><button type="button" class="sowki-gallery-video-refresh">↻ Wczytaj gotowe filmy</button><div class="sowki-gallery-video-final" role="status"></div>';
  stage4.append(finalVideos);
  const videoPending=sourceVideos.querySelector('.sowki-gallery-video-pending');
  const videoFinal=finalVideos.querySelector('.sowki-gallery-video-final');
  const photos=stage3.querySelector('.sowki-mod-list');
  const ready=stage4.querySelector('.sowki-mod-ready');
  const published=stage4.querySelector('.sowki-gallery-published-list');
  const publishedDetails=stage4.querySelector('.sowki-gallery-published');
  const editorDialog=document.createElement('dialog');editorDialog.className='sowki-gallery-dialog sowki-gallery-photo-dialog';
  editorDialog.innerHTML='<div class="sowki-gallery-dialog-layout"><header class="sowki-gallery-dialog-head"><h2>🟪 Ukrywanie twarzy</h2><button type="button" class="sowki-photo-dialog-close" aria-label="Zamknij edytor">✕</button></header><div class="sowki-gallery-dialog-content"><div class="sowki-mod-editor"></div></div></div>';
  document.body.append(editorDialog);
  const editor=editorDialog.querySelector('.sowki-mod-editor');
  let editorCancel=null,editorBusy=false,requestId=0,currentStep=2;
  let chosenAlbum='';let busy=false;
  const setMsg=(txt)=>{const target=currentStep===4?stage4.querySelector('.sowki-mod-summary-4'):stage3.querySelector('.sowki-mod-summary-3');target.textContent=txt;};
  const section=settings;
  const refreshAlbumPicker=async(preferred='')=>{if(typeof box.sowkiRefreshAlbums==='function')await box.sowkiRefreshAlbums(preferred);};
  function confirmTyped(name,text){if(!confirm(text))return false;return prompt(`Wpisz nazwę albumu, aby potwierdzić:\n${name}`)===name;}
  function closeEditor(){if(editorBusy)return;editorCancel?.click();if(editorDialog.open)editorDialog.close();editor.replaceChildren();editorCancel=null;}
  editorDialog.querySelector('.sowki-photo-dialog-close').onclick=closeEditor;
  editorDialog.addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
  const adminDialog=document.querySelector('#dlg');
  if(adminDialog)adminDialog.addEventListener('close',()=>{closeEditor();editorDialog.remove();},{once:true});
  const stageIsCurrent=(step,id,request)=>box.isConnected&&albumSelect.value===id&&request===requestId&&currentStep===step;
  let metadataRequest=0;
  async function loadDetails(){
    const request=++metadataRequest,id=albumSelect.value;
    settings.replaceChildren();
    if(!id){settings.append(elt('p','sowki-gallery-empty','Wybierz folder zdjęć powyżej.'));return;}
    settings.append(elt('p','sowki-gallery-empty','Ładuję kartę albumu…'));
    try{const data=await invoke('moderation_album_get',{album_id:id});
      if(request===metadataRequest&&albumSelect.value===id&&box.isConnected)renderAlbumSettings(data,id);
    }catch(e){if(request===metadataRequest&&box.isConnected)settings.textContent='⚠️ '+errText(e);}
  }
  function photoTile(name,subtitle,action){
    const tile=elt('button','sowki-gallery-thumb');tile.type='button';
    const image=elt('span','sowki-gallery-thumb-image');image.textContent='📷';
    const title=elt('strong','',name);const note=elt('small','',subtitle);
    tile.append(image,title,note);tile.addEventListener('click',action);
    return {tile,image};
  }
  // Miniatury pobieramy porcjami (max 12) dopiero podczas otwarcia etapu.
  // Serwer sprawdza dostęp właściciela i przynależność zdjęć do albumu.
  async function getThumbnailBatch(id,mode,pairs,step,request){
    if(!pairs.length)return;
    try{
      const res=await invoke('moderation_thumbnails',{album_id:id,mode,item_ids:pairs.map(p=>p.id)});
      if(!stageIsCurrent(step,id,request))return;
      const byId=new Map((res.thumbnails||[]).map(t=>[String(t.id),t.url]));
      for(const {id,image} of pairs){const url=goodUrl(byId.get(String(id)));
        if(!url)continue;
        const img=elt('img');img.alt='Miniatura zdjęcia';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.src=url;
        img.onerror=()=>{img.remove();image.textContent='📷';};image.replaceChildren(img);
      }
    }catch(e){/* Brak miniaturek nigdy nie może blokować sprawdzania zdjęć. */}
  }
  function paginatedTiles(target,items,step,id,request,mode,build){
    target.replaceChildren();let index=0;const pageSize=12;
    if(!items.length){target.append(elt('p','sowki-gallery-empty',step===3?'✅ W tym folderze nie ma nowych zdjęć do przygotowania.':'✅ Wszystkie przygotowane zdjęcia zostały zatwierdzone.'));return;}
    const more=elt('button','sowki-gallery-more','Pokaż kolejne zdjęcia');more.type='button';
    const add=()=>{
      more.remove();if(!stageIsCurrent(step,id,request))return;
      const batch=items.slice(index,index+pageSize),requests=[];index+=batch.length;
      for(const item of batch){const {tile,image,wrapper}=build(item);target.append(wrapper||tile);requests.push({id:mode==='prepared'?String(item.approved_item_id):String(item.id),image});}
      void getThumbnailBatch(id,mode,requests,step,request);
      if(index<items.length)target.append(more);
    };
    more.onclick=add;add();
  }
  async function loadStage(step){
    if(![3,4].includes(step))return;
    currentStep=step;
    const request=++requestId,id=albumSelect.value;
    photos.replaceChildren();ready.replaceChildren();published.replaceChildren();publishedDetails.hidden=true;
    const where=step===3?stage3.querySelector('.sowki-mod-summary-3'):stage4.querySelector('.sowki-mod-summary-4');
    if(!id){where.textContent='Wybierz folder powyżej.';return;}
    void loadVideoStage(step,id,request);
    where.textContent='⏳ Pobieram listę plików…';
    try{
      if(step===3){
        const r=await invoke('moderation_list',{album_id:id});
        if(!stageIsCurrent(3,id,request))return;
        const list=(r.files||[]).filter(x=>!x.has_prepared);
        where.textContent=`📷 Do przygotowania: ${list.length}${r.more?' (wynik ograniczony do 900 plików)':''}`;
        paginatedTiles(photos,list,3,id,request,'original',file=>{
          const card=photoTile(file.name,'🟪 Zaznacz mozaikę',()=>startEditing(file,id));
          const wrapper=elt('article','sowki-gallery-thumb-card');
          wrapper.append(card.tile);
          const trash=elt('button','sowki-gallery-thumb-trash','🗑️ Usuń oryginał');trash.type='button';
          trash.onclick=async()=>{
            if(!confirm(`Przenieść „${file.name}” do kosza OneDrive? To usunie również powiązaną kopię, jeśli istnieje.`))return;
            trash.disabled=true;
            try{await invoke('moderation_photo_trash',{album_id:id,source_item_id:file.id,mode:'everything'});await loadStage(3);}
            catch(e){alert('Nie udało się usunąć zdjęcia: '+errText(e));trash.disabled=false;}
          };
          wrapper.append(trash);card.wrapper=wrapper;return card;
        });
      }else{
        const r=await invoke('moderation_prepared_list',{album_id:id});
        if(!stageIsCurrent(4,id,request))return;
        const waiting=(r.photos||[]).filter(p=>!p.published),done=(r.photos||[]).filter(p=>p.published);
        where.textContent=`🔒 Czeka na zatwierdzenie: ${waiting.length} • opublikowane: ${done.length}`;
        paginatedTiles(ready,waiting,4,id,request,'prepared',p=>photoTile(p.approved_name,'👀 Obejrzyj i zatwierdź',()=>openReview(p,id)));
        if(done.length){publishedDetails.hidden=false;publishedDetails.querySelector('summary').textContent=`🟢 Opublikowane (${done.length}) — kliknij, aby zarządzać`;
          paginatedTiles(published,done,4,id,request,'prepared',p=>photoTile(p.approved_name,'🔒 Edytuj lub cofnij',()=>openReview(p,id)));}
      }
    }catch(e){if(stageIsCurrent(step,id,request))where.textContent='⚠️ '+errText(e);}
  }
  const reviewDialog=document.createElement('dialog');reviewDialog.className='sowki-gallery-dialog sowki-gallery-review-dialog';document.body.append(reviewDialog);
  function closeReview(){if(reviewDialog.open)reviewDialog.close();reviewDialog.replaceChildren();}
  reviewDialog.addEventListener('cancel',e=>{e.preventDefault();closeReview();});
  if(adminDialog)adminDialog.addEventListener('close',()=>{closeReview();reviewDialog.remove();},{once:true});
  async function openReview(p,id){
    const d=reviewDialog;d.replaceChildren();
    const body=elt('div','sowki-gallery-review-body');
    const head=elt('header','sowki-gallery-dialog-head');head.append(elt('h2','','✅ Ostateczna kontrola zdjęcia'));
    const exit=elt('button','sowki-gallery-review-exit','✕');exit.type='button';exit.setAttribute('aria-label','Zamknij podgląd');exit.onclick=closeReview;head.append(exit);
    const content=elt('div','sowki-gallery-dialog-content');
    const image=elt('img','sowki-gallery-review-image');image.alt='Zanonimizowana kopia zdjęcia';image.referrerPolicy='no-referrer';
    const note=elt('p','sowki-gallery-review-note','Wczytuję przygotowane zdjęcie z OneDrive…');
    const label=elt('label','sowki-gallery-review-check');const check=elt('input');check.type='checkbox';
    label.append(check,elt('span','','✅ Obejrzałem gotową kopię i potwierdzam, że wszystkie wymagane twarze są nieczytelne.'));
    const actions=elt('div','sowki-gallery-review-buttons');
    const approve=elt('button','primary',p.published?'🔒 Cofnij zatwierdzenie':'✅ Zatwierdź i udostępnij zdjęcie');approve.disabled=true;
    const fix=elt('button','','🟪 Popraw mozaikę');fix.type='button';
    const remove=elt('button','sowki-danger-action','🗑️ Usuń przygotowaną kopię');remove.type='button';
    const status=elt('p','sowki-gallery-review-status','');status.setAttribute('role','status');
    actions.append(approve,fix,remove);
    content.append(image,note,label,actions,status);body.append(head,content);d.append(body);d.showModal();
    let loaded=false;
    check.onchange=()=>{approve.disabled=!loaded||(!p.published&&!check.checked);};
    try{const r=await invoke('moderation_approved_preview',{source_item_id:p.source_item_id});
      if(!d.open)return;const url=goodUrl(r.url);if(!url)throw Error('Brak adresu podglądu.');
      image.src=url;await image.decode();if(!d.open)return;
      loaded=true;note.textContent=p.published?'To zdjęcie jest zatwierdzone. Możesz je ukryć lub poprawić.':'Obejrzyj całe zdjęcie, zanim zatwierdzisz.';
      approve.disabled=p.published?false:!check.checked;
    }catch(e){note.textContent='⚠️ Nie udało się wyświetlić zdjęcia: '+errText(e);}
    approve.onclick=async()=>{
      if(!loaded||(!p.published&&!check.checked))return;
      if(!confirm(p.published?'Wycofać zdjęcie z galerii rodziców?':'Czy wszystkie twarze zostały sprawdzone i zdjęcie może być pokazane rodzicom?'))return;
      approve.disabled=true;status.textContent='Zapisuję decyzję…';
      try{await invoke('moderation_publish',{source_item_id:p.source_item_id,published:!p.published,visually_reviewed:true});
        closeReview();void loadStage(4);
      }catch(e){status.textContent='⚠️ '+errText(e);approve.disabled=false;}
    };
    fix.onclick=async()=>{
      fix.disabled=true;status.textContent='Pobieram oryginał do ponownej edycji…';
      try{const r=await invoke('moderation_list',{album_id:id});
        const original=(r.files||[]).find(x=>String(x.id)===String(p.source_item_id));
        if(!original)throw Error('Nie znaleziono oryginału.');
        closeReview();void startEditing(original,id);
      }catch(e){status.textContent='⚠️ '+errText(e);fix.disabled=false;}
    };
    remove.onclick=async()=>{
      if(!confirm('Usunąć przygotowaną kopię z OneDrive? Oryginał pozostanie w folderze i wróci do etapu 3.'))return;
      remove.disabled=true;
      try{await invoke('moderation_photo_trash',{album_id:id,source_item_id:p.source_item_id,mode:'approved_only'});
        closeReview();void loadStage(4);
      }catch(e){status.textContent='⚠️ '+errText(e);remove.disabled=false;}
    };
  }

  const videoDialog=document.createElement('dialog');videoDialog.className='sowki-gallery-dialog sowki-gallery-video-dialog';document.body.append(videoDialog);
  function closeVideo(){
    const v=videoDialog.querySelector('video');if(v){v.pause();v.removeAttribute('src');v.load();}
    if(videoDialog.open)videoDialog.close();videoDialog.replaceChildren();
  }
  videoDialog.addEventListener('cancel',e=>{e.preventDefault();closeVideo();});
  function makeVideoLine(file,callback,caption){
    const row=elt('div','sowki-gallery-video-line');
    const info=elt('span','sowki-gallery-video-info');
    info.append(elt('strong','',String(file.name)),elt('small','',`${(Number(file.size)/1048576).toFixed(0)} MB ${caption||''}`));
    const button=elt('button','',caption?.includes('montażu')?'⬇ Otwórz / pobierz':'▶ Obejrzyj i zdecyduj');
    button.type='button';button.onclick=callback;row.append(info,button);return row;
  }
  async function loadVideoStage(step,id,request){
    const area=step===3?videoPending:videoFinal;
    area.replaceChildren(elt('p','','⏳ Sprawdzam nagrania…'));
    try{
      const result=await invoke(step===3?'video_originals':'video_finals',{album_id:id});
      if(!stageIsCurrent(step,id,request))return;
      area.replaceChildren();
      if(step===4&&!result.folder_exists)
        area.append(elt('p','sowki-gallery-video-hint','📁 Brak folderu gotowych filmów. Utwórz na OneDrive folder: '+result.folder_hint));
      if(step===4&&!result.folder_exists){
        const create=elt('button','', '📁 Utwórz folder gotowych filmów');create.type='button';
        create.onclick=async()=>{create.disabled=true;try{await invoke('video_final_folder_ensure',{album_id:id});void loadStage(4);}catch(e){area.append(elt('p','','⚠️ '+errText(e)));create.disabled=false;}};
        area.append(create);
      }
      if(!result.videos?.length)area.append(elt('p','sowki-gallery-video-hint',step===3?'Nie ma tu jeszcze filmów.':'Nie znaleziono gotowych filmów MP4.'));
      const list=elt('div','sowki-gallery-video-lines');area.append(list);
      for(const file of result.videos||[]){
        list.append(makeVideoLine(file,()=>step===3?openOriginalVideo(file,id):openReadyVideo(file,id),
          step===3?'• do montażu':(file.published?'• 🟢 opublikowany':'• 🔒 czeka na zatwierdzenie')));
      }
      if(result.more)area.append(elt('p','','⚠️ Wyświetlono tylko pierwsze 450 filmów.'));
    }catch(e){if(stageIsCurrent(step,id,request))area.textContent='⚠️ '+errText(e);}
  }
  async function openOriginalVideo(file,id){
    const d=videoDialog;d.replaceChildren();
    const wrap=elt('div','sowki-gallery-video-modal');
    const close=elt('button','sowki-gallery-video-exit','✕ Zamknij');close.onclick=closeVideo;
    wrap.append(close,elt('h2','','🎬 Oryginał – do montażu'),elt('p','',file.name));
    const status=elt('p','','Pobieram prywatny adres…');wrap.append(status);d.append(wrap);d.showModal();
    try{
      const res=await invoke('video_original_preview',{album_id:id,item_id:file.id});
      if(!d.open)return;
      const url=goodUrl(res.url);if(!url)throw Error('Brak odnośnika do nagrania.');
      status.textContent='Otwórz plik i zapisz go na komputerze. Oryginał nie zostanie pokazany rodzicom.';
      const link=elt('a','sowki-gallery-video-link','⬇ Otwórz oryginalny film / pobierz');
      link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';
      wrap.append(link);
      const trash=elt('button','sowki-gallery-video-trash','🗑️ Usuń oryginał z OneDrive');trash.type='button';
      trash.onclick=async()=>{
        if(!confirm('Przenieść ORYGINALNY film do kosza? Tej operacji nie da się odwrócić w Sówkach.'))return;
        if(prompt('Wpisz dokładną nazwę filmu:\n'+file.name)!==file.name)return;
        trash.disabled=true;
        try{await invoke('video_original_trash',{album_id:id,item_id:file.id,confirm_name:file.name});
          closeVideo();void loadStage(3);
        }catch(e){status.textContent='⚠️ '+errText(e);trash.disabled=false;}
      };wrap.append(trash);
    }catch(e){status.textContent='⚠️ '+errText(e);}
  }
  async function openReadyVideo(file,id){
    closeVideo();const d=videoDialog;
    const wrap=elt('div','sowki-gallery-video-modal');
    const close=elt('button','sowki-gallery-video-exit','✕ Zamknij');close.type='button';close.onclick=closeVideo;
    wrap.append(close,elt('h2','','🎞️ Ostateczna kontrola filmu'),elt('p','',file.name));
    const video=elt('video','sowki-gallery-video-player');video.controls=true;video.playsInline=true;video.preload='metadata';
    const message=elt('p','','⏳ Otwieram gotowy film…');message.setAttribute('role','status');
    const label=elt('label','sowki-gallery-video-confirm');const check=elt('input');check.type='checkbox';
    label.append(check,elt('span','','✅ Obejrzałem GOTOWY film i sprawdziłem wszystkie twarze, dźwięk, dane osobowe i zgody.'));
    const approve=elt('button','primary',file.published?'🔒 Wycofaj film z galerii':'✅ Zatwierdź i opublikuj film');approve.disabled=true;
    const trash=elt('button','sowki-gallery-video-trash','🗑️ Usuń gotowy film z OneDrive');
    const actions=elt('div','sowki-gallery-video-actions');actions.append(approve,trash);
    wrap.append(video,message,label,actions);d.append(wrap);d.showModal();
    let ready=false;
    check.onchange=()=>{approve.disabled=!ready||!check.checked;};
    try{
      const r=await invoke('video_final_preview',{album_id:id,item_id:file.id});
      if(!d.open)return;
      const url=goodUrl(r.url);if(!url)throw Error('Nieprawidłowy adres nagrania.');
      video.src=url;ready=true;message.textContent='Gotowy film jest prywatny do chwili zatwierdzenia. Obejrzyj go przed decyzją.';
      approve.disabled=!check.checked;
    }catch(e){message.textContent='⚠️ '+errText(e);}
    approve.onclick=async()=>{
      if(!ready||!check.checked)return;
      if(!confirm(file.published?'Wycofać film z galerii rodziców?':'Udostępnić GOTOWY film rodzicom? Potwierdzasz jego ręczne sprawdzenie.'))return;
      approve.disabled=true;message.textContent='⏳ Zapisuję decyzję…';
      try{await invoke('video_publish',{album_id:id,item_id:file.id,published:!file.published,visually_reviewed:true});
        closeVideo();void loadStage(4);
      }catch(e){message.textContent='⚠️ '+errText(e);approve.disabled=false;}
    };
    trash.onclick=async()=>{
      if(!confirm('Przenieść GOTOWY film do kosza OneDrive? Oryginał w 01_DO_WERYFIKACJI pozostanie.'))return;
      if(prompt('Wpisz dokładną nazwę filmu, aby potwierdzić:\n'+file.name)!==file.name)return;
      trash.disabled=true;message.textContent='⏳ Przenoszę gotowy film do kosza…';
      try{await invoke('video_trash',{album_id:id,item_id:file.id,confirm_name:file.name});
        closeVideo();void loadStage(4);
      }catch(e){message.textContent='⚠️ '+errText(e);trash.disabled=false;}
    };
  }
  finalVideos.querySelector('.sowki-gallery-video-refresh').onclick=()=>loadStage(4);
  box.addEventListener('sowki:gallery-close',closeVideo);
  box.addEventListener('sowki:gallery-destroy',()=>{closeVideo();videoDialog.remove();});
  if(adminDialog)adminDialog.addEventListener('close',()=>{closeVideo();videoDialog.remove();},{once:true});

  stage3.querySelector('.sowki-mod-refresh-3').onclick=()=>loadStage(3);
  stage4.querySelector('.sowki-mod-refresh-4').onclick=()=>loadStage(4);
  albumSelect.addEventListener('change',()=>{
    requestId++;metadataRequest++;
    if(!dialog.open)return;
    if(currentStep===2)void loadDetails();
    if(currentStep===3||currentStep===4)void loadStage(currentStep);
  });
  box.addEventListener('sowki:open-step',e=>{
    currentStep=Number(e.detail?.step)||1;
    if(currentStep===2)void loadDetails();
    if(currentStep===3||currentStep===4)void loadStage(currentStep);
  });
  box.addEventListener('sowki:gallery-close',()=>{requestId++;metadataRequest++;closeReview();closeEditor();});
  box.addEventListener('sowki:gallery-destroy',()=>{requestId++;metadataRequest++;closeReview();closeEditor();reviewDialog.remove();editorDialog.remove();});

  function renderAlbumSettings(info,albumId){
    settings.replaceChildren();
    const data=info.album||{};
    const card=elt('section','sowki-mod-album-card');
    card.append(elt('h4','',data.archived?'📦 Album w archiwum':(data.published?'🟢 Edytujesz opublikowany album':'📝 Edytujesz album ukryty')));
    card.append(elt('p','sowki-mod-album-intro','Tytuł, data i opis będą widoczne tak jak w pozostałych albumach. Okładka jest opcjonalna: bez niej aplikacja wyświetli estetyczną planszę wydarzenia.'));
    const field=(label,control)=>{const lbl=elt('label','sowki-album-label',label);lbl.append(control);card.append(lbl);};
    const title=elt('input');title.type='text';title.maxLength=140;title.value=data.title||'';
    field('Tytuł wydarzenia',title);
    const description=elt('textarea');description.maxLength=3000;description.rows=3;description.value=data.description||'';
    description.placeholder='Co działo się podczas wydarzenia?';field('Opis wydarzenia',description);
    const eventDate=elt('input');eventDate.type='date';eventDate.value=data.event_date||'';
    field('Data wydarzenia (opcjonalnie)',eventDate);
    const coverArea=elt('section','sowki-cover-upload-area');
    coverArea.append(elt('h5','','🖼️ Dodaj zdjęcie okładki tego albumu/galerii'));
    const fileInput=elt('input');fileInput.type='file';fileInput.accept='image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';
    fileInput.setAttribute('aria-label','Wybierz zdjęcie okładki z telefonu');
    fieldCover('Wybierz plik na okładkę',fileInput);
    function fieldCover(label,control){const lbl=elt('label','sowki-album-label',label);lbl.append(control);coverArea.append(lbl);}
    const coverPreview=elt('img','sowki-album-cover-preview');coverPreview.hidden=true;
    coverPreview.alt='Podgląd wybranej okładki wydarzenia';coverPreview.referrerPolicy='no-referrer';
    const coverFallback=elt('div','sowki-cover-empty','🦉 Bez własnego zdjęcia pojawi się automatyczna plansza z tytułem wydarzenia.');
    const coverNote=elt('small','sowki-album-preview-status');coverNote.setAttribute('role','status');
    const coverButtons=elt('div','sowki-cover-actions');
    const clearCover=elt('button','','✕ Usuń okładkę');clearCover.type='button';
    coverButtons.append(clearCover);
    coverArea.append(coverPreview,coverFallback,coverButtons,coverNote);
    card.append(coverArea);
    let uploadedCoverId=String(data.cover_item_id||'');
    let previewLocalUrl=null,coverBusy=false;
    const existingCover=goodUrl(data.cover_url);
    if(existingCover){coverPreview.src=existingCover;coverPreview.hidden=false;coverFallback.hidden=true;}
    function forgetLocal(){if(previewLocalUrl){URL.revokeObjectURL(previewLocalUrl);previewLocalUrl=null;}}
    // Okładka wgrywa się automatycznie po wybraniu pliku. Dopiero przycisk
    // „Zapisz” wiąże nową okładkę z kartą albumu; nie publikuje niczego sam.
    fileInput.onchange=async()=>{
      if(coverBusy)return;
      const file=fileInput.files?.[0];if(!file)return;
      coverBusy=true;dialog.dataset.coverBusy='1';
      fileInput.disabled=true;clearCover.disabled=true;albumSelect.disabled=true;
      const albumReload=dialog.querySelector('#sowkiOneDriveReload');
      if(albumReload)albumReload.disabled=true;
      save.disabled=true;publish.disabled=true;
      coverNote.textContent='⏳ Przygotowuję okładkę…';
      let newPreviewUrl=null;
      try{
        const jpeg=await prepareAlbumCover(file);
        newPreviewUrl=URL.createObjectURL(jpeg);
        coverPreview.src=newPreviewUrl;coverPreview.hidden=false;coverFallback.hidden=true;
        coverNote.textContent='⏳ Przesyłam okładkę…';
        const session=await invoke('album_cover_prepare',{album_id:albumId,size:jpeg.size});
        if(!goodUrl(session.upload_url))throw Error('Brak poprawnej sesji zapisu okładki.');
        const chunkSize=Number(session.chunk_size)||5*1024*1024;
        let last=null;
        for(let from=0;from<jpeg.size;from+=chunkSize){
          const end=Math.min(jpeg.size,from+chunkSize);
          last=await sowkiOneDriveUploadChunk(session.upload_url,jpeg.slice(from,end),from,jpeg.size,
            sent=>{coverNote.textContent=`⏳ Przesyłam okładkę: ${Math.min(100,Math.round(sent/jpeg.size*100))}%`;});
          if(end<jpeg.size&&last.status!==202)throw Error('OneDrive przerwał wysyłanie okładki.');
        }
        if(!last||![200,201].includes(last.status)||!last.data?.id)throw Error('OneDrive nie potwierdził zapisu okładki.');
        const receipt=await invoke('album_cover_confirm',{album_id:albumId,item_id:last.data.id});
        if(!receipt?.ok||!receipt?.cover_item_id)throw Error('Nie potwierdzono okładki w prywatnym folderze.');
        uploadedCoverId=String(receipt.cover_item_id);
        forgetLocal();previewLocalUrl=newPreviewUrl;newPreviewUrl=null;
        coverNote.textContent='✅ Okładka przesłana. Kliknij „Zapisz”, aby zapisać zmianę.';
      }catch(e){
        coverNote.textContent='⚠️ Nie udało się przesłać okładki: '+errText(e)+' Wybierz plik ponownie.';
        // Nie pokazuj niezapisanego obrazu jako nowej okładki.
        if(previewLocalUrl){coverPreview.src=previewLocalUrl;coverPreview.hidden=false;coverFallback.hidden=true;}
        else if(existingCover&&uploadedCoverId===String(data.cover_item_id||'')){coverPreview.src=existingCover;coverPreview.hidden=false;coverFallback.hidden=true;}
        else{coverPreview.removeAttribute('src');coverPreview.hidden=true;coverFallback.hidden=false;}
      }finally{
        if(newPreviewUrl)URL.revokeObjectURL(newPreviewUrl);
        fileInput.value='';fileInput.disabled=false;clearCover.disabled=false;
        albumSelect.disabled=false;
        const albumReload=dialog.querySelector('#sowkiOneDriveReload');
        if(albumReload)albumReload.disabled=false;
        coverBusy=false;delete dialog.dataset.coverBusy;
        save.disabled=archived;publish.disabled=archived;
      }
    };
    clearCover.onclick=()=>{
      if(coverBusy)return;
      uploadedCoverId='';fileInput.value='';
      forgetLocal();coverPreview.removeAttribute('src');coverPreview.hidden=true;coverFallback.hidden=false;
      coverNote.textContent='Bez okładki — kliknij „Zapisz”, aby zachować zmianę.';
    };
    const current=!!data.published;
    const archived=!!data.archived;
    const state=elt('p','sowki-album-visibility',current?'✅ Album jest widoczny dla rodziców.':'🔒 Album jest ukryty przed rodzicami.');card.append(state);
    const buttons=elt('div','sowki-album-buttons');
    const save=elt('button','','💾 Zapisz');save.type='button';
    const publish=elt('button','primary',current?'🔒 Ukryj cały album':'🌍 Opublikuj cały album');publish.type='button';
    save.disabled=archived;publish.disabled=archived;
    buttons.append(save,publish);card.append(buttons);
    const management=elt('details','sowki-od-danger-zone');
    management.append(elt('summary','','⚙️ Więcej opcji: archiwizacja, synchronizacja i usuwanie albumu'));
    const sync=elt('button','','🔄 Synchronizuj zdjęcia');sync.type='button';
    const archive=elt('button','',archived?'↩ Przywróć album':'📦 Usuń z aplikacji (archiwizuj)');archive.type='button';
    const deleteAll=elt('button','sowki-danger-action','🗑️ Usuń album i pliki z OneDrive');deleteAll.type='button';
    const toolFeedback=elt('p','sowki-album-feedback');toolFeedback.setAttribute('role','status');
    management.append(elt('p','','Archiwizacja chowa album przed rodzicami i z listy aktywnych albumów, ale zachowuje zdjęcia. Usunięcie z OneDrive przenosi oryginały i przygotowane kopie do kosza Microsoft.'));
    const actionRow=elt('div','sowki-od-danger-buttons');actionRow.append(sync,archive,deleteAll);
    management.append(actionRow,toolFeedback);card.append(management);
    const pending=(val)=>{sync.disabled=archive.disabled=deleteAll.disabled=val;};
    sync.onclick=async()=>{
      pending(true);toolFeedback.textContent='Porównuję zdjęcia z OneDrive…';
      try{const r=await invoke('moderation_album_sync',{album_id:albumId});
        toolFeedback.textContent=`✅ Oryginały: ${r.originals}, przygotowane: ${r.prepared}. Ukryte niedostępne kopie: ${r.stale_hidden}.`;
        // Lista jest ładowana dopiero po otwarciu etapu 3 lub 4.
      }
      catch(e){toolFeedback.textContent='⚠️ '+errText(e);}finally{pending(false);}
    };
    archive.onclick=async()=>{
      if(!archived&&!confirm('Przenieść album do archiwum? Rodzice natychmiast przestaną go widzieć. Zdjęcia pozostaną na OneDrive.'))return;
      pending(true);toolFeedback.textContent='Zapisuję zmianę…';
      try{await invoke('moderation_album_archive',{album_id:albumId,archived:!archived});
        await refreshAlbumPicker(archived?albumId:'');}
      catch(e){toolFeedback.textContent='⚠️ '+errText(e);pending(false);}
    };
    deleteAll.onclick=async()=>{
      const name=albumSelect.selectedOptions?.[0]?.dataset.albumName||'';
      if(!confirmTyped(name,'UWAGA: usunięcie przeniesie WSZYSTKIE pliki z albumu (oryginały i przygotowane kopie) do kosza OneDrive. Tego nie można cofnąć w aplikacji. Kontynuować?')){
        toolFeedback.textContent='Usuwanie anulowane lub nazwa albumu niezgodna.';return;
      }
      pending(true);toolFeedback.textContent='Przenoszę foldery do kosza OneDrive…';
      try{const deleted=await invoke('moderation_album_trash',{album_id:albumId,confirm_name:name});
        await refreshAlbumPicker();
        const note=dialog.querySelector('#sowkiOneDriveResult');
        if(note)note.textContent='✅ Album przeniesiono do kosza OneDrive.'+(deleted.cover_retained?' Uwaga: niektóre pliki okładek pozostawiono w 03_OKLADKI.':'');}
      catch(e){toolFeedback.textContent='⚠️ '+errText(e)+' Album pozostaje ukryty do wyjaśnienia.';pending(false);}
    };
    const notice=elt('p','sowki-album-feedback');notice.setAttribute('role','status');card.append(notice);
    async function saveCard(makePublic){
      if(archived){notice.textContent='Najpierw przywróć album z archiwum.';return;}
      if(coverBusy){notice.textContent='Poczekaj na zakończenie przesyłania okładki.';return;}
      if(makePublic!==current){
        const text=makePublic?'Opublikować album? Upewnij się, że okładka nie ujawnia wizerunku osób bez odpowiednich zgód.':'Ukryć cały album przed rodzicami?';
        if(!confirm(text))return;
      }
      save.disabled=true;publish.disabled=true;notice.textContent='Zapisuję kartę albumu…';
      try{
        await invoke('moderation_album_save',{album_id:albumId,title:title.value,
          description:description.value,event_date:eventDate.value,cover_item_id:uploadedCoverId,
          published:makePublic});
        notice.textContent='✅ Zapisano kartę wydarzenia.';
        forgetLocal();await loadDetails();
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
    if(!editorDialog.open)editorDialog.showModal();
    editor.append(elt('h4','','🔍 Weryfikacja: '+file.name));
    const status=elt('p','sowki-mod-status','Pobieram oryginał z OneDrive…');editor.append(status);
    editorDialog.querySelector('.sowki-gallery-dialog-content').scrollTop=0;
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
        sending=true;editorBusy=true;let saved=false;updateSaveState();msg.textContent='Przygotowuję zdjęcie JPG…';
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
          saved=true;
        }catch(e){msg.textContent='❌ '+errText(e);}
        finally{
          sending=false;editorBusy=false;updateSaveState();
          if(saved){
            closeEditor();await loadStage(currentStep===4?4:3);
            if(currentStep===3){
              stage3.querySelectorAll('.sowki-gallery-next-step').forEach(x=>x.remove());
              const next=elt('button','sowki-gallery-next-step','✅ Gotowe — przejdź do etapu 4 i zatwierdź zdjęcie');
              next.type='button';next.onclick=()=>box.sowkiGalleryOpenStep?.(4);stage3.prepend(next);
            }
          }
        }
      };
      cancel.onclick=()=>{if(sending)return;editor.hidden=true;editor.replaceChildren();if(tempUrl)URL.revokeObjectURL(tempUrl);tempUrl='';if(editorDialog.open)editorDialog.close();};
      editorCancel=cancel;
      draw();msg.textContent='✏️ Przeciągnij palcem lub myszą po każdej twarzy, aby nałożyć mozaikę. Zaznaczanie już działa.';
    }catch(e){status.textContent='⚠️ '+errText(e);if(tempUrl)URL.revokeObjectURL(tempUrl);editorBusy=false;}
  }
};

function autoEventCover(album){
  const cover=elt('div','album-cover sowki-od-no-cover sowki-od-event-cover');
  cover.setAttribute('role','img');cover.setAttribute('aria-label','Grafika wydarzenia: '+String(album.title||'Wydarzenie'));
  cover.append(elt('span','sowki-od-event-icon','🦉'));
  cover.append(elt('span','sowki-od-event-caption','Nasze przedszkolne wydarzenie'));
  cover.append(elt('strong','sowki-od-event-title',album.title||'Wydarzenie Sówek'));
  return cover;
}

/* Rodzic widzi tylko przekazanie zdjęć. Wszystkie zdjęcia trafiają
   do kolejki weryfikacji 01_DO_WERYFIKACJI danego wydarzenia.
   Weryfikacja i publikacja są wyłącznie w panelu właściciela. */
function renderParentUploadCard(mount,albums,action){
  let card=mount.querySelector('.sowki-parent-upload-card');
  if(card)card.remove();
  card=elt('section','sowki-parent-upload-card');
  card.append(elt('h3','','📸 Przekaż zdjęcia do galerii Sówek'));
  card.append(elt('p','',
    'Masz zdjęcia z przedszkolnego wydarzenia? Możesz przekazać je do wspólnej galerii. ' +
    'Przesłane fotografie nie są publikowane automatycznie. Każde zdjęcie zostanie zweryfikowane, ' +
    'a w razie potrzeby odpowiednio zanonimizowane, z uwzględnieniem deklaracji rodziców dotyczących wizerunku dzieci. ' +
    'Do galerii trafią wyłącznie materiały dopuszczone po tej weryfikacji.'
  ));
  const button=elt('button','primary sowki-parent-upload-open','📤 Dodaj swoje zdjęcia');button.type='button';
  card.append(button);
  mount.append(card);
  button.onclick=()=>{
    const dialog=elt('dialog','sowki-parent-upload-dialog');
    const form=elt('div','sowki-parent-upload-inner');
    const header=elt('div','sowki-parent-upload-header');
    header.append(elt('h2','','📸 Przekaż zdjęcia'));
    const close=elt('button','sowki-parent-upload-close','✕');close.type='button';close.setAttribute('aria-label','Zamknij');
    header.append(close);form.append(header);
    const intro=elt('p','','Wybierz wydarzenie, a następnie zdjęcia. Materiały trafią do weryfikacji, nie od razu do galerii.');form.append(intro);
    const folderLabel=elt('label','sowki-parent-upload-label','Wydarzenie');
    const select=elt('select','sowki-parent-upload-select');
    for(const a of albums){const opt=elt('option','',String(a.title||'Wydarzenie'));opt.value=String(a.id);select.append(opt);}
    select.disabled=!albums.length;folderLabel.append(select);form.append(folderLabel);
    if(!albums.length)form.append(elt('p','sowki-parent-upload-note','Aktualnie brak wydarzeń, do których można przekazać zdjęcia.'));
    const filesLabel=elt('label','sowki-parent-upload-label','Wybierz zdjęcia (maks. 10 jednocześnie)');
    const files=elt('input','sowki-parent-upload-files');files.type='file';files.multiple=true;
    files.accept='image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';
    filesLabel.append(files);form.append(filesLabel);
    form.append(elt('p','sowki-parent-upload-note','Obsługiwane: JPG, PNG, WebP i HEIC. Maksymalnie 20 MB na zdjęcie. Filmy nie są przyjmowane przez ten formularz.'));
    const rights=elt('label','sowki-parent-upload-consent');
    const check=elt('input');check.type='checkbox';
    rights.append(check,elt('span','','Potwierdzam, że mam prawo przekazać wybrane zdjęcia do weryfikacji przez administratora galerii. Rozumiem, że samo wysłanie nie oznacza ich publikacji.'));
    form.append(rights);
    const submit=elt('button','primary sowki-parent-upload-submit','📤 Przekaż do weryfikacji');submit.type='button';submit.disabled=true;
    const progress=elt('progress','sowki-parent-upload-progress');progress.max=100;progress.value=0;progress.hidden=true;
    const status=elt('p','sowki-parent-upload-status','');status.setAttribute('role','status');
    form.append(submit,progress,status);dialog.append(form);document.body.append(dialog);
    let busy=false;
    const update=()=>{submit.disabled=busy||!select.value||!check.checked||!files.files?.length;};
    select.onchange=check.onchange=files.onchange=update;
    const dismiss=()=>{if(busy)return;dialog.close();dialog.remove();};
    close.onclick=dismiss;
    dialog.addEventListener('cancel',ev=>{ev.preventDefault();dismiss();});
    dialog.showModal();
    submit.onclick=async()=>{
      const selected=[...(files.files||[])];
      if(!selected.length||selected.length>10){status.textContent='⚠️ Wybierz od 1 do 10 zdjęć.';return;}
      if(selected.some(f=>!(/\.(?:jpe?g|png|webp|heic|heif)$/i.test(f.name))||f.size<1||f.size>20*1024*1024)){
        status.textContent='⚠️ Każde zdjęcie musi być JPG, PNG, WebP lub HEIC i mieć maksymalnie 20 MB.';return;
      }
      if(!check.checked)return;
      busy=true;update();close.disabled=true;select.disabled=true;files.disabled=true;check.disabled=true;
      progress.hidden=false;progress.value=0;
      let success=0;let fail=0;
      try{
        for(let i=0;i<selected.length;i++){
          const file=selected[i];
          status.textContent=`Przesyłanie ${i+1}/${selected.length}: ${file.name}`;
          try{
            const session=await action('parent_upload_begin',{album_id:select.value,name:file.name,size:file.size});
            const url=goodUrl(session.upload_url);
            if(!url)throw Error('Nie udało się rozpocząć przesyłania.');
            let last=null;const step=5*1024*1024;
            for(let from=0;from<file.size;from+=step){
              const end=Math.min(file.size,from+step);
              last=await sowkiOneDriveUploadChunk(url,file.slice(from,end),from,file.size,
                sent=>{progress.value=Math.min(99,Math.round((i+sent/file.size)/selected.length*100));});
              if(end<file.size&&last.status!==202)throw Error('Niepełny transfer.');
            }
            if(!last||![200,201].includes(last.status)||!last.data?.id)throw Error('Brak potwierdzenia zapisu.');
            const confirmation=await action('parent_upload_confirm',{upload_id:session.upload_id,item_id:String(last.data.id)});
            if(!confirmation?.ok)throw Error('Nie udało się potwierdzić zdjęcia.');
            success++;
          }catch(e){fail++;console.warn('Sówki: przekazywanie zdjęcia',errText(e));
            status.textContent=`⚠️ Problem ze zdjęciem ${i+1}: ${errText(e)}`;
            // Nie rozpoczynamy kolejnych przy błędzie uprawnienia/limitu.
            break;
          }
          progress.value=Math.round((i+1)/selected.length*100);
        }
        if(fail)status.textContent=`Przekazano ${success} zdjęć. Jedno przesłanie wymaga uwagi. Spróbuj ponownie z pozostałymi plikami.`;
        else{status.textContent=`✅ Przekazano ${success} zdjęć do sprawdzenia. Dziękujemy!`;progress.value=100;files.value='';}
      }finally{busy=false;close.disabled=false;select.disabled=false;files.disabled=false;check.disabled=false;update();}
    };
  };
}

window.sowkiOneDrivePublicMount=async function(){
  const mount=document.querySelector('#galleryAlbums');
  if(!mount||mount.hidden)return;
  const session=readPrivateAccessSession('gallery');
  if(!session?.token)return;
  // Wszystkie albumy (również zatwierdzone kopie OneDrive) tworzą JEDNĄ galerię.
  // Nie dodajemy rodzicom etykiet ani technicznych nagłówków OneDrive.
  const generation=String(1+Number(mount.dataset.sowkiGalleryGeneration||0));
  mount.dataset.sowkiGalleryGeneration=generation;
  mount.querySelectorAll('.sowki-od-album,.sowki-od-error,.sowki-od-loading').forEach(x=>x.remove());
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
    if(!result.albums?.length)mount.append(elt('p','sowki-od-empty-event','📸 Nie ma jeszcze opublikowanych wydarzeń.'));
    for(const album of result.albums||[]){
      const article=elt('article','item sowki-od-album');
      const url=goodUrl(album.cover_url);
      if(url){
        const cover=elt('img','album-cover');cover.alt='Okładka albumu '+album.title;
        cover.loading='lazy';cover.decoding='async';cover.referrerPolicy='no-referrer';cover.src=url;
        cover.onerror=()=>cover.replaceWith(autoEventCover(album));
        article.append(cover);
      }else{
        article.append(autoEventCover(album));
      }
      if(album.event_date)article.append(elt('div','date',formatDate(album.event_date)));
      article.append(elt('h3','',album.title||'Album zdjęć'));
      if(album.description)article.append(elt('p','sowki-od-description',album.description));
      if(Number(album.count)>0){
        const button=elt('button','primary sowki-od-show-all','📸 Zobacz zdjęcia i filmy tego albumu');
        button.type='button';article.append(button);button.onclick=()=>openAlbum(album,action);
      }else{article.append(elt('p','sowki-od-empty-event','📸 Zdjęcia i filmy z wydarzenia pojawią się po zatwierdzeniu.'));}
      mount.append(article);
    }
    renderParentUploadCard(mount,result.albums||[],action);
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
  const note=elt('p','sowki-od-help','Dotknij miniatury, aby otworzyć zdjęcie lub film. Przesuwaj palcem w lewo lub w prawo.');
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
    loading=true;more.disabled=true;more.hidden=true;help.textContent='Wczytuję galerię…';
    try{
      const page=await action('public_media',{album_id:album.id,offset});
      if(closed)return;
      total=Number(page.count||0);
      for(const item of page.photos||[]){
        const i=photos.push(item)-1;
        const tile=elt('button','sowki-od-tile');tile.type='button';
        tile.setAttribute('aria-label',(item.type==='video'?'Otwórz film ':'Powiększ zdjęcie ')+(i+1));
        const img=elt('img');img.loading='lazy';img.decoding='async';
        img.referrerPolicy='no-referrer';img.alt=item.name||'Zdjęcie z albumu';
        if(item.type!=='video'||goodUrl(item.thumbnail_url))img.src=goodUrl(item.thumbnail_url||item.url);
        img.onerror=()=>{if(item.type==='video'){img.replaceWith(elt('span','sowki-od-video-placeholder','🎬'));}
          else if(img.src!==goodUrl(item.url))img.src=goodUrl(item.url);};
        if(item.type==='video'){
          tile.classList.add('sowki-od-video-tile');
          if(goodUrl(item.thumbnail_url)){
            img.src=goodUrl(item.thumbnail_url);img.alt='Miniatura filmu';tile.append(img);
          }else{tile.append(elt('span','sowki-od-video-placeholder','🎬'));}
          tile.append(elt('span','sowki-od-video-badge','▶ FILM'));
        }else tile.append(img);
        tile.onclick=()=>openViewer(i);
        grid.append(tile);
      }
      offset+=24;hasMore=!!page.has_more;
      help.textContent=total?`${photos.length} z ${total} materiałów`:'Brak zdjęć i filmów w albumie.';
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
    const video=elt('video','sowki-od-full-video');video.controls=true;video.playsInline=true;video.preload='metadata';video.hidden=true;
    const videoInfo=elt('p','sowki-od-video-info','');videoInfo.hidden=true;
    const prev=elt('button','sowki-od-prev','‹');prev.type='button';prev.setAttribute('aria-label','Poprzednie zdjęcie');
    const next=elt('button','sowki-od-next','›');next.type='button';next.setAttribute('aria-label','Następne zdjęcie');
    top.append(counter,download,end);box.append(top,prev,image,video,videoInfo,next);modal.append(box);
    const closeViewer=()=>{video.pause();video.removeAttribute('src');video.load();box.remove();viewer=null;closeViewerFn=null;document.removeEventListener('keydown',onViewerKey);};
    closeViewerFn=closeViewer;
    end.onclick=closeViewer;
    box.onclick=e=>{if(e.target===box)closeViewer();};
    async function show(delta){
      const i=current+delta;
      if(i<0||i>=photos.length)return;
      current=i;
      const data=photos[i];const isVideo=data.type==='video';
      video.pause();video.removeAttribute('src');video.load();
      video.hidden=!isVideo;videoInfo.hidden=!isVideo;image.hidden=isVideo;
      image.alt=data.name||'Zdjęcie z albumu';
      if(isVideo){
        image.removeAttribute('src');videoInfo.textContent='⏳ Przygotowuję odtwarzanie…';
        try{
          // Odświeżamy wygasające adresy dopiero przed odtwarzaniem filmu.
          const fresh=await action('public_video_url',{album_id:album.id,item_id:data.id});
          if(!box.isConnected||photos[current]!==data)return;
          video.src=goodUrl(fresh.url);videoInfo.textContent='▶ Dotknij odtwarzacza, aby rozpocząć.';
        }catch(e){videoInfo.textContent='⚠️ Film chwilowo niedostępny. Zamknij podgląd i spróbuj ponownie.';}
      }else image.src=goodUrl(data.url);
      counter.textContent=`${i+1} / ${total||photos.length}`;
      download.textContent=isVideo?'⬇ Otwórz / pobierz film':'⬇ Pobierz';
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
      if(photos[current]?.type!=='video'&&Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4){if(dx<0)next.click();else prev.click();}
    },{passive:true});
    download.onclick=async()=>{
      download.disabled=true;download.textContent='Pobieram…';
      try{
        const item=photos[current];
        if(item.type==='video'){
          // Bez ponownego await: otwarcie pozostaje bezpośrednią reakcją na kliknięcie,
          // co zmniejsza ryzyko zablokowania okna na iPhone. Nie ładujemy filmu do RAM.
          const href=goodUrl(video.currentSrc||video.src||item.url);
          if(!href)throw Error('Brak adresu filmu. Zamknij podgląd i otwórz ponownie.');
          window.open(href,'_blank','noopener,noreferrer');return;
        }
        const blob=await imgBlob(item.url);
        const local=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=local;a.download=item.name||'zdjecie.jpg';
        document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(local),60000);
      }catch(e){
        // Nie każdy wariant OneDrive dopuszcza fetch CORS w Safari.
        // Otwórz tymczasowy odnośnik, by użytkownik mógł zapisać zdjęcie ręcznie.
        const u=goodUrl(photos[current]?.url);
        if(u&&confirm('Nie udało się automatycznie pobrać pliku. Otworzyć zdjęcie w nowej karcie, aby je zapisać?'))
          window.open(u,'_blank','noopener,noreferrer');
      }finally{download.disabled=false;download.textContent=photos[current]?.type==='video'?'⬇ Otwórz / pobierz film':'⬇ Pobierz';}
    };
    void show(0);
    end.focus();
  }
}

})();
