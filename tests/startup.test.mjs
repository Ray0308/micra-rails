import test from 'node:test';
import assert from 'node:assert/strict';
import {loadImage,preloadImages,STARTUP_ASSETS,runStartup} from '../startup.mjs';
test('preload waits for image decoding, not just download completion',async()=>{
 let decode;class Image{set src(v){queueMicrotask(()=>this.onload())}decode(){return new Promise(resolve=>decode=resolve)}}
 let done=false;const promise=loadImage('rail.png',{ImageClass:Image}).then(r=>{done=true;return r});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(done,false);decode();assert.deepEqual(await promise,{src:'rail.png',ok:true});
});
test('image errors and timeouts resolve instead of trapping startup',async()=>{
 class ErrorImage{set src(v){queueMicrotask(()=>this.onerror())}}
 class StalledImage{set src(v){}}
 assert.equal((await loadImage('bad',{ImageClass:ErrorImage})).ok,false);
 assert.equal((await loadImage('slow',{ImageClass:StalledImage,timeoutMs:5})).ok,false);
});
test('progress tracks actual settled assets, deduplicates and limits concurrent loads',async()=>{
 let active=0,peak=0;const progress=[];
 class Image{set src(v){active++;peak=Math.max(peak,active);setImmediate(()=>{active--;this.onload()})}}
 const results=await preloadImages(['a','b','c','a'],{ImageClass:Image,concurrency:2,onProgress:(n,total)=>progress.push([n,total])});
 assert.equal(results.length,3);assert.equal(peak,2);assert.deepEqual(progress,[[0,3],[1,3],[2,3],[3,3]]);assert.ok(results.every(r=>r.ok));
});
test('startup includes all rail sprites and world floors without fetching the card collection',()=>{
 for(const kind of ['straight','curve','cross'])assert.ok(STARTUP_ASSETS.some(src=>src.includes('rail-'+kind+'-v044')));
 for(const world of ['grass','mine','nether','end'])assert.ok(STARTUP_ASSETS.some(src=>src.includes('floor-'+world+'.png')));
 assert.ok(!STARTUP_ASSETS.some(src=>src.includes('assets/cards/')));
});


test('studio logo appears before fade-out and the title is revealed only after it',async()=>{
 const sequence=[],label={};const splash={hidden:false,classList:{add(name){sequence.push(name);assert.equal(splash.hidden,false)}}};
 const document={getElementById:id=>id==='boot-screen'?splash:label,body:{classList:{remove(name){sequence.push('remove-'+name)}}}};
 class Image{set src(v){queueMicrotask(()=>this.onload())}}
 await runStartup({document,ImageClass:Image,minDuration:2,fadeDuration:2,maxDuration:100});
 assert.deepEqual(sequence,['logo-ready','is-leaving','remove-booting']);assert.equal(splash.hidden,true);
});
