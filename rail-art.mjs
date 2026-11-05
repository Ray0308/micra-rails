export const RAIL_SPRITES={v:['straight',0],h:['straight',90],es:['curve',0],sw:['curve',90],wn:['curve',180],ne:['curve',270],cross:['cross',0]};
const normalize=a=>a.map(n=>n/1254);
// Measured metal edges in each supplied-style sprite. Image strips map to the
// same 38–42% and 58–62% bands so adjacent tiles share exact exit widths.
export const SPRITE_BANDS={
 straight:{x:normalize([0,471,536,719,784,1254]),y:[0,1]},
 curve:{x:normalize([0,409,498,707,796,1254]),y:normalize([0,476,561,768,849,1254])},
 cross:{x:normalize([0,466,529,726,787,1254]),y:normalize([0,490,554,700,762,1254])},
};
const target=[0,.38,.42,.58,.62,1],cache=new Map();
export function railArtwork(type){
 if(cache.has(type))return cache.get(type);
 const [kind,angle]=RAIL_SPRITES[type],source=SPRITE_BANDS[kind],x=target,y=source.y.length===2?[0,1]:target,pieces=[];
 for(let row=0;row<y.length-1;row++)for(let col=0;col<x.length-1;col++){
  const sx=source.x[col],sy=source.y[row],sw=source.x[col+1]-sx,sh=source.y[row+1]-sy;
  const px=sw===1?0:sx/(1-sw)*100,py=sh===1?0:sy/(1-sh)*100;
  pieces.push(`<span class="rail-slice" style="left:${x[col]*100}%;top:${y[row]*100}%;width:${(x[col+1]-x[col])*100}%;height:${(y[row+1]-y[row])*100}%;background-image:url(assets/rail-${kind}-v044.png);background-size:${100/sw}% ${100/sh}%;background-position:${px}% ${py}%"></span>`);
 }
 const html=`<span class="rail-art" aria-hidden="true" style="transform:rotate(${angle}deg)">${pieces.join('')}</span>`;
 cache.set(type,html);return html;
}
