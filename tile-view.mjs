// Preserve rail SVG/image nodes when only a tile's lock or selection changes.
const snapshots=new WeakMap();
export function renderTiles(board,markup){
 const previous=snapshots.get(board);
 const parts=markup.map(html=>{const end=html.indexOf('>');return {html,tag:html.slice(1).split(/[\s>]/,1)[0],content:html.slice(end+1),attrs:[...html.slice(0,end).matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]])}});
 if(!previous||!board.children||board.children.length!==parts.length){
  const html=markup.join('');if(board.innerHTML!==html)board.innerHTML=html;
 }else{
  for(let i=0;i<parts.length;i++){
   const next=parts[i],old=previous[i],node=board.children[i];
   if(next.tag!==old.tag||next.content!==old.content){node.outerHTML=next.html;continue;}
   const attrs=new Map(next.attrs);
   for(const [name] of old.attrs)if(!attrs.has(name))node.removeAttribute(name);
   for(const [name,value] of next.attrs)if(node.getAttribute(name)!==value)node.setAttribute(name,value);
  }
 }
 snapshots.set(board,parts);
}
