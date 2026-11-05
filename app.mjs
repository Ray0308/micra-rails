import {create,slide,start,ports,neighbor} from './engine.mjs?v=0.1.4';
import {createMotion,updateMotion,sampleRoute} from './motion.mjs?v=0.1.4';

const $=id=>document.getElementById(id);
let state,motion,paused=false,last=null,sounding=false,audio,pointer;
let metrics={width:0,height:0,gap:5};
const assets={};
const actors={steve:$('actor-steve'),creeper:$('actor-creeper')};

for(const key of ['steve','creeper','house']){
  const image=new Image();
  image.onload=()=>{assets[key]=image.src;renderActorImage(key);render()};
  image.src=key==='house'?'assets/station.svg?v=0.1.4':`assets/${key}.png?v=0.1.4`;
}

function tone(hz=300,duration=.08){
  if(!sounding)return;
  try{
    audio??=new AudioContext();audio.resume();
    const osc=audio.createOscillator(),gain=audio.createGain();
    osc.type='square';osc.frequency.value=hz;
    gain.gain.setValueAtTime(.035,audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
    osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);
  }catch{}
}

function renderActorImage(key){
  if(!actors[key])return;
  const label=key==='steve'?'トロッコに乗ったスティーブ':'歩いて追いかけるクリーパー';
  const content=assets[key]
    ?`<img class="actor-image" src="${assets[key]}" alt="${label}" draggable="false">`
    :`${key==='steve'?'<span class="cart"></span>':''}<span class="character ${key}"></span>`;
  actors[key].innerHTML=`<div class="actor-visual">${content}</div>`;
}

function reset(){
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
    const movable=!tile.used.length&&!reserved&&i!==0&&i!==15&&ports.cross.some(d=>neighbor(gap,d)===i);
    const lines=ports[tile.type].map(d=>{
      const [x,y]=[[50,0],[100,50],[50,100],[0,50]][d];
      return `<path d="M50 50 L${x} ${y}"/>`;
    }).join('');
    return `<button data-index="${i}" class="tile ${tile.used.length?'locked':''} ${reserved?'reserved':''} ${movable?'movable':''}" aria-label="${Math.floor(i/4)+1}行${i%4+1}列 ${tile.type==='cross'?'十字':'レール'} ${tile.used.length?'固定':reserved?'進入中':movable?'移動できる':''}"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="rail-mask-${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="black"/><g stroke="white" stroke-width="29" fill="none">${lines}</g><g stroke="black" stroke-width="19" fill="none">${lines}</g></mask><linearGradient id="rail-metal-${i}" x2="1" y2="1"><stop stop-color="#eee3c5"/><stop offset=".42" stop-color="#979b99"/><stop offset=".58" stop-color="#dedbcb"/><stop offset="1" stop-color="#666b6b"/></linearGradient></defs><g stroke="#342316" stroke-width="46" stroke-dasharray="9 11" fill="none">${lines}</g><g stroke="#916b42" stroke-width="40" stroke-dasharray="7 13" fill="none">${lines}</g><rect width="100" height="100" fill="url(#rail-metal-${i})" mask="url(#rail-mask-${i})"/></svg>${i===0?'<span class="badge">▶</span>':''}${i===15?(assets.house?`<img class="house-img" src="${assets.house}" alt="駅">`:'<span class="house">⌂</span>'):''}</button>`;
  }).join('');
  $('moves').textContent=`${state.moves} 手`;
  $('start').disabled=state.status!=='ready';
  $('pause').disabled=state.status!=='running';
  $('pause').textContent=paused?'▶':'Ⅱ';
  $('pause').setAttribute('aria-label',paused?'つづける':'一時停止');
  $('pause').setAttribute('aria-pressed',String(paused));
  $('level').disabled=state.status==='running';
  $('message').textContent=paused?'おやすみ中。つづけるボタンで再開。':state.status==='ready'?'レールを準備したらスタート！ 光るパネルを動かせるよ。':state.status==='won'?'脱出成功！':state.status==='lost'?'つかまった！ レールを変えて、もう一度。':motion.fuse?'シュー……！ はやく、はなれて！':motion.elapsed<5500?'トロッコが出発！ もうすぐクリーパーが来る。':'歩いて追いかけてきた！ 右下の駅までレールをつなごう。';
  positionActors();
}

function move(i){
  if(paused)return;
  if(slide(state,i)){tone(420);render()}else tone(120,.04);
}
$('board').addEventListener('pointerdown',e=>{
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
$('sound').onclick=()=>{sounding=!sounding;$('sound').innerHTML=sounding?'♪':'♪<span class="sound-off">×</span>';$('sound').setAttribute('aria-label',sounding?'効果音をオフにする':'効果音をオンにする');$('sound').setAttribute('aria-pressed',String(sounding));tone()};
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&state.status==='running'){paused=true;last=null;render()}
});

function finish(win){
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

const screenIds={title:'title-screen',game:'game-screen',guide:'guide-screen',exit:'exit-screen'};
function showScreen(name){
  if(name!=='game'&&state.status==='running'){paused=true;last=null;render()}
  document.body.dataset.screen=name;
  for(const [key,id] of Object.entries(screenIds))$(id).hidden=key!==name;
  window.scrollTo(0,0);
  if(name==='game'){measureBoard();positionActors()}
  const target=name==='title'?$('play-game'):name==='game'?$('start'):$(screenIds[name]).querySelector('button');
  target?.focus({preventScroll:true});
}
$('play-game').onclick=()=>{reset();showScreen('game')};
$('open-guide').onclick=()=>showScreen('guide');
$('exit-game').onclick=()=>showScreen('exit');
$('back-title').onclick=()=>showScreen('title');
document.querySelectorAll('[data-back-title]').forEach(button=>button.onclick=()=>showScreen('title'));
renderActorImage('steve');renderActorImage('creeper');
reset();requestAnimationFrame(tick);
