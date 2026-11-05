import {runStartup} from './startup.mjs?v=0.4.5';
import {railArtwork} from './rail-art.mjs?v=0.4.4';
import {renderTiles} from './tile-view.mjs?v=0.4.3';
import {WORLDS,isWorld,loadWorld,saveWorld} from './worlds.mjs?v=0.3.1';
import {createJourneyStore} from './journey.mjs?v=0.2.5';
import {createAudioController} from './audio.mjs?v=0.4.8';
import {createCatalogUI} from './catalog-ui.mjs?v=0.4.7';
import {create,slide,start,ports,neighbor,canEdit,swap,rotate,build,removePlaced} from './engine.mjs?v=0.3.1';
import {createMotion,updateMotion,sampleRoute,CREEPER_FUSE_MS} from './motion.mjs?v=0.3.1';

const $=id=>document.getElementById(id);
const STOP_ICON='<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6H18V18H6Z" fill="currentColor"/></svg>';
const UI_ICONS={"back":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M14 5L7 12L14 19M8 12H20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"square\" stroke-linejoin=\"miter\"/></svg>","play":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M8 5L19 12L8 19Z\" fill=\"currentColor\"/></svg>","pause":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 5H10V19H6ZM14 5H18V19H14Z\" fill=\"currentColor\"/></svg>","reset":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M19 10A7 7 0 1 0 19 15M19 4V10H13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linejoin=\"miter\"/></svg>","soundOn":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 9H7L12 5V19L7 15H3Z\" fill=\"currentColor\"/><path d=\"M16 8C19 10 19 14 16 16M19 5C24 9 24 15 19 19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>","soundOff":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 9H7L12 5V19L7 15H3Z\" fill=\"currentColor\"/><path d=\"M16 9L22 15M22 9L16 15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>"};
let state,motion,paused=false,last=null,pointer,runId,collectionUI,stopHiss;
let audioStorage;
try{audioStorage=window.localStorage}catch{}
const audio=createAudioController({storage:audioStorage});
const journey=createJourneyStore(audioStorage);
let selectedWorld=loadWorld(audioStorage),selectedTile=null;
const brakeFreezesWorld=()=>Boolean(motion?.cartStopped&&WORLDS[selectedWorld].pausePursuitOnBrake);
let metrics={width:0,height:0,gap:5};
const assets={};
const actors={steve:$('actor-steve'),creeper:$('actor-creeper')};

for(const key of ['steve','creeper','house']){
  const image=new Image();
  image.onload=()=>{assets[key]=image.src;renderActorImage(key);render()};
  image.src=key==='house'?'assets/station.svg?v=0.1.4':`assets/${key}.png?v=0.1.4`;
}

function tone(hz=300,duration=.08){if(duration>=.2)audio.tone(hz,duration);else audio.effect('click')}
function stopFuseSound(){stopHiss?.();stopHiss=null}
function beginFuseSound(){stopFuseSound();stopHiss=audio.hiss(Math.max(.1,(CREEPER_FUSE_MS-motion.fuse)/1000))}
function renderAudioOptions(){
  const settings=audio.settings;
  $('sound-on').setAttribute('aria-pressed',String(settings.enabled));
  $('sound-off').setAttribute('aria-pressed',String(!settings.enabled));
  for(const [channel,id] of [['bgm','bgm'],['sfx','sfx']]){
    $(id+'-volume').value=String(settings[channel]);
    $(id+'-value').textContent=String(settings[channel]);
    $(id+'-volume').setAttribute('aria-valuetext',settings[channel]+' / 100');
    $(id+'-volume').style.setProperty('--volume',settings[channel]+'%');
  }
  $('sound').innerHTML=settings.enabled?UI_ICONS.soundOn:UI_ICONS.soundOff;
  $('sound').setAttribute('aria-label',settings.enabled?'サウンドをオフにする':'サウンドをオンにする');
  $('sound').setAttribute('aria-pressed',String(settings.enabled));
}
function setSound(enabled){if(!enabled){window.speechSynthesis?.cancel();stopFuseSound()}audio.setEnabled(enabled);audio.unlock();renderAudioOptions();if(enabled){tone(440,.08);if(state?.status==='running'&&!paused&&!brakeFreezesWorld()&&motion.fuse>0)beginFuseSound()}}
$('sound-on').onclick=()=>setSound(true);
$('sound-off').onclick=()=>setSound(false);
for(const channel of ['bgm','sfx']){
  $(channel+'-volume').addEventListener('input',()=>{
    audio.setVolume(channel,$(channel+'-volume').value);if(channel==='sfx'&&audio.settings.sfx===0)window.speechSynthesis?.cancel();audio.unlock();renderAudioOptions();
  });
}
$('sfx-volume').addEventListener('change',()=>tone(440,.12));
document.addEventListener('pointerdown',()=>audio.unlock(),{capture:true,passive:true});
document.addEventListener('keydown',()=>audio.unlock(),{capture:true});
document.addEventListener('touchend',()=>audio.unlock(),{capture:true,passive:true});
document.addEventListener('click',e=>{
 audio.unlock();
 const id=e.target?.closest?.('button')?.id;
 if(['play-game','open-guide','open-options','world-back','options-done','back-title','catalog-back','detail-close','reward-next','reward-title'].includes(id))audio.effect('click');
},{capture:true});
window.addEventListener('pageshow',()=>{if(!document.hidden)void audio.setVisible(true)});
window.addEventListener('focus',()=>{if(!document.hidden)void audio.setVisible(true)});

function renderActorImage(key){
  if(!actors[key])return;
  const label=key==='steve'?'トロッコに乗ったスティーブ':'歩いて追いかけるクリーパー';
  const content=assets[key]
    ?`<img class="actor-image" src="${assets[key]}" alt="${label}" draggable="false">`
    :`${key==='steve'?'<span class="cart"></span>':''}<span class="character ${key}"></span>`;
  actors[key].innerHTML=`<div class="actor-visual">${content}</div>`;
}

function reset(){
  stopFuseSound();
  runId=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const current=journey.state;
  state=create(current.level,{seed:current.seed,world:selectedWorld});motion=createMotion(state);selectedTile=null;
  document.body.dataset.world=selectedWorld;
  paused=false;last=null;pointer=null;
  $('overlay').hidden=true;$('board').classList.remove('boom');
  render();measureBoard();positionActors();
}

function measureBoard(){
  const board=$('board'),layer=$('actors');
  if(!board.clientWidth)return;
  metrics={width:board.clientWidth,height:board.clientHeight,gap:parseFloat(getComputedStyle(board).columnGap)||5};
  Object.assign(layer.style,{left:`${board.offsetLeft}px`,top:`${board.offsetTop}px`,width:`${metrics.width}px`,height:`${metrics.height}px`});
}
new ResizeObserver(()=>{measureBoard();positionActors()}).observe($('board'));

function placeActor(key,distance,moving){
  const actor=actors[key];
  actor.hidden=distance===null;
  if(distance===null)return;
  const p=sampleRoute(motion.route,distance),{width,height,gap}=metrics;
  const w=(width-3*gap)/4,h=(height-3*gap)/4;
  Object.assign(actor.style,{left:`${w/2+p.x*(w+gap)}px`,top:`${h/2+p.y*(h+gap)}px`,width:`${w}px`,height:`${h}px`});
  // The reference faces left. Mirror horizontally when travelling to the right.
  if(p.dx)actor.style.setProperty('--facing',p.dx>0?-1:1);
  actor.classList.toggle('moving',moving&&!paused&&state.status==='running');
}

function positionActors(){
  if(!motion)return;
  placeActor('steve',motion.aDistance,motion.movingA);
  placeActor('creeper',motion.bDistance,motion.movingB);
  actors.creeper.classList.toggle('fusing',motion.fuse>0);
  actors.creeper.style.setProperty('--fuse-flash',(0.42-0.28*Math.min(1,motion.fuse/CREEPER_FUSE_MS))+'s');
  $('actors').classList.toggle('actors-paused',paused||brakeFreezesWorld());
}

for(const kind of ['straight','curve','cross']){const image=new Image();image.src=`assets/rail-${kind}-v044.png`;}

function render(){
 if(!state)return;
 const config=WORLDS[state.world],gap=state.tiles.indexOf(null),active=state.status==='running'&&!paused;
 if(selectedTile!==null&&!canEdit(state,selectedTile))selectedTile=null;
 renderTiles($('board'),state.tiles.map((tile,i)=>{
  const editable=active&&canEdit(state,i),reserved=i===state.reserved;
  if(!tile&&state.world!=='nether')return '<div class="tile empty" aria-label="空きマス"></div>';
  const actionable=editable&&(state.world==='end'?ports.cross.some(d=>neighbor(gap,d)===i):state.world==='mine'?tile?.type!=='cross':state.world==='nether'?!tile||state.placed.has(i):true);
  const action=state.world==='grass'?'入れ替え':state.world==='mine'?'回転':state.world==='nether'?(tile?'線路を戻す':'線路を置く'):'移動';
  const mark=i===0?'<span class="badge">▶</span>':i===15?(assets.house?`<img class="house-img" src="${assets.house}" alt="駅">`:'<span class="house">⌂</span>'):'';
  return `<button data-index="${i}" aria-disabled="${!actionable}" tabindex="${actionable?0:-1}" class="tile ${!tile?'placement-slot':''} ${tile?.used.length?'locked':''} ${reserved?'reserved':''} ${actionable&&state.world==='end'?'movable':''} ${selectedTile===i?'selected-tile':''}" aria-label="${Math.floor(i/4)+1}行${i%4+1}列 ${tile?.used.length?'固定':reserved?'進入中':actionable?action:'操作不可'}${selectedTile===i?' 選択中':''}">${tile?railArtwork(tile.type,'board-'+i):'<span class="place-plus" aria-hidden="true">＋</span>'}${mark}</button>`;
 }));
 $('world-queue').hidden=state.world!=='nether';
 if(state.world==='nether'){const queueMarkup=state.queue.slice(0,3).map((type,i)=>`<span class="queue-piece ${i===0?'next-piece':''}" aria-label="${i+1}番目の線路">${railArtwork(type,'queue-'+i)}</span>`).join('');if($('queue-pieces').innerHTML!==queueMarkup)$('queue-pieces').innerHTML=queueMarkup;}
 $('moves').textContent=`${state.moves} 手`;
 const canDrive=state.status==='ready'||state.status==='running',isStopped=state.status==='running'&&motion.cartStopped;
 $('start').disabled=!canDrive||paused;
 const driveLabel=state.status==='running'?(isStopped?'発車':'停車'):'出発';
 $('start').innerHTML=(state.status==='running'&&!isStopped?STOP_ICON:UI_ICONS.play)+'<span>'+driveLabel+'</span>';
 $('start').setAttribute('aria-label',state.status==='running'?(isStopped?'スティーブを発車させる':'スティーブを停車させる'):'出発');
 $('start').setAttribute('aria-pressed',String(isStopped));
 $('pause').disabled=state.status!=='running';$('pause').innerHTML=paused?UI_ICONS.play:UI_ICONS.pause;
 $('pause').setAttribute('aria-label',paused?'つづける':'一時停止');$('pause').setAttribute('aria-pressed',String(paused));
 const stage=config.name+' '+String(state.level+1).padStart(2,'0');
 if($('stage-number').textContent!==stage)$('stage-number').textContent=stage;
 if($('world-rule').textContent!==config.rule)$('world-rule').textContent=config.rule;
 $('message').textContent=paused?'一時停止中。':state.status==='ready'?'出発でトロッコを走らせよう。':state.status==='won'?'脱出成功！':state.status==='lost'?'つかまった！':motion.fuse?'シュー……！ はなれて！':motion.cartStopped?'停車中。線路をつないで発車しよう。':config.description;
 positionActors();
}
function move(i){
 if(state.status!=='running'||paused||!canEdit(state,i))return;
 let changed=false;
 if(state.world==='grass'){
  if(selectedTile===null){selectedTile=i;tone(320,.04);render();return;}
  if(selectedTile===i){selectedTile=null;render();return;}
  changed=swap(state,selectedTile,i);selectedTile=null;
 }else if(state.world==='mine')changed=rotate(state,i);
 else if(state.world==='nether')changed=state.tiles[i]?removePlaced(state,i):build(state,i);
 else changed=slide(state,i);
 if(changed){tone(420);render()}else tone(120,.04);
}
$('board').addEventListener('pointerdown',e=>{
  if(state.status!=='running'||paused){pointer=null;return;}
  const tile=e.target.closest('[data-index]');
  if(tile)pointer={i:Number(tile.dataset.index),x:e.clientX,y:e.clientY};
});
$('board').addEventListener('pointerup',e=>{
  if(!pointer)return;
  const p=pointer;pointer=null;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;
  if(Math.hypot(dx,dy)>18){
    if(state.world!=='end')return;
    const d=Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0);
    if(neighbor(p.i,d)!==state.tiles.indexOf(null))return;
  }
  move(p.i);
});
$('board').addEventListener('pointercancel',()=>pointer=null);
$('board').addEventListener('click',e=>{
  if(e.detail===0){const tile=e.target.closest('[data-index]');if(tile)move(Number(tile.dataset.index))}
});

$('start').onclick=()=>{
  if(paused)return;
  if(state.status==='ready'){start(state);last=null;tone(650,.15)}
  else if(state.status==='running'){
    motion.cartStopped=!motion.cartStopped;
    motion.movingA=!motion.cartStopped&&Boolean(motion.segment);
    if(WORLDS[selectedWorld].pausePursuitOnBrake){
      if(motion.cartStopped){motion.movingB=false;stopFuseSound()}else if(motion.fuse>0)beginFuseSound();
    }
    tone(motion.cartStopped?220:520,.07);
  }else return;
  render();
};
$('reset').onclick=()=>{tone(300,.12);reset()};$('again').onclick=()=>{tone(300,.12);reset();$('start').focus({preventScroll:true})};
$('pause').onclick=()=>{tone(paused?520:260,.12);paused=!paused;last=null;if(paused)stopFuseSound();else if(motion.fuse>0&&!brakeFreezesWorld())beginFuseSound();render()};
$('sound').onclick=()=>setSound(!audio.settings.enabled);
document.addEventListener('visibilitychange',()=>{
  audio.setVisible(!document.hidden);
  if(document.hidden)stopFuseSound();
  if(document.hidden&&state.status==='running'){paused=true;last=null;render()}
});

function finish(win){
  stopFuseSound();
  if(win){tone(850,.25);render();collectionUI.beginReward(runId,state.level,state.world);journey.complete(state.level);return;}
  $('overlay').hidden=false;
  $('result-title').textContent='YOUdead!';
  $('result-text').textContent='クリーパーに爆破された';
  $('again').focus({preventScroll:true});
  if(!win)$('board').classList.add('boom');
  audio.explode();render();
}

function tick(now){
  const delta=last===null?0:Math.min(now-last,100);last=now;
  if(state.status==='running'&&!paused){
    const previousFuse=motion.fuse;
    const changed=updateMotion(state,motion,delta,{...WORLDS[selectedWorld],fuseMs:CREEPER_FUSE_MS});
    if(motion.fuse>0&&previousFuse===0)beginFuseSound();
    else if(motion.fuse===0&&previousFuse>0)stopFuseSound();
    if(changed)render();
    positionActors();
    if(state.status==='won'||state.status==='lost')finish(state.status==='won');
  }
  requestAnimationFrame(tick);
}

const screenIds={title:'title-screen',game:'game-screen',guide:'guide-screen',options:'options-screen',reward:'reward-screen',world:'world-screen'};
function showScreen(name){
  if(name!=='game'&&state.status==='running'){paused=true;last=null;stopFuseSound();render()}
  document.body.dataset.screen=name;
  audio.setScene(name==='game'?'game':'title');
  for(const [key,id] of Object.entries(screenIds))$(id).hidden=key!==name;
  window.scrollTo(0,0);
  if(name==='game'){measureBoard();positionActors()}
  const target=name==='title'?$('play-game'):name==='game'?$('start'):name==='world'?$('world-'+selectedWorld):$(screenIds[name]).querySelector('button');
  target?.focus({preventScroll:true});
}
let collectionStorage;
try{collectionStorage=window.localStorage}catch{}
collectionUI=createCatalogUI({showScreen,playTone:tone,playMining:()=>audio.effect('mine'),playReward:shiny=>audio.reward(shiny),storage:collectionStorage,audioSettings:()=>audio.settings,onContinue:(level,world)=>{
  if(isWorld(world)){selectedWorld=world;saveWorld(audioStorage,world)}
  journey.complete(level);reset();showScreen('game');
}});
$('play-game').onclick=()=>{
  if(collectionUI.resumeReward())return;
  for(const id of Object.keys(WORLDS))$('world-'+id).setAttribute('aria-pressed',String(id===selectedWorld));
  showScreen('world');
};
for(const id of Object.keys(WORLDS))$('world-'+id).onclick=()=>{selectedWorld=id;saveWorld(audioStorage,id);reset();showScreen('game');tone(520,.1)};
$('world-back').onclick=()=>showScreen('title');
$('open-guide').onclick=()=>collectionUI.openCollection('title');
$('open-options').onclick=()=>{audio.unlock();renderAudioOptions();showScreen('options')};
$('options-done').onclick=()=>showScreen('title');
$('back-title').onclick=()=>showScreen('title');
$('death-title').onclick=()=>{tone(300,.12);$('overlay').hidden=true;showScreen('title')};
document.querySelectorAll('[data-back-title]').forEach(button=>button.onclick=()=>showScreen('title'));
renderAudioOptions();renderActorImage('steve');renderActorImage('creeper');
const pendingWorld=collectionUI.pendingWorld();
if(isWorld(pendingWorld)){selectedWorld=pendingWorld;saveWorld(audioStorage,pendingWorld)}
const pendingLevel=collectionUI.pendingLevel();
if(Number.isSafeInteger(pendingLevel))journey.complete(pendingLevel);
reset();collectionUI.resumeReward();requestAnimationFrame(tick);

void runStartup();
