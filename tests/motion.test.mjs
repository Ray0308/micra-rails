import {fixedBoard as create} from './fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {slide,start} from '../engine.mjs';
import {createMotion,updateMotion,sampleRoute,CREEPER_FUSE_MS,CREEPER_STEP_MS} from '../motion.mjs';

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
 run(s,m,6000,{});assert.equal(s.status,'lost');assert.ok(m.fuse>=CREEPER_FUSE_MS);
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

function caughtAtBlockedRail(){
 const s=create();start(s);s.a=1;s.entry=3;s.tiles[1].used=['h'];
 const m=createMotion(s);m.route=[0,1];m.aDistance=1;m.bDistance=1;m.elapsed=10000;
 return [s,m];
}

test('contact gives exactly three seconds before exploding',()=>{
 const [s,m]=caughtAtBlockedRail();
 updateMotion(s,m,2990,{delay:0});assert.equal(s.status,'running');assert.equal(m.fuse,2990);assert.equal(m.movingB,false);
 updateMotion(s,m,10,{delay:0});assert.equal(s.status,'lost');assert.equal(m.fuse,3000);
});

test('an ignited Creeper stands still and cancels ignition after the cart escapes',()=>{
 const [s,m]=caughtAtBlockedRail();m.fuse=1000;assert.ok(slide(s,6));
 run(s,m,500,{delay:0,aInterval:1900,bInterval:CREEPER_STEP_MS});assert.equal(m.bDistance,1);assert.equal(m.movingB,false);assert.ok(m.fuse>1000);
 run(s,m,1100,{delay:0,aInterval:1900,bInterval:CREEPER_STEP_MS});assert.equal(s.status,'running');assert.equal(m.fuse,0);assert.ok(m.bDistance>1,'pursuit must restart after cancellation');
});

test('Creeper moves at 75 percent of its original walking speed',()=>{
 const [s,m]=caughtAtBlockedRail();m.bDistance=0;
 run(s,m,850,{delay:0,bInterval:CREEPER_STEP_MS});assert.ok(Math.abs(m.bDistance-.375)<.001);assert.equal(m.fuse,0);
});

test('cart brake freezes position and tile locking, permits rail slides, and resumes without jumping',()=>{
 const [s,m]=ready(true);run(s,m,650);const position=m.aDistance,progress=m.segment.progress,used=s.tiles[1].used.length;
 m.cartStopped=true;run(s,m,2000);assert.equal(m.aDistance,position);assert.equal(m.segment.progress,progress);assert.equal(s.tiles[1].used.length,used);assert.equal(m.movingA,false);
 assert.ok(slide(s,10),'unlocked rails remain editable while only the cart is stopped');
 m.cartStopped=false;run(s,m,130);assert.ok(m.aDistance>position&&m.aDistance<position+.06,'braking time must not turn into a jump');
});

test('brake before the first movement does not reserve or lock the next panel',()=>{
 const [s,m]=ready();m.cartStopped=true;run(s,m,1000);
 assert.equal(m.aDistance,0);assert.equal(m.segment,null);assert.equal(s.reserved,undefined);assert.equal(s.tiles[1].used.length,0);assert.ok(slide(s,1));
});

test('the Creeper keeps walking and can ignite and explode while the cart brake is held',()=>{
 const [s,m]=caughtAtBlockedRail();m.bDistance=0;m.cartStopped=true;
 run(s,m,850,{delay:0,bInterval:CREEPER_STEP_MS});assert.equal(m.aDistance,1);assert.ok(m.bDistance>.374&&m.bDistance<.376);assert.equal(m.movingB,true);
 run(s,m,5000,{delay:0,bInterval:CREEPER_STEP_MS});assert.equal(s.status,'lost');assert.equal(m.aDistance,1);assert.ok(m.fuse>=3000);
});

test('connected boundaries and corners never put the running cart into a waiting state',()=>{
 const [s,m]=ready(true);let previous=0;
 for(let frame=0;frame<960&&s.status==='running';frame++){
  updateMotion(s,m,16,{delay:1e9,aInterval:2400});
  assert.ok(m.aDistance>previous,'connected rail must advance every frame');
  if(s.status==='running')assert.equal(m.movingA,true);
  previous=m.aDistance;
 }
 assert.equal(s.status,'won');
});
