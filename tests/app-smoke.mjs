// Minimal DOM harness for startup, navigation, continuous frames, and pause behavior.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
class Element{
 constructor(id){this.id=id;this.dataset={};this.hidden=false;this.innerHTML='';this.clientWidth=400;this.clientHeight=400;this.offsetLeft=10;this.offsetTop=10;this.style={setProperty(k,v){this[k]=v}};const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,v)=>v?classes.add(x):classes.delete(x),contains:x=>classes.has(x)};this.events={};this.value=id==='pace'?'easy':'0'}
 addEventListener(name,fn){this.events[name]=fn}focus(){}querySelector(){return new Element('button')}
}
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
const el=id=>{assert.ok(elements.has(id),`Missing DOM node: ${id}`);return elements.get(id)};
globalThis.document={getElementById:el,body:{dataset:{screen:'title'}},querySelectorAll:()=>[],addEventListener(){}};
globalThis.window={scrollTo(){}};
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
el('back-title').onclick();assert.equal(document.body.dataset.screen,'title');
console.log('PASS: app startup, supplied PNGs, walking Creeper without cart, continuous frames, pause, and title navigation');
