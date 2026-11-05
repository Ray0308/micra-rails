import {CHARACTERS,BY_ID,SAVE_KEY,BREAK_HITS} from './catalog-data.mjs?v=0.1.6';
const normal=CHARACTERS.filter(c=>c.category!=='bosses');
const bosses=CHARACTERS.filter(c=>c.category==='bosses');
const positive=n=>Number.isSafeInteger(n)&&n>0;
const freshState=()=>({counts:{steve:1},shiny:{},draws:0,duplicates:0,reward:null,lastRun:null});

export function cleanCollection(input){
 const clean=freshState();
 if(!input||typeof input!=='object')return clean;
 clean.counts={};
 for(const c of CHARACTERS){
  const n=input.counts?.[c.id],s=input.shiny?.[c.id];
  if(positive(n))clean.counts[c.id]=Math.min(n,999999);
  if(positive(s)&&clean.counts[c.id])clean.shiny[c.id]=Math.min(s,clean.counts[c.id]);
 }
 if(!Object.keys(clean.counts).length)clean.counts.steve=1;
 clean.draws=Number.isSafeInteger(input.draws)&&input.draws>=0?input.draws:0;
 clean.duplicates=Number.isInteger(input.duplicates)?Math.max(0,Math.min(2,input.duplicates)):0;
 clean.lastRun=typeof input.lastRun==='string'?input.lastRun:null;
 const r=input.reward;
 if(r&&typeof r.id==='string'&&Object.hasOwn(BY_ID,r.id)&&typeof r.runId==='string'&&typeof r.shiny==='boolean'&&Number.isInteger(r.level)&&r.level>=0&&r.level<3){
  if(r.phase==='mining'&&Number.isInteger(r.hits)&&r.hits>=0&&r.hits<BREAK_HITS){
   clean.reward={id:r.id,runId:r.runId,shiny:r.shiny,level:r.level,phase:'mining',hits:r.hits};
  }else if(r.phase==='revealed'&&clean.counts[r.id]&&(!r.shiny||clean.shiny[r.id])){
   clean.reward={id:r.id,runId:r.runId,shiny:r.shiny,level:r.level,phase:'revealed',hits:BREAK_HITS,fresh:Boolean(r.fresh),firstShiny:Boolean(r.firstShiny),count:clean.counts[r.id]};
  }
 }
 if(clean.reward)clean.lastRun=clean.reward.runId;
 return clean;
}

// Adapted from kyoryu-island-play: early discoveries, duplicate protection, bosses, shiny variants.
export function rollCard(state,rng=Math.random){
 const missing=normal.filter(c=>!state.counts[c.id]);
 const found=normal.filter(c=>state.counts[c.id]);
 const missingBosses=bosses.filter(c=>!state.counts[c.id]);
 let pool;
 if(found.length>=10&&missingBosses.length===bosses.length)pool=missingBosses;
 else if(missing.length&&(state.draws<3||state.duplicates>=2))pool=missing;
 else if(rng()<.02)pool=bosses;
 else pool=missing.length&&(!found.length||rng()<.7)?missing:found;
 if(!pool.length)pool=normal;
 const chosen=pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];
 return {id:chosen.id,shiny:rng()<.05};
}

export function createCollectionStore(storage,rng=Math.random){
 let state=freshState(),saveError=false;
 try{const raw=storage?.getItem(SAVE_KEY);if(raw)state=cleanCollection(JSON.parse(raw))}catch{}
 function persist(){
  try{if(!storage)throw Error('Storage unavailable');storage.setItem(SAVE_KEY,JSON.stringify(state));saveError=false}catch{saveError=true}
 }
 return {
  get state(){return state},get saveError(){return saveError},
  beginReward(runId,level){
   if(state.reward)return state.reward;
   if(state.lastRun===runId)return null;
   if(typeof runId!=='string'||!Number.isInteger(level)||level<0||level>=3)throw Error('Invalid reward context');
   state.reward={...rollCard(state,rng),runId,level,hits:0,phase:'mining'};
   state.lastRun=runId;persist();return state.reward;
  },
  tapBlock(){
   const r=state.reward;
   if(!r||r.phase==='revealed')return r;
   r.hits++;
   if(r.hits>=BREAK_HITS){
    r.fresh=!state.counts[r.id];r.firstShiny=r.shiny&&!state.shiny[r.id];
    state.counts[r.id]=Math.min(999999,(state.counts[r.id]||0)+1);
    if(r.shiny)state.shiny[r.id]=Math.min(state.counts[r.id],(state.shiny[r.id]||0)+1);
    state.draws++;state.duplicates=r.fresh?0:Math.min(2,state.duplicates+1);
    r.phase='revealed';r.count=state.counts[r.id];
   }
   persist();return r;
  },
  acknowledge(){
   if(state.reward?.phase!=='revealed')return false;
   state.reward=null;persist();return true;
  },
 };
}
