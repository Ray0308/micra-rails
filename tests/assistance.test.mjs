import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSISTANCE_KEY,assistanceProfile,createAssistanceStore} from '../assistance.mjs';
import {generateWorldPuzzle,generateAssistedPuzzle,create,start,advance,applyWorldAction} from '../engine.mjs';
import {createMotion,updateMotion} from '../motion.mjs';
import {WORLDS} from '../worlds.mjs';
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}};
test('speed gradually eases and board assistance increases every two losses, with caps',()=>{
 for(let failures=0;failures<12;failures++){
  const p=assistanceProfile(failures);assert.ok(Math.abs(p.creeperSpeed-Math.max(.8,1-.05*failures))<1e-9);assert.equal(p.boardHelp,Math.min(3,Math.floor(failures/2)));
 }
 assert.deepEqual(assistanceProfile(NaN),assistanceProfile(0));
});
test('losses persist, duplicate reports do not count twice, worlds are independent and a clear resets them',()=>{
 const storage=memory(),store=createAssistanceStore(storage);
 assert.ok(store.recordLoss(7,'grass','run-a'));assert.equal(store.recordLoss(7,'grass','run-a'),false);
 assert.ok(store.recordLoss(7,'grass','run-b'));assert.equal(store.profile(7,'grass').boardHelp,1);assert.equal(store.profile(7,'end').failures,0);
 const restored=createAssistanceStore(storage);assert.equal(restored.profile(7,'grass').failures,2);
 assert.equal(restored.profile(8,'grass').failures,0);assert.equal(restored.recordLoss(7,'grass','stale'),false);
 assert.deepEqual(JSON.parse(storage.getItem(ASSISTANCE_KEY)).failures,{});
});
test('corrupt saves and unavailable storage do not break play',()=>{
 const storage=memory();storage.setItem(ASSISTANCE_KEY,JSON.stringify({level:0,failures:{grass:-1,end:999,mine:'6'}}));
 const store=createAssistanceStore(storage);assert.equal(store.profile(0,'grass').failures,0);assert.equal(store.profile(0,'end').failures,6);assert.equal(store.profile(0,'mine').failures,0);
 const denied=createAssistanceStore({getItem(){throw Error()},setItem(){throw Error()}});assert.ok(denied.recordLoss(0,'end','x'));
});
test('1200 assisted boards remain solvable in motion and require at least one player operation',()=>{
 for(const [world,config] of Object.entries(WORLDS))for(let seed=0;seed<100;seed++){
  assert.deepEqual(generateAssistedPuzzle(world,seed,0),generateWorldPuzzle(world,seed));
  for(let help=1;help<=3;help++){
   const puzzle=generateAssistedPuzzle(world,seed,help),s=create(0,{seed,world,boardHelp:help});
   assert.ok(puzzle.solution.length>0);assert.equal(s.moves,0);
   const idle=create(0,{seed,world,boardHelp:help});start(idle);for(let n=0;n<32&&idle.status==='running';n++)if(!advance(idle))break;
   assert.notEqual(idle.status,'won',world+' must not be completed automatically');
   start(s);const m=createMotion(s),options={...config,creeperSpeedScale:.8};
   const run=ms=>{for(let left=ms;left>0&&s.status==='running';left-=Math.min(left,20))updateMotion(s,m,Math.min(left,20),options)};
   for(const action of puzzle.solution){run(250);assert.ok(applyWorldAction(s,action),`${world}/${seed}/${help}`)}
   run(30000);assert.equal(s.status,'won',`${world}/${seed}/${help}`);
  }
 }
});
test('adaptive speed changes only Creeper travel, not cart movement or fuse duration',()=>{
 const states=[1,.8].map(creeperSpeedScale=>{const s=create(0,{seed:19,world:'end'});start(s);const m=createMotion(s);for(let n=0;n<400;n++)updateMotion(s,m,20,{delay:0,creeperSpeedScale,fuseMs:3000});return {s,m}});
 assert.equal(states[0].m.aDistance,states[1].m.aDistance);assert.ok(states[1].m.bDistance<=states[0].m.bDistance);
});
