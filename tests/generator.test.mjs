import test from 'node:test';
import assert from 'node:assert/strict';
import {create,generatePuzzle,slide,start,advance} from '../engine.mjs';
import {createMotion,updateMotion} from '../motion.mjs';
const signature=state=>state.tiles.map(t=>t?.type??'-').join(',');
function run(state,m,time){for(let elapsed=0;elapsed<time&&state.status==='running';elapsed+=20)updateMotion(state,m,Math.min(20,time-elapsed),{aInterval:1900,bInterval:1500})}

test('500 seeded boards are solvable after departure with ordinary 250ms slide timing',()=>{
 const layouts=new Set(),routes=new Set();let fallbacks=0;
 for(let seed=0;seed<500;seed++){
  const puzzle=generatePuzzle(seed),state=create(100,{seed});
  assert.equal(state.tiles.filter(t=>t===null).length,1);assert.equal(state.moves,0);
  layouts.add(signature(state));routes.add(puzzle.path.join(','));fallbacks+=Number(puzzle.fallback);
  const withoutMoves=create(0,{seed});start(withoutMoves);
  for(let i=0;i<32&&withoutMoves.status==='running';i++)if(!advance(withoutMoves))break;
  assert.notEqual(withoutMoves.status,'won','board must require a repair');
  start(state);const m=createMotion(state);
  for(const index of puzzle.solution){run(state,m,250);assert.ok(slide(state,index),`seed ${seed}, move ${index}`)}
  run(state,m,26000);assert.equal(state.status,'won',`seed ${seed}`);
 }
 assert.ok(layouts.size>450,`only ${layouts.size} distinct boards`);
 assert.ok(routes.size>25,`only ${routes.size} distinct routes`);
 console.log(`Validated ${layouts.size} layouts, ${routes.size} routes, ${fallbacks} bounded fallbacks`);
});

test('same seed restores the same puzzle on retry regardless of the stage number',()=>{
 assert.equal(signature(create(0,{seed:1234567})),signature(create(99,{seed:1234567})));
 assert.notEqual(signature(create(0,{seed:1234567})),signature(create(0,{seed:1234568})));
});
