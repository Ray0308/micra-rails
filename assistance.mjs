export const ASSISTANCE_KEY='micra-rails.assistance.v1';
const worlds=['grass','mine','nether','end'];
const validLevel=n=>Number.isSafeInteger(n)&&n>=0;
export function assistanceProfile(failures=0){
 const count=Number.isSafeInteger(failures)?Math.max(0,Math.min(6,failures)):0;
 return {failures:count,boardHelp:Math.min(3,Math.floor(count/2)),creeperSpeed:1-.05*Math.min(4,count)};
}
export function createAssistanceStore(storage){
 let state={level:0,failures:{},lastLoss:null};
 try{
  const saved=JSON.parse(storage?.getItem(ASSISTANCE_KEY)||'null');
  if(saved&&validLevel(saved.level)){
   state.level=saved.level;
   for(const world of worlds)if(Number.isSafeInteger(saved.failures?.[world])&&saved.failures[world]>=0)state.failures[world]=Math.min(6,saved.failures[world]);
   if(typeof saved.lastLoss==='string')state.lastLoss=saved.lastLoss;
  }
 }catch{}
 const save=()=>{try{storage?.setItem(ASSISTANCE_KEY,JSON.stringify(state))}catch{}};
 function align(level){if(validLevel(level)&&state.level!==level){state={level,failures:{},lastLoss:null};save()}}
 return {
  profile(level,world){align(level);return assistanceProfile(worlds.includes(world)?state.failures[world]||0:0)},
  recordLoss(level,world,runId){
   if(!validLevel(level)||level<state.level||!worlds.includes(world)||typeof runId!=='string'||!runId)return false;
   align(level);if(state.lastLoss===runId)return false;
   state.failures[world]=Math.min(6,(state.failures[world]||0)+1);state.lastLoss=runId;save();return true;
  },
 };
}
