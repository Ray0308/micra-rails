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
export function canEdit(s,i){
 const tile=s.tiles[i];return ['ready','running'].includes(s.status)&&i>=0&&i<16&&i!==0&&i!==15&&i!==s.reserved&&!tile?.used.length;
}
export function swap(s,a,b){
 if(a===b||!canEdit(s,a)||!canEdit(s,b)||!s.tiles[a]||!s.tiles[b])return false;
 [s.tiles[a],s.tiles[b]]=[s.tiles[b],s.tiles[a]];s.moves++;return true;
}
export function rotateType(type){
 if(type==='cross')return type;
 const rotated=ports[type].map(d=>(d+1)%4);
 return Object.keys(ports).find(key=>key!=='cross'&&rotated.every(d=>ports[key].includes(d)));
}
export function rotate(s,i){
 if(!canEdit(s,i)||!s.tiles[i])return false;
 const type=rotateType(s.tiles[i].type);if(type===s.tiles[i].type)return false;
 s.tiles[i].type=type;s.moves++;return true;
}
function fillSupply(s){
 while(s.queue.length<8){
  const rng=seededRandom((s.seed^Math.imul(++s.queueDraws,0x45d9f3b))>>>0),types=Object.keys(ports);
  s.queue.push(types[Math.floor(rng()*types.length)]);
 }
}
export function place(s,i){
 if(!canEdit(s,i)||s.tiles[i]||!s.queue?.length)return false;
 s.tiles[i]={type:s.queue.shift(),used:[]};fillSupply(s);s.moves++;return true;
}
export function removePlaced(s,i){
 if(!canEdit(s,i)||!s.tiles[i]||!s.queue||!s.placed?.has(i))return false;
 s.queue.unshift(s.tiles[i].type);s.tiles[i]=null;s.placed.delete(i);s.moves++;return true;
}
export function build(s,i){
 if(!place(s,i))return false;
 s.placed.add(i);return true;
}
function worldOperation(s,action){
 if(s.world&&({grass:'swap',mine:'rotate',nether:'place',end:'slide'})[s.world]!==action.kind)return false;
 if(action.kind==='swap')return swap(s,action.a,action.b);
 if(action.kind==='rotate')return rotate(s,action.index);
 if(action.kind==='place')return build(s,action.index);
 return slide(s,action.index);
}
function worldState(puzzle,level,world,seed){
 const state=stateFromTypes(puzzle.types,level);state.world=world;state.seed=seed>>>0;
 if(world==='nether'){
  state.queue=[...puzzle.queue];state.queueDraws=0;state.placed=new Set();fillSupply(state);
 }
 return state;
}
function certifyWorld(puzzle,world,seed){
 const state=worldState(puzzle,0,world,seed);start(state);
 for(const action of puzzle.solution)if(!worldOperation(state,action))return false;
 for(let i=0;i<32&&state.status==='running';i++)if(!advance(state))break;
 return state.status==='won';
}
export function generateWorldPuzzle(world,seed){
 if(world==='end'){
  const puzzle=generatePuzzle(seed);return {...puzzle,solution:puzzle.solution.map(index=>({kind:'slide',index}))};
 }
 const salt={grass:0x4a371b29,mine:0x1ba92f35,nether:0x7246d01f}[world];
 if(salt===undefined)throw Error('Unknown world');
 const rng=seededRandom(seed^salt),typesList=Object.keys(ports);
 for(let attempt=0;attempt<64;attempt++){
  const path=randomPath(rng),solved=solvedTypes(path,rng);
  const protectedTiles=new Set([...path.slice(0,3),15]);
  let puzzle;
  if(world==='nether'){
   const types=Array(16).fill(null);for(const i of protectedTiles)types[i]=solved[i];
   puzzle={types,path,queue:path.slice(3,-1).map(i=>solved[i]),solution:path.slice(3,-1).map(index=>({kind:'place',index}))};
  }else{
   const types=solved.map(type=>type||typesList[Math.floor(rng()*typesList.length)]),state=stateFromTypes(types),undo=[];
   const editable=Array.from({length:16},(_,i)=>i).filter(i=>!protectedTiles.has(i));
   if(world==='grass'){
    for(let i=0;i<4;i++){
     const pair=shuffled(editable,rng).slice(0,2);
     if(state.tiles[pair[0]].type===state.tiles[pair[1]].type)continue;
     if(swap(state,...pair))undo.push({kind:'swap',a:pair[0],b:pair[1]});
    }
   }else{
    // Three changed cells need at most nine taps to restore, within the safe lead-in.
    const candidates=shuffled(editable.filter(i=>state.tiles[i].type!=='cross'),rng).slice(0,3);
    for(const index of candidates){
     const original=state.tiles[index].type;rotate(state,index);
     let type=state.tiles[index].type;
     do{undo.push({kind:'rotate',index});type=rotateType(type)}while(type!==original);
    }
   }
   puzzle={types:state.tiles.map(t=>t.type),path,solution:world==='grass'?undo.reverse():undo};
  }
  if(puzzle.solution.length&&!(world!=='nether'&&automaticallyWins(puzzle.types))&&certifyWorld(puzzle,world,seed))return {...puzzle,seed:seed>>>0};
 }
 const path=[0,1,2,3,7,11,15],types=solvedTypes(path,rng).map(type=>type||'h');
 types[6]='h';
 if(world==='grass'){[types[3],types[6]]=[types[6],types[3]];return {seed:seed>>>0,types,path,solution:[{kind:'swap',a:3,b:6}],fallback:true}}
 if(world==='mine'){types[3]=rotateType(types[3]);return {seed:seed>>>0,types,path,solution:Array.from({length:3},()=>({kind:'rotate',index:3})),fallback:true}}
 throw Error('Unable to generate placement puzzle');
}
export function applyWorldAction(s,action){return worldOperation(s,action)}
export function create(level=0,{seed=Math.floor(Math.random()*4294967296),world='end'}={}){
 return worldState(generateWorldPuzzle(world,seed),level,world,seed);
}
