import test from 'node:test';
import assert from 'node:assert/strict';
import {create,generateWorldPuzzle,applyWorldAction,start,swap,rotate,build,removePlaced,canEdit,hasShortMineRoute} from '../engine.mjs';
import {createMotion,updateMotion} from '../motion.mjs';
import {WORLDS,WORLD_KEY,loadWorld,saveWorld} from '../worlds.mjs';
import {CHARACTERS} from '../catalog-data.mjs';
import {rollCard,createCollectionStore} from '../catalog-model.mjs';
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}};
function run(s,m,ms,options){for(let t=0;t<ms&&s.status==='running';t+=20)updateMotion(s,m,Math.min(20,ms-t),options)}

test('400 random puzzles across four worlds can be repaired after departure and escaped',()=>{
 for(const [world,config] of Object.entries(WORLDS))for(let seed=0;seed<100;seed++){
  const puzzle=generateWorldPuzzle(world,seed),s=create(12,{seed,world});start(s);const m=createMotion(s);
  for(const action of puzzle.solution){run(s,m,250,config);assert.ok(applyWorldAction(s,action),`${world} seed ${seed} ${JSON.stringify(action)}`)}
  run(s,m,30000,config);assert.equal(s.status,'won',`${world} seed ${seed}`);
 }
});

test('world operations reject the wrong kind and preserve passed/reserved rail locks',()=>{
 for(const world of Object.keys(WORLDS)){
  const s=create(0,{seed:12,world});start(s);
  assert.equal(swap(s,0,2),false);assert.equal(rotate(s,0),false);assert.equal(canEdit(s,15),false);
  const wrong=world==='mine'?{kind:'swap',a:4,b:8}:{kind:'rotate',index:4};
  assert.equal(applyWorldAction(s,wrong),false);
 }
});

test('Nether placement consumes the next part and undo puts that part back',()=>{
 const p=generateWorldPuzzle('nether',9),s=create(0,{seed:9,world:'nether'});start(s);
 const index=p.solution[0].index,type=s.queue[0];assert.ok(build(s,index));assert.equal(s.tiles[index].type,type);assert.notEqual(s.queue.length,0);
 assert.ok(removePlaced(s,index));assert.equal(s.tiles[index],null);assert.equal(s.queue[0],type);assert.equal(removePlaced(s,0),false);
});

test('grass braking freezes the pursuit, spawn clock, and ignition while rails remain editable',()=>{
 const p=generateWorldPuzzle('grass',10),s=create(0,{seed:10,world:'grass'});start(s);const m=createMotion(s);m.cartStopped=true;m.fuse=900;m.elapsed=1000;
 run(s,m,20000,WORLDS.grass);assert.equal(m.elapsed,1000);assert.equal(m.fuse,900);assert.equal(m.bDistance,null);assert.equal(m.aDistance,0);
 assert.ok(applyWorldAction(s,p.solution[0]));
});

test('world choice persists and invalid saved IDs fall back to grass',()=>{
 const storage=memory();assert.equal(loadWorld(storage),'grass');assert.ok(saveWorld(storage,'nether'));assert.equal(loadWorld(storage),'nether');
 storage.setItem(WORLD_KEY,JSON.stringify({id:'constructor'}));assert.equal(loadWorld(storage),'grass');
});

const allFound={counts:Object.fromEntries(CHARACTERS.map(c=>[c.id,2])),shiny:{},draws:20,duplicates:0};
const sequence=values=>{let i=0;return ()=>values[i++]??.99};
test('worlds apply their actual shiny and boss probabilities to card draws',()=>{
 for(const [world,config] of Object.entries(WORLDS)){
  const card=rollCard(allFound,sequence([.5,.5,.1]),world);assert.equal(card.shiny,.1<config.shinyRate,world);
  const encounter=rollCard(allFound,sequence([.03,.5,.99]),world),isBoss=CHARACTERS.find(c=>c.id===encounter.id).category==='bosses';assert.equal(isBoss,.03<config.bossRate,world);
 }
});

test('End pickup weighting makes Endermen more likely while keeping ordinary characters available',()=>{
 const counts={};
 for(let i=0;i<1000;i++){const card=rollCard(allFound,sequence([.5,(i+.5)/1000,.99]),'end');counts[card.id]=(counts[card.id]||0)+1}
 assert.ok(counts.enderman>=counts.creeper*3);assert.ok(counts.pig>0&&counts.cat>0&&counts.skeleton>0);
});

test('pending rewards retain their world and an old save without a world still resumes',()=>{
 const storage=memory(),s=createCollectionStore(storage,()=>.5);s.beginReward('nether-win',23,'nether');s.tapBlock();
 const restored=createCollectionStore(storage);assert.equal(restored.state.reward.world,'nether');assert.equal(restored.state.reward.hits,1);
});

test('expert mine and other tiers require repairs on the route',()=>{
 assert.deepEqual(Object.values(WORLDS).map(w=>w.difficulty),[1,'EX',3,4]);
 for(let seed=0;seed<100;seed++)for(const world of ['grass','mine','nether']){
  const puzzle=generateWorldPuzzle(world,seed),s=create(0,{seed,world});start(s);
  for(const action of puzzle.solution)assert.ok(applyWorldAction(s,action));
  assert.ok(puzzle.path.length-1>=(world==='grass'?8:10));
  if(world==='nether'){
   const offRoute=puzzle.solution.filter(a=>!puzzle.path.includes(a.index));assert.equal(offRoute.length,2);
   assert.equal(puzzle.solution.length,puzzle.path.length-4+2);
  }else{
   const mismatches=puzzle.path.slice(world==='mine'?2:3,-1).filter(i=>puzzle.types[i]!==s.tiles[i].type).length;
   assert.ok(mismatches>=(world==='grass'?3:10),world+' must require route repairs');
  }
 }
});


test('expert mine uses long routes and rejects shortcuts reachable by rotating the tiles',()=>{
 for(let seed=0;seed<500;seed++){
  const p=generateWorldPuzzle('mine',seed);
  assert.ok([12,14].includes(p.path.length-1));
  assert.ok(new Set(p.solution.map(a=>a.index)).size>=10);
  assert.equal(p.types.includes('cross'),false);
  assert.equal(hasShortMineRoute(p.types,p.path[1],10),false);
 }
 const simple=Array(16).fill('h');simple[3]='sw';simple[7]=simple[11]=simple[15]='v';
 assert.equal(hasShortMineRoute(simple,1,6),true);assert.equal(hasShortMineRoute(simple,1,4),false);
});
