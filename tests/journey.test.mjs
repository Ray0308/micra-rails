import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourneyStore,stageName,JOURNEY_KEY} from '../journey.mjs';
import {createCollectionStore} from '../catalog-model.mjs';
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}};

test('progress advances monotonically past stage three and is idempotent',()=>{
 const store=createJourneyStore(memory(),()=>.4);assert.equal(store.state.level,0);
 for(let i=0;i<8;i++){assert.ok(store.complete(i));const seed=store.state.seed;assert.equal(store.complete(i),false);assert.equal(store.state.seed,seed);assert.equal(store.state.level,i+1)}
 assert.equal(stageName(store.state.level),'坑道 09');assert.equal(stageName(99),'坑道 100');
});

test('reload preserves the stage and exact random board seed',()=>{
 const storage=memory(),first=createJourneyStore(storage,()=>.2);first.complete(0);first.complete(1);
 const next=createJourneyStore(storage,()=>.8);assert.deepEqual(next.state,first.state);assert.ok(storage.getItem(JOURNEY_KEY));
});

test('pending card rewards for high stage numbers survive reload and do not award twice',()=>{
 const storage=memory(),first=createCollectionStore(storage,()=>.5);first.beginReward('pit-78',77);first.tapBlock();
 const next=createCollectionStore(storage,()=>0);assert.equal(next.state.reward.level,77);assert.equal(next.state.reward.hits,1);
 for(let i=0;i<4;i++)next.tapBlock();const id=next.state.reward.id;
 const restored=createCollectionStore(storage);assert.equal(restored.state.reward.level,77);assert.equal(restored.state.counts[id],1);
});

test('a persisted pending reward can recover progression without skipping twice',()=>{
 const storage=memory(),store=createJourneyStore(storage);assert.ok(store.complete(2));assert.equal(store.state.level,3);
 const restored=createJourneyStore(storage);assert.equal(restored.complete(2),false);assert.equal(restored.state.level,3);
});
