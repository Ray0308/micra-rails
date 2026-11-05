export const JOURNEY_KEY='micra-rails.journey.v1';
const validLevel=n=>Number.isSafeInteger(n)&&n>=0&&n<Number.MAX_SAFE_INTEGER;
export const stageName=level=>'坑道 '+String(level+1).padStart(2,'0');
export function createJourneyStore(storage,rng=Math.random){
 const seed=()=>Math.floor(rng()*4294967296)>>>0;
 let current={level:0,seed:seed()};
 try{
  const saved=JSON.parse(storage?.getItem(JOURNEY_KEY)||'null');
  if(saved&&validLevel(saved.level)&&Number.isInteger(saved.seed)&&saved.seed>=0&&saved.seed<=4294967295)current={level:saved.level,seed:saved.seed};
 }catch{}
 function save(){try{storage?.setItem(JOURNEY_KEY,JSON.stringify(current))}catch{}}
 save();
 return {
  get state(){return {...current}},
  complete(clearedLevel){
   if(!validLevel(clearedLevel)||clearedLevel<current.level)return false;
   const rolled=seed();
   current={level:clearedLevel+1,seed:rolled===current.seed?(rolled+0x9E3779B9)>>>0:rolled};save();return true;
  },
 };
}
