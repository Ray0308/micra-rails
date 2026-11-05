export const STUDIO_LOGO='assets/ray-edu-labo.png?v=0.5.2';
export const STARTUP_ASSETS=[
 STUDIO_LOGO,
 'assets/rail-straight-v044.png','assets/rail-curve-v044.png','assets/rail-cross-v044.png',
 'assets/steve.png?v=0.1.4','assets/creeper.png?v=0.1.4','assets/station.svg?v=0.1.4',
 'assets/title-logo-transparent.png','assets/background.jpg',
 'assets/floor-grass.png?v=0.3.9','assets/floor-mine.png?v=0.4.0','assets/floor-nether.png?v=0.4.0','assets/floor-end.png?v=0.4.0',
 'assets/world-grassland.png','assets/mine-backdrop.png','assets/world-nether.png','assets/world-end.png',
 'assets/block-grass.jpg','assets/block-mine.jpg','assets/block-nether.jpg','assets/block-end.jpg',
];
export function loadImage(src,{ImageClass=globalThis.Image,timeoutMs=10000}={}){
 return new Promise(resolve=>{
  const image=new ImageClass();let done=false;
  const finish=ok=>{if(done)return;done=true;clearTimeout(timer);image.onload=image.onerror=null;resolve({src,ok});};
  const timer=setTimeout(()=>finish(false),timeoutMs);
  image.onload=()=>{if(image.decode)image.decode().then(()=>finish(true),()=>finish(false));else finish(true)};
  image.onerror=()=>finish(false);image.src=src;
 });
}
export async function preloadImages(urls,{onProgress=()=>{},onAsset=()=>{},concurrency=4,...options}={}){
 const assets=[...new Set(urls)],results=[];let cursor=0,completed=0;
 onProgress(0,assets.length);
 await Promise.all(Array.from({length:Math.min(concurrency,assets.length)},async()=>{
  while(cursor<assets.length){const src=assets[cursor++];const result=await loadImage(src,options);results.push(result);onAsset(result);onProgress(++completed,assets.length);}
 }));
 return results;
}
export async function runStartup({document=globalThis.document,minDuration=3300,maxDuration=15000,fadeDuration=2100,...imageOptions}={}){
 const splash=document.getElementById('boot-screen'),label=document.getElementById('boot-status');
 let logoHold=Promise.resolve(),deadline;
 const loading=preloadImages(STARTUP_ASSETS,{...imageOptions,onAsset:result=>{
  if(result.src===STUDIO_LOGO){splash.classList.add('logo-ready');logoHold=new Promise(resolve=>setTimeout(resolve,minDuration));}
 },onProgress:(done,total)=>{label.textContent=`読み込み中 ${done} / ${total}`;}});
 await Promise.race([new Promise(resolve=>{deadline=setTimeout(resolve,maxDuration)}),(async()=>{await loading;await logoHold;})()]);
 clearTimeout(deadline);
 splash.classList.add('is-leaving');
 await new Promise(resolve=>setTimeout(resolve,fadeDuration));
 splash.hidden=true;document.body.classList.remove('booting');
}
