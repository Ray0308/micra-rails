// Minimal DOM harness for startup, navigation, continuous frames, and pause behavior.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generatePuzzle,generateWorldPuzzle} from '../engine.mjs';
import {WORLDS} from '../worlds.mjs';
import {JOURNEY_KEY} from '../journey.mjs';
class Element{
 constructor(id){this.id=id;this.dataset={};this.hidden=false;this.innerHTML='';this.clientWidth=400;this.clientHeight=400;this.offsetLeft=10;this.offsetTop=10;this.style={setProperty(k,v){this[k]=v}};const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,v)=>v?classes.add(x):classes.delete(x),contains:x=>classes.has(x)};this.events={};this.value=id==='pace'?'easy':'0'}
 setAttribute(name,value){this[name]=value}getAttribute(name){return this[name]}querySelectorAll(){return []}replaceChildren(){this.innerHTML=''}showModal(){this.open=true}close(){this.open=false}animate(){}addEventListener(name,fn){this.events[name]=fn}focus(){}querySelector(){return new Element('button')}
}
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
const el=id=>{assert.ok(elements.has(id),`Missing DOM node: ${id}`);return elements.get(id)};
globalThis.document={getElementById:el,body:Object.assign(new Element('body'),{dataset:{screen:'title'}}),querySelectorAll:()=>[],addEventListener(){}};
const saved=new Map();
globalThis.window={scrollTo(){},addEventListener(){},innerWidth:390,localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};
globalThis.getComputedStyle=()=>({columnGap:'5'});
globalThis.ResizeObserver=class{constructor(fn){this.fn=fn}observe(){this.fn()}};
globalThis.Image=class{set src(v){this.url=v;if(!v.includes('house'))queueMicrotask(()=>this.onload?.())}get src(){return this.url}};
let frame;globalThis.requestAnimationFrame=fn=>frame=fn;
await import('../app.mjs');
await Promise.resolve();
function enterWorld(world){el('play-game').onclick();assert.equal(document.body.dataset.screen,'world');el('world-'+world).onclick();}

assert.ok(el('actor-steve').innerHTML.includes('assets/steve.png'));
assert.ok(el('actor-creeper').innerHTML.includes('assets/creeper.png'));
assert.ok(!el('actor-creeper').innerHTML.includes('class="cart"'));
assert.ok(!elements.has('exit-game')&&!elements.has('exit-screen'),'exit must be replaced by options');
el('open-credits').onclick();assert.equal(document.body.dataset.screen,'credits');assert.equal(el('credits-screen').hidden,false);
el('credits-back').onclick();assert.equal(document.body.dataset.screen,'title');assert.equal(el('credits-screen').hidden,true);
el('open-options').onclick();assert.equal(document.body.dataset.screen,'options');
el('bgm-volume').value='27';el('bgm-volume').events.input();
el('sfx-volume').value='0';el('sfx-volume').events.input();
el('sound-on').onclick();
assert.deepEqual(JSON.parse(saved.get('micra-rails.audio.v1')),{enabled:true,bgm:27,sfx:0});
assert.equal(el('bgm-value').textContent,'27');assert.equal(el('sfx-value').textContent,'0');
assert.equal(el('sound-on')['aria-pressed'],'true');assert.equal(el('sound')['aria-pressed'],'true');
el('sound').onclick();assert.equal(el('sound-off')['aria-pressed'],'true');
el('options-done').onclick();assert.equal(document.body.dataset.screen,'title');
enterWorld('end');assert.equal(document.body.dataset.screen,'game');
el('start').onclick();frame(0);
const initial={x:parseFloat(el('actor-steve').style.left),y:parseFloat(el('actor-steve').style.top)};
for(let i=1;i<=40;i++)frame(i*16);
const moved={x:parseFloat(el('actor-steve').style.left),y:parseFloat(el('actor-steve').style.top)};
const travelled=Math.hypot(moved.x-initial.x,moved.y-initial.y);
assert.ok(travelled>0&&travelled<100,'actor must be between cells, not teleporting');
el('pause').onclick();for(let i=41;i<=90;i++)frame(i*16);
assert.equal(parseFloat(el('actor-steve').style.left),moved.x,'pause must freeze horizontal position');
assert.equal(parseFloat(el('actor-steve').style.top),moved.y,'pause must freeze vertical position');
const pauseMoves=el('moves').textContent;slidePanel(generatePuzzle(JSON.parse(saved.get(JOURNEY_KEY)).seed).solution[0]);assert.equal(el('moves').textContent,pauseMoves,'pause must lock rail editing');
el('back-title').onclick();assert.equal(document.body.dataset.screen,'title');
el('open-guide').onclick();assert.equal(document.body.dataset.screen,'guide');
assert.ok(el('catalog-grid').innerHTML.includes('未発見'));
assert.ok(el('catalog-summary').textContent.startsWith('1 / 88'));
assert.equal((el('catalog-grid').innerHTML.match(/collection-card owned/g)||[]).length,1);
assert.ok(el('catalog-grid').innerHTML.includes('スティーブ'));
assert.equal(saved.has('micra-rails.collection.review-backup.v0.2.7'),false);
el('catalog-back').onclick();assert.equal(document.body.dataset.screen,'title');
enterWorld('end');
function slidePanel(index){
 const target={closest:()=>({dataset:{index:String(index)}})};
 el('board').events.pointerdown({target,clientX:0,clientY:0});
 el('board').events.pointerup({clientX:0,clientY:0});
}
const solution=generatePuzzle(JSON.parse(saved.get(JOURNEY_KEY)).seed).solution;
assert.ok(!elements.has('level'),'stage selection must be removed');
slidePanel(solution[0]);
assert.equal(el('moves').textContent,'0 手','rails must not move before departure');
assert.ok(!/class="tile[^\"]* movable/.test(el('board').innerHTML),'ready rails must not appear movable');
el('start').onclick();
assert.equal(el('start')['aria-label'],'スティーブを停車させる');
assert.equal(el('start').disabled,false);
el('start').onclick();
assert.equal(el('start')['aria-pressed'],'true');assert.equal(el('start')['aria-label'],'スティーブを発車させる');
const brakedPosition={x:el('actor-steve').style.left,y:el('actor-steve').style.top};
for(let time=2000;time<2500;time+=100)frame(time);
assert.equal(el('actor-steve').style.left,brakedPosition.x);assert.equal(el('actor-steve').style.top,brakedPosition.y);
for(const index of solution)slidePanel(index);
assert.equal(el('moves').textContent,solution.length+' 手','rails must remain editable with the cart brake on');
el('start').onclick();assert.equal(el('start')['aria-pressed'],'false');
for(let time=2500;time<27000;time+=100)frame(time);
assert.equal(document.body.dataset.screen,'reward','winning must lead to block mining');
assert.equal(el('reward-screen').dataset.phase,'mining');
for(let i=0;i<4;i++)el('mine-block').onclick();
assert.equal(el('reward-screen').dataset.phase,'mining');
el('mine-block').onclick();assert.equal(el('reward-screen').dataset.phase,'revealed');
assert.equal(el('reward-card').hidden,false);
const key='micra-rails.collection.v1';
assert.equal(JSON.parse(saved.get(key)).draws,1);
for(let i=0;i<3;i++)el('mine-block').onclick();
assert.equal(JSON.parse(saved.get(key)).draws,1);
el('reward-book').onclick();assert.equal(document.body.dataset.screen,'guide');
el('catalog-back').onclick();assert.equal(document.body.dataset.screen,'reward');
await new Promise(resolve=>setTimeout(resolve,950));
el('reward-next').onclick();assert.equal(document.body.dataset.screen,'game');
assert.equal(el('stage-number').textContent,'エンド 02');assert.equal(JSON.parse(saved.get(JOURNEY_KEY)).level,1);assert.equal(JSON.parse(saved.get(key)).reward,null);
let testClock=50000;
for(const world of ['grass','mine','nether']){
 el('back-title').onclick();enterWorld(world);
 assert.equal(document.body.dataset.world,world);assert.equal(el('world-rule').textContent,WORLDS[world].rule);
 assert.equal(el('world-queue').hidden,world!=='nether');
 const plan=generateWorldPuzzle(world,JSON.parse(saved.get(JOURNEY_KEY)).seed);
 el('start').onclick();el('start').onclick();
 if(world==='grass'){
  for(let i=0;i<100;i++){frame(testClock);testClock+=100}
  assert.equal(el('actor-creeper').hidden,true,'grass brake must stop the spawn clock too');
 }
 for(const action of plan.solution){
  if(action.kind==='swap'){slidePanel(action.a);slidePanel(action.b)}else slidePanel(action.index);
 }
 assert.equal(el('moves').textContent,plan.solution.length+' 手',world+' operation count');
 el('start').onclick();
 for(let i=0;i<350;i++){frame(testClock);testClock+=100}
 assert.equal(document.body.dataset.screen,'reward',world+' should clear');
 for(let i=0;i<5;i++)el('mine-block').onclick();
 assert.equal(JSON.parse(saved.get(key)).reward.world,world);
 await new Promise(resolve=>setTimeout(resolve,950));el('reward-next').onclick();
 assert.equal(document.body.dataset.screen,'game');
}
el('back-title').onclick();enterWorld('end');
const deathStage=el('stage-number').textContent;
function explodeCart(){el('start').onclick();el('start').onclick();for(let i=0;i<110;i++){frame(testClock);testClock+=100}}
explodeCart();assert.equal(el('overlay').hidden,false);
assert.equal(el('result-title').textContent,'YOUdead!');assert.equal(el('result-text').textContent,'クリーパーに爆破された');
el('again').onclick();assert.equal(el('overlay').hidden,true);assert.equal(el('stage-number').textContent,deathStage);assert.equal(el('moves').textContent,'0 手');assert.equal(el('start').disabled,false);
explodeCart();el('death-title').onclick();assert.equal(document.body.dataset.screen,'title');assert.equal(el('overlay').hidden,true);
const drawsBeforeMapChange=JSON.parse(saved.get(key)).draws;
for(const world of ['grass','mine','nether','end']){
 enterWorld(world);const stage=el('stage-number').textContent,before=JSON.parse(saved.get(JOURNEY_KEY));
 el('start').onclick();el('pause').onclick();el('change-map').onclick();
 const after=JSON.parse(saved.get(JOURNEY_KEY));
 assert.equal(after.level,before.level);assert.notEqual(after.seed,before.seed);
 assert.equal(document.body.dataset.world,world);assert.equal(el('stage-number').textContent,stage);assert.equal(el('moves').textContent,'0 手');
 assert.equal(el('start').disabled,false);assert.equal(el('pause').disabled,true);assert.equal(el('overlay').hidden,true);
 const newBoard=el('board').innerHTML;el('reset').onclick();assert.equal(el('board').innerHTML,newBoard);assert.deepEqual(JSON.parse(saved.get(JOURNEY_KEY)),after);
 assert.equal(JSON.parse(saved.get(key)).draws,drawsBeforeMapChange);assert.equal(JSON.parse(saved.get(key)).reward,null);
 el('back-title').onclick();
}
enterWorld('end');explodeCart();const lostStage=el('stage-number').textContent,lostSeed=JSON.parse(saved.get(JOURNEY_KEY)).seed;
el('death-change-map').onclick();assert.equal(el('overlay').hidden,true);assert.equal(el('stage-number').textContent,lostStage);assert.notEqual(JSON.parse(saved.get(JOURNEY_KEY)).seed,lostSeed);
assert.equal(JSON.parse(saved.get(key)).draws,drawsBeforeMapChange);
console.log('PASS: four worlds, rewards, normal collection, death screen and free map rerolls without advancing or granting rewards');
