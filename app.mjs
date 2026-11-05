import {createAudioController} from './audio.mjs?v=0.2.3';
import {createCatalogUI} from './catalog-ui.mjs?v=0.2.3';
import {create,slide,start,ports,neighbor} from './engine.mjs?v=0.1.4';
import {createMotion,updateMotion,sampleRoute} from './motion.mjs?v=0.1.4';

const $=id=>document.getElementById(id);
const UI_ICONS={"back":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M14 5L7 12L14 19M8 12H20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"square\" stroke-linejoin=\"miter\"/></svg>","play":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M8 5L19 12L8 19Z\" fill=\"currentColor\"/></svg>","pause":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 5H10V19H6ZM14 5H18V19H14Z\" fill=\"currentColor\"/></svg>","reset":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M19 10A7 7 0 1 0 19 15M19 4V10H13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linejoin=\"miter\"/></svg>","soundOn":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 9H7L12 5V19L7 15H3Z\" fill=\"currentColor\"/><path d=\"M16 8C19 10 19 14 16 16M19 5C24 9 24 15 19 19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>","soundOff":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 9H7L12 5V19L7 15H3Z\" fill=\"currentColor\"/><path d=\"M16 9L22 15M22 9L16 15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>"};
let state,motion,paused=false,last=null,pointer,runId,collectionUI;
let audioStorage;
try{audioStorage=window.localStorage}catch{}
const audio=createAudioController({storage:audioStorage});
let metrics={width:0,height:0,gap:5};
const assets={};
const actors={steve:$('actor-steve'),creeper:$('actor-creeper')};

for(const key of ['steve','creeper','house']){
  const image=new Image();
  image.onload=()=>{assets[key]=image.src;renderActorImage(key);render()};
  image.src=key==='house'?'assets/station.svg?v=0.1.4':`assets/${key}.png?v=0.1.4`;
}

function tone(hz=300,duration=.08){audio.tone(hz,duration)}
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
function setSound(enabled){if(!enabled)window.speechSynthesis?.cancel();audio.setEnabled(enabled);audio.unlock();renderAudioOptions();if(enabled)tone(440,.08)}
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

function renderActorImage(key){
  if(!actors[key])return;
  const label=key==='steve'?'トロッコに乗ったスティーブ':'歩いて追いかけるクリーパー';
  const content=assets[key]
    ?`<img class="actor-image" src="${assets[key]}" alt="${label}" draggable="false">`
    :`${key==='steve'?'<span class="cart"></span>':''}<span class="character ${key}"></span>`;
  actors[key].innerHTML=`<div class="actor-visual">${content}</div>`;
}

function reset(){
  runId=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  state=create(Number($('level').value));motion=createMotion(state);
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
  $('actors').classList.toggle('actors-paused',paused);
}

function render(){
  if(!state)return;
  const gap=state.tiles.indexOf(null);
  $('board').innerHTML=state.tiles.map((tile,i)=>{
    if(!tile)return '<div class="tile empty" aria-label="空きマス"></div>';
    const reserved=i===state.reserved;
    const movable=state.status==='running'&&!paused&&!tile.used.length&&!reserved&&i!==0&&i!==15&&ports.cross.some(d=>neighbor(gap,d)===i);
    const lines=ports[tile.type].map(d=>{
      const [x,y]=[[50,0],[100,50],[50,100],[0,50]][d];
      return `<path d="M50 50 L${x} ${y}"/>`;
    }).join('');
    return `<button data-index="${i}" aria-disabled="${!movable}" tabindex="${movable?0:-1}" class="tile ${tile.used.length?'locked':''} ${reserved?'reserved':''} ${movable?'movable':''}" aria-label="${Math.floor(i/4)+1}行${i%4+1}列 ${tile.type==='cross'?'十字':'レール'} ${tile.used.length?'固定':reserved?'進入中':movable?'移動できる':''}"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="rail-mask-${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="black"/><g stroke="white" stroke-width="29" fill="none">${lines}</g><g stroke="black" stroke-width="19" fill="none">${lines}</g></mask><linearGradient id="rail-metal-${i}" x2="1" y2="1"><stop stop-color="#eee3c5"/><stop offset=".42" stop-color="#979b99"/><stop offset=".58" stop-color="#dedbcb"/><stop offset="1" stop-color="#666b6b"/></linearGradient></defs><g stroke="#342316" stroke-width="46" stroke-dasharray="9 11" fill="none">${lines}</g><g stroke="#916b42" stroke-width="40" stroke-dasharray="7 13" fill="none">${lines}</g><rect width="100" height="100" fill="url(#rail-metal-${i})" mask="url(#rail-mask-${i})"/></svg>${i===0?'<span class="badge">▶</span>':''}${i===15?(assets.house?`<img class="house-img" src="${assets.house}" alt="駅">`:'<span class="house">⌂</span>'):''}</button>`;
  }).join('');
  $('moves').textContent=`${state.moves} 手`;
  $('start').disabled=state.status!=='ready';
  $('pause').disabled=state.status!=='running';
  $('pause').innerHTML=paused?UI_ICONS.play:UI_ICONS.pause;
  $('pause').setAttribute('aria-label',paused?'つづける':'一時停止');
  $('pause').setAttribute('aria-pressed',String(paused));
  $('level').disabled=state.status==='running';
  $('message').textContent=paused?'おやすみ中。つづけるボタンで再開。':state.status==='ready'?'出発でトロッコを走らせよう。':state.status==='won'?'脱出成功！':state.status==='lost'?'つかまった！ レールを変えて、もう一度。':motion.fuse?'シュー……！ はやく、はなれて！':motion.elapsed<5500?'トロッコが出発！ もうすぐクリーパーが来る。':'歩いて追いかけてきた！ 右下の駅までレールをつなごう。';
  positionActors();
}

function move(i){
  if(state.status!=='running'||paused)return;
  if(slide(state,i)){tone(420);render()}else tone(120,.04);
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
    const d=Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0);
    if(neighbor(p.i,d)!==state.tiles.indexOf(null))return;
  }
  move(p.i);
});
$('board').addEventListener('pointercancel',()=>pointer=null);
$('board').addEventListener('click',e=>{
  if(e.detail===0){const tile=e.target.closest('[data-index]');if(tile)move(Number(tile.dataset.index))}
});

$('start').onclick=()=>{start(state);last=null;tone(650,.15);render()};
$('reset').onclick=reset;$('again').onclick=reset;$('level').onchange=reset;
$('pause').onclick=()=>{paused=!paused;last=null;render()};
$('sound').onclick=()=>setSound(!audio.settings.enabled);
document.addEventListener('visibilitychange',()=>{
  audio.setVisible(!document.hidden);
  if(document.hidden&&state.status==='running'){paused=true;last=null;render()}
});

function finish(win){
  if(win){tone(850,.25);render();collectionUI.beginReward(runId,state.level);return;}
  $('overlay').hidden=false;$('result-icon').textContent=win?'🏡':'💥';
  $('result-title').textContent=win?'にげきった！':'ドカーン！';
  $('result-text').textContent=win?`${state.moves}回のスライドで、駅に到着。`:'次はどこにつなごう？ もう一度チャレンジ。';
  if(!win)$('board').classList.add('boom');
  tone(win?850:70,.35);render();
}

function tick(now){
  const delta=last===null?0:Math.min(now-last,100);last=now;
  if(state.status==='running'&&!paused){
    const changed=updateMotion(state,motion,delta,{aInterval:1900,bInterval:1500});
    if(changed)render();
    positionActors();
    if(state.status==='won'||state.status==='lost')finish(state.status==='won');
  }
  requestAnimationFrame(tick);
}

const screenIds={title:'title-screen',game:'game-screen',guide:'guide-screen',options:'options-screen',reward:'reward-screen'};
function showScreen(name){
  if(name!=='game'&&state.status==='running'){paused=true;last=null;render()}
  document.body.dataset.screen=name;
  for(const [key,id] of Object.entries(screenIds))$(id).hidden=key!==name;
  window.scrollTo(0,0);
  if(name==='game'){measureBoard();positionActors()}
  const target=name==='title'?$('play-game'):name==='game'?$('start'):$(screenIds[name]).querySelector('button');
  target?.focus({preventScroll:true});
}
let collectionStorage;
try{collectionStorage=window.localStorage}catch{}
collectionUI=createCatalogUI({showScreen,playTone:tone,storage:collectionStorage,audioSettings:()=>audio.settings,onContinue:level=>{
  $('level').value=String((level+1)%3);reset();showScreen('game');
}});
$('play-game').onclick=()=>{if(collectionUI.resumeReward())return;reset();showScreen('game')};
$('open-guide').onclick=()=>collectionUI.openCollection('title');
$('open-options').onclick=()=>{audio.unlock();renderAudioOptions();showScreen('options')};
$('options-done').onclick=()=>showScreen('title');
$('back-title').onclick=()=>showScreen('title');
document.querySelectorAll('[data-back-title]').forEach(button=>button.onclick=()=>showScreen('title'));
renderAudioOptions();renderActorImage('steve');renderActorImage('creeper');
reset();collectionUI.resumeReward();requestAnimationFrame(tick);
