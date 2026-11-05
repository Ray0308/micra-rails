import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTiles} from '../tile-view.mjs';
function fixture(){
 let replacements=0,writes=0;
 const board={children:[],get innerHTML(){return this.html||''},set innerHTML(html){writes++;this.html=html;this.children=[node(html)]}};
 function node(html){const attrs=new Map([...html.slice(0,html.indexOf('>')).matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));return {getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),set outerHTML(value){replacements++;board.children[0]=node(value)}}}
 return {board,counts:()=>({writes,replacements})};
}
test('passing and reserving rails preserves image nodes; actual rail changes replace only the tile',()=>{
 const f=fixture(),tile=(kind,cls)=>`<button class="tile ${cls}" aria-disabled="false"><svg data-kind="${kind}"><image href="rail.png"/></svg></button>`;
 renderTiles(f.board,[tile('ne','')]);const original=f.board.children[0];
 renderTiles(f.board,[tile('ne','reserved')]);renderTiles(f.board,[tile('ne','locked')]);
 assert.equal(f.board.children[0],original);assert.equal(original.getAttribute('class'),'tile locked');
 assert.deepEqual(f.counts(),{writes:1,replacements:0});
 renderTiles(f.board,[tile('es','')]);assert.notEqual(f.board.children[0],original);
 assert.deepEqual(f.counts(),{writes:1,replacements:1});
});
