// Minimal DOM harness for startup, navigation, continuous frames, and pause behavior.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
class Element{
 constructor(id){this.id=id;this.dataset={};this.hidden=false;this.innerHTML='';this.clientWidth=400;this.clientHeight=400;this.offsetLeft=10;this.offsetTop=10;this.style={setProperty(k,v){this[k]=v}};const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,v)=>v?classes.add(x):classes.delete(x),contains:x=>classes.has(x)};this.events={};this.value=id==='pace'?'easy':'0'}
 setAttribute(name,value){this[name]=value}getAttribute(name){return this[name]}querySelectorAll(){return []}replaceChildren(){this.innerHTML=''}showModal(){this.open=true}close(){this.open=false}animate(){}addEventListener(name,fn){this.events[name]=fn}focus(){}querySelector(){return new Element('button')}
}
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
const el=id=>{assert.ok(elements.has(id),`Missing DOM node: ${id}`);return elements.get(id)};
globalThis.document={getElementById:el,body:{dataset:{screen:'title'}},querySelectorAll:()=>[],addEventListener(){}};
const saved=new Map();
globalThis.window={scrollTo(){},addEventListener(){},innerWidth:390,localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};
globalThis.getComputedStyle=()=>({columnGap:'5'});
globalThis.ResizeObserver=class{constructor(fn){this.fn=fn}observe(){this.fn()}};
globalThis.Image=class{set src(v){this.url=v;if(!v.includes('house'))queueMicrotask(()=>this.onload?.())}get src(){return this.url}};
let frame;globalThis.requestAnimationFrame=fn=>frame=fn;
await import('../app.mjs');
await Promise.resolve();
assert.ok(el('actor-steve').innerHTML.includes('assets/steve.png'));
assert.ok(el('actor-creeper').innerHTML.includes('assets/creeper.png'));
assert.ok(!el('actor-creeper').innerHTML.includes('class="cart"'));
el('play-game').onclick();assert.equal(document.body.dataset.screen,'game');
el('start').onclick();frame(0);
const initial=parseFloat(el('actor-steve').style.left);
for(let i=1;i<=40;i++)frame(i*16);
const moved=parseFloat(el('actor-steve').style.left);
assert.ok(moved>initial&&moved<initial+100,'actor must be between cells, not teleporting');
el('pause').onclick();for(let i=41;i<=90;i++)frame(i*16);
assert.equal(parseFloat(el('actor-steve').style.left),moved,'pause must freeze visual position');
const pauseMoves=el('moves').textContent;slidePanel(6);assert.equal(el('moves').textContent,pauseMoves,'pause must lock rail editing');
el('back-title').onclick();assert.equal(document.body.dataset.screen,'title');
el('open-guide').onclick();assert.equal(document.body.dataset.screen,'guide');
assert.ok(el('catalog-grid').innerHTML.includes('スティーブ'));
el('catalog-back').onclick();assert.equal(document.body.dataset.screen,'title');
el('play-game').onclick();
function slidePanel(index){
 const target={closest:()=>({dataset:{index:String(index)}})};
 el('board').events.pointerdown({target,clientX:0,clientY:0});
 el('board').events.pointerup({clientX:0,clientY:0});
}
slidePanel(6);
assert.equal(el('moves').textContent,'0 手','rails must not move before departure');
assert.ok(!/class="tile[^\"]* movable/.test(el('board').innerHTML),'ready rails must not appear movable');
el('start').onclick();
slidePanel(6);
assert.equal(el('moves').textContent,'1 手','rails must move after departure');
for(let time=2000;time<18000;time+=100)frame(time);
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
assert.equal(el('level').value,'1');assert.equal(JSON.parse(saved.get(key)).reward,null);
console.log('PASS: startup, movement, pause, title, catalog, clear → mining → card → catalog → next stage, and once-only saved reward');
