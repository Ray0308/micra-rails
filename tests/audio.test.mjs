import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIO_KEY,cleanAudioSettings,createAudioController} from '../audio.mjs';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
function fixture(storage=memory()){
 const instances=[],jobs=new Map();let timerId=0;
 class Param{constructor(){this.value=1}cancelScheduledValues(){}setValueAtTime(v){this.value=v}setTargetAtTime(v){this.value=v}exponentialRampToValueAtTime(v){this.value=v}}
 class Node{constructor(){this.gain=new Param()}connect(to){this.connectedTo=to;return to}disconnect(){}}
 class Context{
  constructor(){this.currentTime=0;this.destination={};this.gains=[];this.oscs=[];this.noises=[];this.sampleRate=8000;this.resumes=0;this.suspends=0;instances.push(this)}
  createGain(){const n=new Node();this.gains.push(n);return n}
  createOscillator(){const n=new Node();n.frequency={value:0};n.start=()=>n.started=true;n.stop=time=>{if(time===undefined){n.stoppedNow=true;n.onended?.()}};this.oscs.push(n);return n}
  createBuffer(channels,length,rate){const samples=new Float32Array(length);return {getChannelData:()=>samples,length,sampleRate:rate}}
  createBufferSource(){const n=new Node();n.start=()=>n.started=true;n.stop=time=>{if(time===undefined){n.stoppedNow=true;n.onended?.()}else n.scheduledStop=time};this.noises.push(n);return n}
  createBiquadFilter(){const n=new Node();n.frequency={value:0};return n}
  resume(){this.resumes++;this.state='running';return Promise.resolve()}suspend(){this.suspends++;return Promise.resolve()}close(){this.closed=true;return Promise.resolve()}
 }
 const audio=createAudioController({storage,Context,schedule:fn=>{const id=++timerId;jobs.set(id,fn);return id},cancel:id=>jobs.delete(id)});
 return {audio,storage,instances,jobs};
}

test('volume sanitation preserves zero, clamps bounds, and handles corrupt values',()=>{
 assert.deepEqual(cleanAudioSettings({enabled:true,bgm:0,sfx:123}),{enabled:true,bgm:0,sfx:100});
 assert.deepEqual(cleanAudioSettings({enabled:'yes',bgm:NaN,sfx:-9}),{enabled:false,bgm:50,sfx:0});
});

test('sound and independent volume settings persist and restore',()=>{
 const storage=memory(),first=createAudioController({storage});first.setEnabled(true);first.setVolume('bgm',23);first.setVolume('sfx',0);
 const restored=createAudioController({storage});assert.deepEqual(restored.settings,{enabled:true,bgm:23,sfx:0});
 assert.ok(storage.getItem(AUDIO_KEY));first.dispose();restored.dispose();
});

test('audio context is not created until an enabled user unlock',()=>{
 const f=fixture();f.audio.setVolume('bgm',60);assert.equal(f.instances.length,0);assert.equal(f.audio.unlock(),false);
 f.audio.setEnabled(true);assert.equal(f.instances.length,0);assert.equal(f.audio.unlock(),true);
 assert.equal(f.instances.length,1);assert.equal(f.jobs.size,1);assert.equal(f.instances[0].gains[1].gain.value,.6);
 f.audio.dispose();
});

test('effects route through the effect bus independently of muted music',()=>{
 const f=fixture();f.audio.setVolume('bgm',0);f.audio.setVolume('sfx',40);f.audio.setEnabled(true);f.audio.unlock();
 const ctx=f.instances[0];assert.equal(f.jobs.size,0);f.audio.tone(500,.1);
 assert.equal(ctx.noises.length,1);assert.equal(ctx.gains.at(-1).connectedTo,ctx.gains[2]);
 assert.equal(ctx.gains[1].gain.value,0);assert.equal(ctx.gains[2].gain.value,.4);
 f.audio.setVolume('sfx',0);f.audio.tone();assert.equal(ctx.noises.length,1);f.audio.dispose();
});

test('master OFF silences every bus, stops music scheduling, and reuses the context',()=>{
 const f=fixture();f.audio.setEnabled(true);f.audio.unlock();const ctx=f.instances[0];
 assert.equal(ctx.gains[0].gain.value,1);assert.ok(ctx.noises.length>0);
 f.audio.setEnabled(false);assert.equal(ctx.gains[0].gain.value,0);assert.equal(f.jobs.size,0);assert.ok(ctx.noises.every(o=>o.stoppedNow));
 const count=ctx.noises.length;f.audio.tone();assert.equal(ctx.noises.length,count);
 f.audio.setEnabled(true);f.audio.unlock();assert.equal(f.instances.length,1);assert.equal(f.jobs.size,1);f.audio.dispose();
});

test('hidden pages suspend audio and do not emit effects',async()=>{
 const f=fixture();f.audio.setEnabled(true);f.audio.unlock();const ctx=f.instances[0];
 await f.audio.setVisible(false);const count=ctx.noises.length;f.audio.tone();assert.equal(ctx.noises.length,count);assert.equal(ctx.gains[0].gain.value,0);assert.equal(f.jobs.size,0);assert.equal(ctx.suspends,1);
 await f.audio.setVisible(true);assert.equal(ctx.gains[0].gain.value,1);assert.equal(f.jobs.size,1);f.audio.dispose();assert.equal(f.jobs.size,0);assert.ok(ctx.closed);
});

test('unavailable storage and unsupported audio do not break menu settings',()=>{
 const storage={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
 const audio=createAudioController({storage,Context:null});audio.setVolume('bgm',0);audio.setEnabled(true);assert.equal(audio.unlock(),false);audio.tone();assert.deepEqual(audio.settings,{enabled:true,bgm:0,sfx:50});
});

test('Creeper hiss is a stoppable three-second effect and obeys effect/master mute',()=>{
 const f=fixture();f.audio.setVolume('bgm',0);f.audio.setEnabled(true);
 const stop=f.audio.hiss(3),ctx=f.instances[0],noise=ctx.noises[0];
 assert.ok(noise.started);assert.equal(noise.loop,true);assert.equal(noise.scheduledStop,3);assert.equal(noise.connectedTo.type,'highpass');assert.equal(ctx.gains.at(-1).connectedTo,ctx.gains[2]);
 stop();assert.ok(noise.stoppedNow);
 f.audio.hiss();f.audio.setVolume('sfx',0);assert.ok(ctx.noises[1].stoppedNow);
 f.audio.hiss();assert.equal(ctx.noises.length,2);
 f.audio.setVolume('sfx',50);f.audio.hiss();f.audio.setEnabled(false);assert.ok(ctx.noises[2].stoppedNow);f.audio.dispose();
});


test('music and button effects contain audible PCM samples on the same source path as hiss',()=>{
 const f=fixture();f.audio.setEnabled(true);f.audio.unlock();const ctx=f.instances[0];
 assert.ok(ctx.noises.length>=2);
 const musicSamples=ctx.noises[0].buffer.getChannelData(0);
 assert.ok(Math.max(...musicSamples)>.07,'music amplitude should be audible at normal volume');
 f.audio.tone(440,.04);const effect=ctx.noises.at(-1),samples=effect.buffer.getChannelData(0);
 assert.ok(samples.length>=ctx.sampleRate*.1,'short click has a sustained audible envelope');
 assert.ok(Math.max(...samples)>.14);
 assert.equal(ctx.gains.at(-1).connectedTo,ctx.gains[2]);
 f.audio.dispose();
});

test('mobile audio interruption can restart music scheduling after context resumes',()=>{
 const f=fixture();f.audio.setEnabled(true);f.audio.unlock();const ctx=f.instances[0];
 const before=ctx.noises.length;ctx.currentTime=30;ctx.state='running';ctx.onstatechange();
 assert.ok(ctx.noises.length>before);assert.equal(f.jobs.size,1);
 f.audio.dispose();
});


test('game soundtrack changes tempo and title soundtrack returns unchanged',()=>{
 const f=fixture();f.audio.setEnabled(true);f.audio.unlock();const ctx=f.instances[0];
 const original=Array.from(ctx.noises[0].buffer.getChannelData(0));
 f.audio.setScene('game');assert.equal(f.audio.scene,'game');
 const game=ctx.noises.at(-1).buffer;assert.ok(game.length<ctx.sampleRate*.3);
 f.audio.setScene('title');assert.equal(f.audio.scene,'title');
 assert.deepEqual(Array.from(ctx.noises.at(-2).buffer.getChannelData(0)),original);
 assert.equal(f.jobs.size,1);f.audio.dispose();
});

test('click and stone mining use distinct cached percussion buffers and obey mute',()=>{
 const f=fixture();f.audio.setVolume('bgm',0);f.audio.setEnabled(true);f.audio.effect('click');const ctx=f.instances[0],click=ctx.noises.at(-1);
 assert.equal(click.connectedTo,ctx.gains[2]);assert.ok(click.buffer.length<ctx.sampleRate*.05);
 f.audio.effect('mine');const mining=ctx.noises.at(-1);assert.ok(mining.buffer.length>click.buffer.length*3);
 assert.ok(mining.buffer.getChannelData(0).some(v=>Math.abs(v)>.1));
 f.audio.effect('click');assert.equal(ctx.noises.at(-1).buffer,click.buffer);
 const count=ctx.noises.length;f.audio.setVolume('sfx',0);f.audio.effect('mine');assert.equal(ctx.noises.length,count);f.audio.dispose();
});

test('foreground recovery waits for an unfinished background suspend before resuming',async()=>{
 const f=fixture();f.audio.setEnabled(true);f.audio.unlock();f.audio.setScene('game');const ctx=f.instances[0];
 let finishSuspend;ctx.suspend=()=>new Promise(resolve=>{finishSuspend=()=>{ctx.state='suspended';resolve()}});
 const background=f.audio.setVisible(false);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(typeof finishSuspend,'function');
 const foreground=f.audio.setVisible(true);finishSuspend();await background;await foreground;
 assert.equal(ctx.state,'running');assert.equal(ctx.gains[0].gain.value,1);assert.equal(f.jobs.size,1);assert.equal(f.audio.scene,'game');
 f.audio.effect('click');assert.ok(ctx.noises.at(-1).started);f.audio.dispose();
});


test('reward has fracture and later chime, with a longer shiny variation and cached samples',()=>{
 const f=fixture();f.audio.setVolume('bgm',0);f.audio.setEnabled(true);f.audio.reward(false);const ctx=f.instances[0],normal=ctx.noises.at(-1);
 assert.equal(normal.connectedTo,ctx.gains[2]);assert.equal(normal.buffer.length,ctx.sampleRate*1.25);
 const samples=normal.buffer.getChannelData(0);
 assert.ok(samples.slice(0,ctx.sampleRate*.2).some(v=>Math.abs(v)>.1));
 assert.ok(samples.slice(ctx.sampleRate*.3,ctx.sampleRate*.8).some(v=>Math.abs(v)>.1));
 f.audio.reward(true);assert.ok(ctx.noises.at(-1).buffer.length>normal.buffer.length);
 f.audio.reward(false);assert.equal(ctx.noises.at(-1).buffer,normal.buffer);
 f.audio.dispose();
});

test('reward is canceled on hide, SFX zero and master OFF, and cannot start muted',async()=>{
 const f=fixture();f.audio.setVolume('bgm',0);f.audio.setEnabled(true);f.audio.reward();const ctx=f.instances[0];
 await f.audio.setVisible(false);assert.ok(ctx.noises.at(-1).stoppedNow);
 await f.audio.setVisible(true);f.audio.reward();f.audio.setVolume('sfx',0);assert.ok(ctx.noises.at(-1).stoppedNow);
 const count=ctx.noises.length;f.audio.reward(true);assert.equal(ctx.noises.length,count);
 f.audio.setVolume('sfx',50);f.audio.reward();f.audio.setEnabled(false);assert.ok(ctx.noises.at(-1).stoppedNow);f.audio.dispose();
});
