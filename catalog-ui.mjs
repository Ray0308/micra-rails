import {CATEGORIES,CHARACTERS,BY_ID,BREAK_HITS} from './catalog-data.mjs?v=0.1.7';
import {createCollectionStore} from './catalog-model.mjs?v=0.1.7';
const $=id=>document.getElementById(id);

export function createCatalogUI({showScreen,playTone,onContinue,storage}){
 const store=createCollectionStore(storage);
 let category='friends',page=0,returnTo='title',detail=null,detailShiny=false,openingTimer;
 const dialog=$('card-dialog');
 const pageSize=()=>window.innerWidth>=760?6:4;
 const discovered=()=>CHARACTERS.filter(c=>store.state.counts[c.id]).length;
 function saveWarning(){
  $('collection-save-warning').hidden=!store.saveError;
  $('collection-save-warning').textContent=store.saveError?'この端末に保存できません。タブを閉じると記録が消えることがあります。':'';
 }
 function art(c){
  return `<div class="card-portrait ${c.image?'has-image':''}" style="--mob-color:${c.color};--mob-skin:${c.skin}"><div class="pixel-character" aria-hidden="true"><i class="pixel-head"></i><i class="pixel-body"></i><i class="pixel-feet"></i></div>${c.image?`<img data-card-art loading="lazy" decoding="async" src="${c.image}?v=0.1.7" alt="${c.name}" draggable="false">`:''}</div>`;
 }
 function bindArt(root){
  root.querySelectorAll('img[data-card-art]').forEach(image=>{
   image.onerror=()=>{image.hidden=true;image.parentElement.classList.remove('has-image')};
  });
 }
 function cardMarkup(c,shiny=false){
  return `<div class="card-rarity">${shiny?'✦ キラカード':CATEGORIES.find(g=>g.id===c.category).name}</div>${art(c)}<strong class="card-name">${c.name}</strong><span class="card-number">No. ${String(CHARACTERS.indexOf(c)+1).padStart(2,'0')}</span>`;
 }
 function renderCollection(){
  const state=store.state;
  $('catalog-summary').textContent=`${discovered()} / ${CHARACTERS.length}　✦ ${CHARACTERS.filter(c=>state.shiny[c.id]).length}`;
  $('catalog-tabs').innerHTML=CATEGORIES.map(g=>{
   const group=CHARACTERS.filter(c=>c.category===g.id),found=group.filter(c=>state.counts[c.id]).length;
   return `<button role="tab" id="tab-${g.id}" data-category="${g.id}" aria-selected="${category===g.id}" tabindex="${category===g.id?0:-1}" aria-controls="catalog-grid"><span>${g.name}</span><small>${found}/${group.length}</small></button>`;
  }).join('');
  const group=CHARACTERS.filter(c=>c.category===category),size=pageSize(),total=Math.max(1,Math.ceil(group.length/size));
  page=Math.min(page,total-1);
  $('catalog-grid').setAttribute('aria-labelledby',`tab-${category}`);
  $('catalog-grid').innerHTML=group.slice(page*size,(page+1)*size).map(c=>{
   const count=state.counts[c.id]||0,shiny=Boolean(state.shiny[c.id]);
   return `<button class="collection-card ${count?'owned':'undiscovered'} ${shiny?'is-shiny':''}" data-character="${c.id}" aria-label="${count?c.name+'、'+count+'枚'+(shiny?'、キラあり':''):'まだ見つけていないキャラクター'}" ${count?'':'aria-disabled="true"'}>${count?cardMarkup(c,shiny):'<div class="mystery-card" aria-hidden="true">？</div><strong class="card-name">？？？</strong>'}<span class="card-copies">${count?'× '+count:'未発見'}</span></button>`;
  }).join('');
  $('catalog-prev').disabled=page===0;$('catalog-next').disabled=page>=total-1;
  $('catalog-page').textContent=`${page+1} / ${total}`;
  $('catalog-pages').hidden=total===1;
  bindArt($('catalog-grid'));saveWarning();
 }
 function openCollection(from='title'){
  returnTo=from;renderCollection();showScreen('guide');
 }
 function closeDetails(){
  if(dialog.open)dialog.close();
  window.speechSynthesis?.cancel();
 }
 function renderDetails(){
  const c=BY_ID[detail],state=store.state;
  $('detail-card').classList.toggle('is-shiny',detailShiny);
  $('detail-card').innerHTML=cardMarkup(c,detailShiny);
  $('detail-name').textContent=c.name;$('detail-fact').textContent=c.fact;
  $('detail-count').textContent=`あつめた数 ${state.counts[c.id]} 枚${state.shiny[c.id]?'　✦ '+state.shiny[c.id]+' 枚':''}`;
  $('normal-card').disabled=state.counts[c.id]===(state.shiny[c.id]||0);
  $('shiny-card').disabled=!state.shiny[c.id];
  $('normal-card').setAttribute('aria-pressed',String(!detailShiny));$('shiny-card').setAttribute('aria-pressed',String(detailShiny));
  $('read-card').hidden=!window.speechSynthesis;
  bindArt($('detail-card'));
 }
 function showDetails(id){
  if(!store.state.counts[id])return;
  detail=id;detailShiny=Boolean(store.state.shiny[id]);renderDetails();dialog.showModal();playTone(650);
 }
 $('catalog-grid').addEventListener('click',event=>{
  const card=event.target.closest('[data-character]');if(card)showDetails(card.dataset.character);
 });
 $('catalog-tabs').addEventListener('click',event=>{
  const tab=event.target.closest('[data-category]');if(!tab)return;
  category=tab.dataset.category;page=0;renderCollection();$(`tab-${category}`)?.focus({preventScroll:true});
 });
 $('catalog-tabs').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const i=CATEGORIES.findIndex(g=>g.id===category);
  category=CATEGORIES[event.key==='Home'?0:event.key==='End'?CATEGORIES.length-1:(i+(event.key==='ArrowRight'?1:CATEGORIES.length-1))%CATEGORIES.length].id;
  page=0;renderCollection();$(`tab-${category}`)?.focus({preventScroll:true});
 });
 $('catalog-prev').onclick=()=>{page=Math.max(0,page-1);renderCollection()};
 $('catalog-next').onclick=()=>{page++;renderCollection()};
 $('catalog-back').onclick=()=>{closeDetails();showScreen(returnTo)};
 $('close-card').onclick=closeDetails;
 dialog.addEventListener('click',event=>{if(event.target===dialog)closeDetails()});
 dialog.addEventListener('close',()=>window.speechSynthesis?.cancel());
 $('normal-card').onclick=()=>{detailShiny=false;renderDetails()};
 $('shiny-card').onclick=()=>{detailShiny=true;renderDetails()};
 $('read-card').onclick=()=>{
  if(!detail||!window.speechSynthesis)return;
  window.speechSynthesis.cancel();const c=BY_ID[detail],utterance=new SpeechSynthesisUtterance(c.name+'。'+c.fact);utterance.lang='ja-JP';utterance.rate=.85;window.speechSynthesis.speak(utterance);
 };
 window.addEventListener('resize',()=>{if(document.body.dataset.screen==='guide')renderCollection()});

 const cracks=[
  'M52 0L49 24L62 36L55 52',
  'M55 52L35 65L39 83L25 100 M49 24L27 29L11 15',
  'M62 36L78 29L100 36 M55 52L73 66L71 87L84 100',
  'M35 65L15 58L0 67 M39 83L19 83L9 100 M27 29L24 46L6 43',
  'M73 66L94 60L100 72 M71 87L91 85 M49 24L67 11L68 0 M55 52L52 80L60 100',
 ];
 function crackArt(hits){return `<g fill="none" stroke="#151717" stroke-width="3" stroke-linejoin="miter">${cracks.slice(0,hits).map(d=>`<path d="${d}"/>`).join('')}</g>`}
 function renderCracks(hits){
  $('mine-block').setAttribute('aria-label',hits<BREAK_HITS?`ブロックを掘る。あと${BREAK_HITS-hits}回`:'ブロックが壊れました');
  $('mine-block').querySelectorAll('.block-cracks').forEach(svg=>svg.innerHTML=crackArt(hits));
  $('mining-progress').innerHTML=Array.from({length:BREAK_HITS},(_,i)=>`<i class="${i<hits?'filled':''}"></i>`).join('');
  $('mining-progress').setAttribute('aria-label',`${BREAK_HITS}回のうち${hits}回掘りました`);
 }
 function fragments(){
  $('block-fragments').innerHTML=Array.from({length:16},(_,i)=>{
   const angle=i/16*Math.PI*2,x=Math.cos(angle)*(90+(i%3)*25),y=Math.sin(angle)*(90+(i%4)*20);
   return `<i style="--dx:${x}px;--dy:${y}px;--spin:${i*53}deg;--delay:${i%3*.025}s"></i>`;
  }).join('');
 }
 function renderReward(){
  const r=store.state.reward;if(!r)return;
  clearTimeout(openingTimer);
  const revealed=r.phase==='revealed',c=BY_ID[r.id];
  $('reward-screen').dataset.phase=r.phase;
  $('reward-screen').classList.toggle('shiny-reward',revealed&&r.shiny);
  $('reward-headline').textContent=revealed?(r.firstShiny?'キラカード！':r.fresh?'新しいなかま！':'また会えた！'):'お宝を見つけた！';
  $('mining-hint').hidden=revealed;$('mining-progress').hidden=revealed;
  $('mine-block').disabled=revealed;
  $('reward-card').hidden=!revealed;$('reward-actions').hidden=!revealed;
  $('reward-status').textContent=revealed?`${c.name}　× ${r.count}`:'';
  renderCracks(r.hits);saveWarning();
  if(revealed){
   $('reward-card').classList.toggle('is-shiny',r.shiny);$('reward-card').innerHTML=cardMarkup(c,r.shiny);bindArt($('reward-card'));fragments();
   $('reward-next').textContent=r.level===2?'もう一度あそぶ':'次の坑道へ';
   $('reward-next').disabled=true;$('reward-book').disabled=true;
   openingTimer=setTimeout(()=>{
    $('reward-next').disabled=false;$('reward-book').disabled=false;
    if(document.body.dataset.screen==='reward')$('reward-next').focus({preventScroll:true});
   },900);
  }else $('block-fragments').replaceChildren();
 }
 function resumeReward(){if(!store.state.reward)return false;renderReward();showScreen('reward');return true}
 function beginReward(runId,level){store.beginReward(runId,level);return resumeReward()}
 $('mine-block').onclick=()=>{
  const before=store.state.reward;if(!before||before.phase!=='mining')return;
  const r=store.tapBlock();renderCracks(r.hits);saveWarning();
  playTone(180+r.hits*35,.045);
  $('block-cube').animate?.([{transform:'rotateX(-18deg) rotateY(-28deg) translateY(0)'},{transform:'rotateX(-15deg) rotateY(-24deg) translateY(5px)'},{transform:'rotateX(-18deg) rotateY(-28deg) translateY(0)'}],{duration:140});
  if(r.phase==='revealed'){renderReward();playTone(r.shiny?1000:750,.25)}
 };
 $('reward-next').onclick=()=>{
  const r=store.state.reward;if(!r||r.phase!=='revealed')return;
  const level=r.level;store.acknowledge();onContinue(level);
 };
 $('reward-book').onclick=()=>openCollection('reward');
 $('reward-title-back').onclick=()=>{
  // Mining rewards stay pending; revealed cards are already saved exactly once.
  if(store.state.reward?.phase==='revealed')store.acknowledge();
  showScreen('title');
 };
 return {beginReward,resumeReward,openCollection,hasReward:()=>Boolean(store.state.reward)};
}
