import {slide} from '../engine.mjs';
// Fixed boards isolate rule/motion tests from the production random generator.
export function fixedBoard(level=0){
 const types=['h','h','h','sw','es','cross','ne','v','wn','h','es','v','ne','h',null,'v'];
 const state={tiles:types.map(type=>type?{type,used:[]}:null),a:0,b:-1,entry:3,trail:[0],bStep:-1,status:'ready',moves:0,level};
 for(const i of [[10,6,2],[13,9,10,6,2],[10,9,5,6,2]][level%3])slide(state,i);
 state.moves=0;return state;
}
