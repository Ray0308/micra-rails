import {fixedBoard as create} from './fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {slide,start} from '../engine.mjs';
import {createMotion,updateMotion,sampleRoute} from '../motion.mjs';

const safe={delay:1e9};
function run(s,m,time,options=safe){for(let left=time;left>0;left-=Math.min(20,left))updateMotion(s,m,Math.min(20,left),options)}
function ready(solve=false){const s=create();if(solve)slide(s,6);start(s);return [s,createMotion(s)]}

test('cart moves continuously between cell centers',()=>{
 const [s,m]=ready();run(s,m,650);
 assert.ok(Math.abs(m.aDistance-.25)<.002);
 const p=sampleRoute(m.route,m.aDistance);assert.ok(p.x>0&&p.x<1);assert.equal(p.y,0);
 assert.equal(s.a,0);assert.equal(s.reserved,1);assert.equal(s.tiles[1].used.length,0);
 assert.equal(slide(s,1),false);
 run(s,m,700);assert.equal(s.a,1);assert.deepEqual(s.tiles[1].used,['h']);
});

test('stopping at a missing rail does not bank motion for a later jump',()=>{
 const [s,m]=ready();run(s,m,5000);assert.equal(m.aDistance,1);assert.equal(m.movingA,false);
 assert.ok(slide(s,6));run(s,m,100);
 assert.ok(m.aDistance>1&&m.aDistance<1.05);
});

test('continuous pursuit starts after the delay and catches a stopped cart',()=>{
 const [s,m]=ready();run(s,m,5400,{});assert.equal(m.bDistance,null);
 run(s,m,400,{});assert.ok(m.bDistance>0&&m.bDistance<1);
 run(s,m,4000,{});assert.equal(s.status,'lost');assert.ok(m.fuse>=950);
});

test('goal is awarded after the cart visually reaches the station center',()=>{
 const [s,m]=ready(true);run(s,m,14800);
 assert.equal(s.a,15);assert.equal(s.status,'running');assert.ok(m.aDistance>5.5&&m.aDistance<6);
 run(s,m,1200);assert.equal(s.status,'won');assert.equal(m.aDistance,6);
});

test('turns keep position continuous on the connected route',()=>{
 const route=[0,1,2,3,7,11,15];
 const a=sampleRoute(route,2.999),b=sampleRoute(route,3.001);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.003);
 assert.equal(a.dy,0);assert.equal(b.dx,0);assert.equal(b.dy,1);
});

test('all three stages can still be escaped with continuous pursuit',()=>{
 const solutions=[[6,10,14],[6,10,9,13,14],[6,5,9,10,14]];
 for(let level=0;level<3;level++){
  const s=create(level);for(const i of solutions[level])assert.ok(slide(s,i));
  start(s);const m=createMotion(s);run(s,m,20000,{});
  assert.equal(s.status,'won');assert.equal(m.aDistance,6);
 }
});
