export const AUDIO_KEY='micra-rails.audio.v1';
export function cleanAudioSettings(value){
 const volume=n=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):50;
 return {enabled:typeof value?.enabled==='boolean'?value.enabled:false,bgm:volume(value?.bgm),sfx:volume(value?.sfx)};
}

// Separate master, music, and effect buses. Context creation always follows a user gesture.
export function createAudioController({storage,Context=globalThis.AudioContext||globalThis.webkitAudioContext,schedule=setInterval,cancel=clearInterval}={}){
 let settings=cleanAudioSettings(),context,master,music,effects,timer=null,visible=true,unlocked=false,nextTime=0,step=0;
 const musicVoices=new Set(),hisses=new Set();
 function stopHisses(){for(const stop of [...hisses])stop()}
 try{const raw=storage?.getItem(AUDIO_KEY);if(raw)settings=cleanAudioSettings(JSON.parse(raw))}catch{}
 function save(){try{storage?.setItem(AUDIO_KEY,JSON.stringify(settings))}catch{}}
 function gain(param,value){if(!context)return;param.cancelScheduledValues(context.currentTime);param.setTargetAtTime(value,context.currentTime,.015)}
 function stopMusic(){
  if(timer!==null){cancel(timer);timer=null}
  for(const voice of musicVoices){try{voice.stop()}catch{}}
  musicVoices.clear();
 }
 function note(midi,time,duration,strength=.028){
  const osc=context.createOscillator(),envelope=context.createGain();
  osc.type='triangle';osc.frequency.value=440*2**((midi-69)/12);
  envelope.gain.setValueAtTime(.0001,time);envelope.gain.exponentialRampToValueAtTime(strength,time+.025);
  envelope.gain.exponentialRampToValueAtTime(.0001,time+duration);
  osc.connect(envelope).connect(music);musicVoices.add(osc);
  osc.onended=()=>{musicVoices.delete(osc);osc.disconnect();envelope.disconnect()};
  osc.start(time);osc.stop(time+duration+.02);
 }
 function fillMusic(){
  if(!context||!visible||!settings.enabled||settings.bgm===0)return;
  // An original quiet placeholder melody, replaceable with a recorded BGM later.
  const melody=[64,null,67,null,69,67,null,64,62,null,64,null,67,64,null,62,60,null,64,null,67,64,null,60,62,null,67,null,69,67,null,62];
  const roots=[48,45,41,43];
  if(nextTime<context.currentTime)nextTime=context.currentTime+.03;
  while(nextTime<context.currentTime+.22){
   const index=step%melody.length;
   if(index%8===0)note(roots[Math.floor(index/8)],nextTime,2.8,.022);
   if(melody[index]!==null)note(melody[index],nextTime,1.5);
   nextTime+=.58;step++;
  }
 }
 function sync(){
  if(!context)return;
  if(!settings.enabled||settings.sfx===0||!visible)stopHisses();
  gain(master.gain,settings.enabled&&visible?1:0);gain(music.gain,settings.bgm/100);gain(effects.gain,settings.sfx/100);
  if(settings.enabled&&visible&&settings.bgm>0&&unlocked){
   if(timer===null){nextTime=context.currentTime+.04;step=0;fillMusic();timer=schedule(fillMusic,100);timer?.unref?.()}
  }else stopMusic();
 }
 function unlock(){
  if(!settings.enabled||!visible||!Context)return false;
  try{
   if(!context){
    context=new Context();master=context.createGain();music=context.createGain();effects=context.createGain();
    master.gain.value=0;music.connect(master);effects.connect(master);master.connect(context.destination);
   }
   unlocked=true;context.resume()?.catch?.(()=>{});sync();return true;
  }catch{return false}
 }
 return {
  get settings(){return {...settings}},
  setEnabled(enabled){settings.enabled=Boolean(enabled);save();sync()},
  setVolume(channel,value){if(!['bgm','sfx'].includes(channel))return;settings=cleanAudioSettings({...settings,[channel]:Number(value)});save();sync()},
  unlock,
  setVisible(value){visible=Boolean(value);sync();if(!visible)context?.suspend()?.catch?.(()=>{});else if(unlocked&&settings.enabled)context?.resume()?.catch?.(()=>{})},
  tone(hz=300,duration=.08){
   if(!settings.enabled||settings.sfx===0||!visible||!unlock())return;
   const osc=context.createOscillator(),envelope=context.createGain(),time=context.currentTime;
   osc.type='square';osc.frequency.value=hz;
   envelope.gain.setValueAtTime(.035,time);envelope.gain.exponentialRampToValueAtTime(.0001,time+duration);
   osc.connect(envelope).connect(effects);
   osc.onended=()=>{osc.disconnect();envelope.disconnect()};osc.start(time);osc.stop(time+duration);
  },
  hiss(duration=3){
   if(!settings.enabled||settings.sfx===0||!visible||!unlock())return ()=>{};
   const time=context.currentTime,length=Math.max(.1,duration),buffer=context.createBuffer(1,Math.floor(context.sampleRate*.25),context.sampleRate);
   const samples=buffer.getChannelData(0);
   for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
   const source=context.createBufferSource(),filter=context.createBiquadFilter(),envelope=context.createGain();
   source.buffer=buffer;source.loop=true;filter.type='highpass';filter.frequency.value=1100;
   envelope.gain.setValueAtTime(.0001,time);envelope.gain.exponentialRampToValueAtTime(.065,time+.04);
   envelope.gain.setValueAtTime(.065,time+Math.max(.04,length-.04));envelope.gain.exponentialRampToValueAtTime(.0001,time+length);
   source.connect(filter).connect(envelope).connect(effects);
   let ended=false;
   const stop=()=>{if(ended)return;ended=true;hisses.delete(stop);try{source.stop()}catch{}};
   source.onended=()=>{ended=true;hisses.delete(stop);source.disconnect();filter.disconnect();envelope.disconnect()};
   hisses.add(stop);source.start(time);source.stop(time+length);return stop;
  },
  dispose(){stopHisses();stopMusic();context?.close()?.catch?.(()=>{})},
 };
}
