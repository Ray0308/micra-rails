import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollectionStore,cleanCollection,rollCard,REVIEW_BACKUP_KEY} from '../catalog-model.mjs';
import {SAVE_KEY,CHARACTERS,BREAK_HITS} from '../catalog-data.mjs';
function memory(initial){const data=new Map(initial?[[SAVE_KEY,JSON.stringify(initial)]]:[]);return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}}

test('card is awarded only after the block breaks, once despite repeated taps',()=>{
 const storage=memory(),store=createCollectionStore(storage,()=>.5);
 const reward=store.beginReward('run-1',0),id=reward.id;
 for(let i=1;i<BREAK_HITS;i++){store.tapBlock();assert.equal(store.state.counts[id],undefined);assert.equal(store.state.draws,0)}
 store.tapBlock();assert.equal(store.state.counts[id],1);assert.equal(store.state.draws,1);assert.equal(store.state.reward.phase,'revealed');
 for(let i=0;i<20;i++)store.tapBlock();
 assert.equal(store.state.counts[id],1);assert.equal(store.state.draws,1);
 assert.ok(store.acknowledge());assert.equal(store.beginReward('run-1',0),null);
});

test('reload preserves the same card and crack stage without rerolling',()=>{
 const storage=memory(),first=createCollectionStore(storage,()=>.5);first.beginReward('run-2',1);first.tapBlock();first.tapBlock();
 const id=first.state.reward.id,again=createCollectionStore(storage,()=>0);
 assert.equal(again.state.reward.id,id);assert.equal(again.state.reward.hits,2);assert.equal(again.state.reward.level,1);
 assert.equal(again.beginReward('another-run',2).id,id);
 for(let i=0;i<3;i++)again.tapBlock();
 const restored=createCollectionStore(storage,()=>0);assert.equal(restored.state.reward.phase,'revealed');assert.equal(restored.state.counts[id],1);
 restored.tapBlock();assert.equal(restored.state.counts[id],1);
});

test('early rewards and duplicate protection choose undiscovered ordinary characters',()=>{
 const state=cleanCollection({counts:{steve:1},draws:0});
 for(let i=0;i<3;i++){
  const card=rollCard(state,()=>.99);assert.equal(state.counts[card.id],undefined);assert.notEqual(CHARACTERS.find(c=>c.id===card.id).category,'bosses');state.counts[card.id]=1;state.draws++;
 }
 state.draws=10;state.duplicates=2;
 const card=rollCard(state,()=>0);assert.equal(state.counts[card.id],undefined);assert.notEqual(CHARACTERS.find(c=>c.id===card.id).category,'bosses');
});

test('ten ordinary discoveries unlock a first boss reward',()=>{
 const entries=CHARACTERS.filter(c=>c.category!=='bosses').slice(0,10);
 const state=cleanCollection({counts:Object.fromEntries(entries.map(c=>[c.id,1])),draws:12});
 const card=rollCard(state,()=>.5);assert.equal(CHARACTERS.find(c=>c.id===card.id).category,'bosses');
});

test('shiny counts and total counts are committed together and survive reload',()=>{
 const storage=memory(),store=createCollectionStore(storage,()=>0);const reward=store.beginReward('shiny',2);assert.equal(reward.shiny,true);
 for(let i=0;i<BREAK_HITS;i++)store.tapBlock();
 const next=createCollectionStore(storage);assert.equal(next.state.shiny[reward.id],1);assert.equal(next.state.counts[reward.id],1);assert.equal(next.state.reward.firstShiny,true);
});

test('corrupt or obsolete save fields cannot unlock unknown cards or invalid pending rewards',()=>{
 const clean=cleanCollection({counts:{steve:2,unknown:999,alex:-1},shiny:{steve:9,unknown:9},reward:{id:'unknown',phase:'mining',hits:2},duplicates:100});
 assert.deepEqual(clean.counts,{steve:2});assert.deepEqual(clean.shiny,{steve:2});assert.equal(clean.reward,null);assert.equal(clean.duplicates,2);
});

test('unavailable storage leaves the mining reward playable in memory',()=>{
 const store=createCollectionStore({getItem(){throw Error('denied')},setItem(){throw Error('full')}},()=>.5);
 store.beginReward('private-mode',0);for(let i=0;i<BREAK_HITS;i++)store.tapBlock();
 assert.equal(store.state.draws,1);assert.equal(store.saveError,true);
});


test('review unlock grants every normal/shiny card once and preserves existing counts',()=>{
 const storage=memory({counts:{steve:1,alex:6,pig:2},shiny:{alex:2,pig:2},draws:8,duplicates:1});
 const store=createCollectionStore(storage);assert.ok(store.unlockForReview());
 for(const c of CHARACTERS){assert.ok(store.state.shiny[c.id]>=1);assert.ok(store.state.counts[c.id]>store.state.shiny[c.id])}
 assert.equal(store.state.counts.alex,6);assert.equal(store.state.shiny.alex,2);assert.equal(store.state.counts.pig,3);assert.equal(store.state.shiny.pig,2);assert.equal(store.state.draws,8);
 const before=JSON.stringify(store.state);assert.equal(store.unlockForReview(),false);assert.equal(JSON.stringify(store.state),before);
 const restored=createCollectionStore(storage);assert.equal(restored.unlockForReview(),false);assert.deepEqual(restored.state,JSON.parse(before));
 const backup=JSON.parse(storage.getItem(REVIEW_BACKUP_KEY));assert.deepEqual(backup.counts,{steve:1,alex:6,pig:2});assert.equal(backup.draws,8);
});

test('review unlock keeps an unclaimed mining reward at the same crack stage',()=>{
 const storage=memory(),store=createCollectionStore(storage,()=>.5);store.beginReward('review-pending',7);store.tapBlock();store.tapBlock();const id=store.state.reward.id;
 store.unlockForReview();assert.equal(store.state.reward.hits,2);assert.equal(store.state.reward.level,7);assert.equal(store.state.draws,0);
 const count=store.state.counts[id];for(let i=0;i<3;i++)store.tapBlock();assert.equal(store.state.counts[id],count+1);assert.equal(store.state.draws,1);
});
