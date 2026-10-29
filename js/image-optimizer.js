/* Sówki v0.8.36.2 — lokalna optymalizacja zdjęć do OneDrive.
 * Żadne bajty obrazu nie są wysyłane do serwisów konwersji; HEIC-to uruchamia się
 * w przeglądarce. Jedyny magazyn zdjęć: OneDrive. Bez skalowania rozdzielczości.
 */
(()=>{
'use strict';
const HEIC_PATTERN=/\.(heic|heif)$/i;
const PHOTO_PATTERN=/\.(jpe?g|png|webp|heic|heif)$/i;
const MiB=1024*1024;
let loaderPromise=null;
const isHeic=(file,name='')=>HEIC_PATTERN.test(name||file?.name||'')||/^image\/hei[cf]$/i.test(String(file?.type||''));
const jpegName=(name)=>String(name||'zdjecie').replace(/\.[^.]+$/,'').replace(/[\\/\x00-\x1f]/g,'_')+'.jpg';
function loadScript(src){return new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=src;script.async=true;script.crossOrigin='anonymous';
  script.onload=()=>resolve();script.onerror=()=>{script.remove();reject(Error('Nie udało się pobrać modułu HEIC. Sprawdź połączenie internetowe.'));};
  document.head.append(script);
});}
async function loadHeicDecoder(){
  if(typeof window.HeicTo==='function')return window.HeicTo;
  if(!loaderPromise){
    loaderPromise=(async()=>{
      for(const src of [
        'https://cdn.jsdelivr.net/npm/heic-to@1.6.6/dist/iife/heic-to.js',
        'https://unpkg.com/heic-to@1.6.6/dist/iife/heic-to.js'
      ]){
        try{await loadScript(src);if(typeof window.HeicTo==='function')return window.HeicTo;}catch{}
      }
      throw Error('Nie udało się załadować dekodera HEIC. Sprawdź internet i ponów próbę.');
    })().catch(e=>{loaderPromise=null;throw e;});
  }
  return loaderPromise;
}
async function openImage(blob){
  const url=URL.createObjectURL(blob),image=new Image();
  try{image.src=url;await image.decode();return {image,url};}
  catch(e){URL.revokeObjectURL(url);throw e;}
}
async function decodePhoto(blob,name){
  try{return await openImage(blob);}
  catch(nativeError){
    if(!isHeic(blob,name))throw Error('Nie udało się odczytać zdjęcia JPG/PNG/WebP. Plik może być uszkodzony.');
    const heicTo=await loadHeicDecoder();let jpeg;
    try{jpeg=await heicTo({blob,type:'image/jpeg',quality:0.93});}
    catch{throw Error('Nie udało się odczytać zdjęcia HEIC. Plik może być nieprawidłowy.');}
    if(!(jpeg instanceof Blob)||!jpeg.size)throw Error('Konwersja HEIC nie zwróciła zdjęcia.');
    return await openImage(jpeg);
  }
}
function checkDimensions(image){
  const w=image.naturalWidth,h=image.naturalHeight;
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w>16384||h>16384||w*h>55_000_000)
    throw Error('Zdjęcie przekracza możliwości bezpiecznej konwersji w tej przeglądarce. Nie zmniejszamy rozdzielczości automatycznie.');
  return {w,h};
}
async function toJpeg(canvas,quality){
  const blob=await new Promise((resolve,reject)=>{
    try{canvas.toBlob(resolve,'image/jpeg',quality);}catch(e){reject(e);}
  });
  if(!blob||blob.type!=='image/jpeg'||!blob.size)throw Error('Przeglądarka nie może zapisać tego zdjęcia jako JPG.');
  return blob;
}
function canvasFromImage(image){
  const {w,h}=checkDimensions(image);
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Brak pamięci na przetwarzanie zdjęcia.');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
  ctx.drawImage(image,0,0,w,h);
  return canvas;
}
/* Zwraca plik do uploadu z tymi samymi wymiarami pikselowymi. Nie obiecuje
 * zmniejszenia wszystkich formatów: szczególnie HEIC bywa mniejszy od JPG. */
window.sowkiPreparePhotoForUpload=async(file,{maxBytes=45*MiB}={})=>{
  if(!PHOTO_PATTERN.test(file?.name||''))throw Error('Dozwolone zdjęcia: JPG, PNG, WebP, HEIC/HEIF.');
  if(!file.size)throw Error('Pusty plik zdjęcia.');
  let decoded,canvas;
  try{
    decoded=await decodePhoto(file,file.name);
    canvas=canvasFromImage(decoded.image);
    // Dobór jakości: wysoka jakość, następnie mniej agresywne próby redukcji,
    // gdy potrzebne. Nigdy nie zmieniamy liczby pikseli.
    const high=await toJpeg(canvas,0.92);
    let best=high;
    if(high.size>maxBytes || high.size>file.size*0.95){
      for(const q of [0.89,0.86]){
        const candidate=await toJpeg(canvas,q);
        if(candidate.size<best.size)best=candidate;
        if(candidate.size<=maxBytes&&candidate.size<=file.size*0.95){
          best=candidate;break;
        }
      }
    }
    // HEIC zwykle ma lepszą kompresję od JPG: jeśli brak zysku rozmiaru,
    // zachowujemy możliwie wyższą jakość, nawet gdy JPG będzie większy.
    if(best.size>file.size*0.95 && high.size<=maxBytes)best=high;
    // Dla istniejących JPG bez sensownej oszczędności nie generujemy kolejnego
    // stratnego pokolenia obrazu.
    if(/\.(jpe?g)$/i.test(file.name)&&file.size<=maxBytes&&best.size>=file.size*0.98){
      return {file,originalSize:file.size,optimizedSize:file.size,changed:false};
    }
    if(best.size>maxBytes)throw Error('JPG w pełnej rozdzielczości przekracza limit przesyłania. Wybierz mniejszy plik lub prześlij go jako JPG o niższej jakości.');
    const result=new File([best],jpegName(file.name),{type:'image/jpeg',lastModified:file.lastModified||Date.now()});
    return {file:result,originalSize:file.size,optimizedSize:result.size,changed:true};
  }catch(e){
    if(e?.name==='SecurityError')throw Error('Przeglądarka zablokowała odczyt obrazu.');
    throw e;
  }finally{
    if(decoded?.url)URL.revokeObjectURL(decoded.url);
    if(canvas){canvas.width=0;canvas.height=0;}
  }
};
/* Obsługa wcześniej wysłanych HEIC w edytorze mozaiki. Plik na OneDrive zostaje bez zmian. */
window.sowkiDecodePhotoForEditor=async(blob,name)=>{
  if(!isHeic(blob,name))return blob;
  let decoded,canvas;
  try{
    decoded=await decodePhoto(blob,name);
    canvas=canvasFromImage(decoded.image);
    return await toJpeg(canvas,0.93);
  }finally{
    if(decoded?.url)URL.revokeObjectURL(decoded.url);
    if(canvas){canvas.width=0;canvas.height=0;}
  }
};
})();
