export const N=4;
export const ports={h:[1,3],v:[0,2],ne:[0,1],es:[1,2],sw:[2,3],wn:[3,0],cross:[0,1,2,3]};
export function neighbor(i,d){const r=Math.floor(i/N),c=i%N;return d===0?(r?i-N:-1):d===1?(c<N-1?i+1:-1):d===2?(r<N-1?i+N:-1):(c?i-1:-1)}
function stateFromTypes(types,level=0){return {tiles:types.map(type=>type?{type,used:[]}:null),a:0,b:-1,entry:3,trail:[0],bStep:-1,status:'ready',moves:0,level}}
export function slide(s,i){const gap=s.tiles.indexOf(null),t=s.tiles[i];if(!['ready','running'].includes(s.status)||!t||t.used.length||i===0||i===15||i===s.reserved||!ports.cross.some(d=>neighbor(gap,d)===i))return false;s.tiles[gap]=t;s.tiles[i]=null;s.moves++;return true}
export function start(s){if(s.status!=='ready')return;s.status='running';s.tiles[0].used.push(s.tiles[0].type==='h'?'h':'v')}
export function nextStep(s){
 if(s.status!=='running')return null;
 const tile=s.tiles[s.a],p=ports[tile.type];
 if(!p.includes(s.entry))return null;
 const out=tile.type==='cross'?(s.entry+2)%4:p.find(d=>d!==s.entry);
 const index=neighbor(s.a,out),next=s.tiles[index],entry=(out+2)%4;
 if(index<0||!next||!ports[next.type].includes(entry))return null;
 const axis=entry%2?'h':'v';
 if(next.used.length&&(next.type!=='cross'||next.used.includes(axis)))return null;
 return {index,entry,axis};
}
export function advance(s){
 const step=nextStep(s);if(!step)return false;
 s.a=step.index;s.entry=step.entry;s.tiles[s.a].used.push(step.axis);s.trail.push(s.a);
 if(s.a===15)s.status='won';return true;
}
export function chase(s){if(s.status!=='running')return;s.bStep=Math.min(s.bStep+1,s.trail.length-1);s.b=s.trail[s.bStep]}

export function seededRandom(seed){
 let value=seed>>>0;
 return ()=>{value=(value+0x6D2B79F5)>>>0;let t=value;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296};
}
function shuffled(items,rng){const list=[...items];for(let i=list.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[list[i],list[j]]=[list[j],list[i]]}return list}
function randomPath(rng){
 const edges=6+2*Math.floor(rng()*3),path=[0],visited=new Set(path);
 function walk(cell){
  const remaining=edges-(path.length-1),distance=3-Math.floor(cell/4)+3-cell%4;
  if(remaining<distance||(remaining-distance)%2)return false;
  if(cell===15)return remaining===0;
  if(!remaining)return false;
  for(const d of shuffled([0,1,2,3],rng)){
   const next=neighbor(cell,d);if(next<0||visited.has(next))continue;
   visited.add(next);path.push(next);
   if(walk(next))return true;
   path.pop();visited.delete(next);
  }
  return false;
 }
 if(!walk(0))throw Error('No bounded rail route');return path;
}
function direction(from,to){return [0,1,2,3].find(d=>neighbor(from,d)===to)}
function solvedTypes(path,rng){
 const choices=Object.keys(ports),types=Array.from({length:16},()=>choices[Math.floor(rng()*choices.length)]);
 for(let i=0;i<path.length;i++){
  const cell=path[i],entry=i?direction(cell,path[i-1]):3;
  const exit=i<path.length-1?direction(cell,path[i+1]):(entry===0?2:1);
  const straight=(entry+2)%4===exit;
  types[cell]=straight&&i>0&&i<path.length-1&&rng()<.18?'cross':choices.find(key=>key!=='cross'&&ports[key].includes(entry)&&ports[key].includes(exit));
 }
 const offRoute=Array.from({length:16},(_,i)=>i).filter(i=>!path.includes(i));
 types[offRoute[Math.floor(rng()*offRoute.length)]]=null;
 return types;
}
function automaticallyWins(types){const proof=stateFromTypes(types);start(proof);for(let i=0;i<32&&proof.status==='running';i++)if(!advance(proof))break;return proof.status==='won'}
function certify(types,solution){
 const proof=stateFromTypes(types);start(proof);
 for(const index of solution)if(!slide(proof,index))return false;
 for(let i=0;i<32&&proof.status==='running';i++)if(!advance(proof))break;
 return proof.status==='won';
}
export function generatePuzzle(seed){
 const rng=seededRandom(seed);
 for(let attempt=0;attempt<64;attempt++){
  const path=randomPath(rng),solved=solvedTypes(path,rng),state=stateFromTypes(solved);
  // These tiles remain untouched while the player makes the first few slides.
  const protectedTiles=new Set([...path.slice(0,3),15]);
  const undo=[];let previousGap=-1;
  const count=5+Math.floor(rng()*4);
  for(let move=0;move<count;move++){
   const gap=state.tiles.indexOf(null);
   const candidates=[0,1,2,3].map(d=>neighbor(gap,d)).filter(i=>i>=0&&!protectedTiles.has(i)&&i!==previousGap);
   if(!candidates.length)break;
   const chosen=candidates[Math.floor(rng()*candidates.length)];
   if(!slide(state,chosen))throw Error('Illegal scramble move');
   undo.push(gap);previousGap=gap;
  }
  const types=state.tiles.map(tile=>tile?.type??null),solution=undo.reverse();
  if(solution.length>=3&&!automaticallyWins(types)&&certify(types,solution))return {seed:seed>>>0,types,path,solution,fallback:false};
 }
 // Bounded fallback: one legal repair, still with randomized non-route tiles.
 const path=[0,1,2,3,7,11,15],types=solvedTypes(path,rng);
 for(let i=0;i<16;i++)if(types[i]===null)types[i]='h';
 types[6]='v';types[7]=null;
 return {seed:seed>>>0,types,path,solution:[6],fallback:true};
}
export function create(level=0,{seed=Math.floor(Math.random()*4294967296)}={}){
 const puzzle=generatePuzzle(seed),state=stateFromTypes(puzzle.types,level);
 state.seed=seed>>>0;return state;
}
