export const N=4;
export const ports={h:[1,3],v:[0,2],ne:[0,1],es:[1,2],sw:[2,3],wn:[3,0],cross:[0,1,2,3]};
export function neighbor(i,d){const r=Math.floor(i/N),c=i%N;return d===0?(r?i-N:-1):d===1?(c<N-1?i+1:-1):d===2?(r<N-1?i+N:-1):(c?i-1:-1)}
export function create(level=0){
 const types=['h','h','h','sw','es','cross','ne','v','wn','h','es','v','ne','h',null,'v'];
 const s={tiles:types.map(type=>type?{type,used:[]}:null),a:0,b:-1,entry:3,trail:[0],bStep:-1,status:'ready',moves:0,level};
 // Legal reverse slides preserve a solution. The first stage needs only one slide.
 const sequences=[[10,6,2],[13,9,10,6,2],[10,9,5,6,2]];
 for(const i of sequences[level%3]) slide(s,i);
 s.moves=0; return s;
}
export function slide(s,i){const gap=s.tiles.indexOf(null),t=s.tiles[i];if(!['ready','running'].includes(s.status)||!t||t.used.length||i===0||i===15||!ports.cross.some(d=>neighbor(gap,d)===i))return false;s.tiles[gap]=t;s.tiles[i]=null;s.moves++;return true}
export function start(s){if(s.status!=='ready')return;s.status='running';s.tiles[0].used.push('h')}
export function advance(s){if(s.status!=='running')return false;const t=s.tiles[s.a],p=ports[t.type];if(!p.includes(s.entry))return false;const out=t.type==='cross'?(s.entry+2)%4:p.find(d=>d!==s.entry);const j=neighbor(s.a,out),next=s.tiles[j],enter=(out+2)%4;if(j<0||!next||!ports[next.type].includes(enter))return false;const axis=enter%2?'h':'v';if(next.used.length&&(next.type!=='cross'||next.used.includes(axis)))return false;s.a=j;s.entry=enter;next.used.push(axis);s.trail.push(j);if(j===15)s.status='won';return true}
export function chase(s){if(s.status!=='running')return;s.bStep=Math.min(s.bStep+1,s.trail.length-1);s.b=s.trail[s.bStep]}
