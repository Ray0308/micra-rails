export const AUDIO_KEY='micra-rails.audio.v1';
export function cleanAudioSettings(value){
 const volume=n=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):50;
 return {enabled:typeof value?.enabled==='boolean'?value.enabled:false,bgm:volume(value?.bgm),sfx:volume(value?.sfx)};
}

// Separate master, music, and effect buses. Context creation always follows a user gesture.
export function createAudioController({storage,Context=globalThis.AudioContext||globalThis.webkitAudioContext,schedule=setInterval,cancel=clearInterval}={}){
 let settings=cleanAudioSettings(),context,master,music,effects,timer=null,visible=true,unlocked=false,disposed=false,nextTime=0,step=0,duckUntil=0,scene='title',visibilityTask=Promise.resolve();
 const musicVoices=new Set(),hisses=new Set(),effectBuffers=new Map(),rewardVoices=new Set();
 function stopRewards(){duckUntil=0;for(const source of [...rewardVoices]){try{source.stop()}catch{}}rewardVoices.clear()}
 function stopHisses(){for(const stop of [...hisses])stop()}
 try{const raw=storage?.getItem(AUDIO_KEY);if(raw)settings=cleanAudioSettings(JSON.parse(raw))}catch{}
 function save(){try{storage?.setItem(AUDIO_KEY,JSON.stringify(settings))}catch{}}
 function gain(param,value){if(!context)return;param.cancelScheduledValues(context.currentTime);param.setTargetAtTime(value,context.currentTime,.015)}
 function stopMusic(){
  if(timer!==null){cancel(timer);timer=null}
  for(const voice of musicVoices){try{voice.stop()}catch{}}
  musicVoices.clear();
 }
 function voice(hz,time,duration,strength,bus,musical=false){
  // PCM sources use the same playback path as the audible Creeper hiss on mobile.
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate);
  const samples=buffer.getChannelData(0),attack=musical?.018:.005;
  for(let i=0;i<samples.length;i++){
   const t=i/context.sampleRate,phase=2*Math.PI*hz*t;
   const wave=musical?(.8*Math.sin(phase)+.2*Math.sin(phase*2)):(.72*Math.sin(phase)+.2*Math.sin(phase*2)+.08*Math.sin(phase*3));
   const envelope=Math.min(1,t/attack)*Math.min(1,(duration-t)/.025)*(musical?Math.exp(-2*t/duration):1);
   samples[i]=wave*envelope*strength;
  }
  const source=context.createBufferSource(),envelope=context.createGain();
  source.buffer=buffer;source.connect(envelope).connect(bus);
  if(musical)musicVoices.add(source);
  source.onended=()=>{musicVoices.delete(source);source.disconnect();envelope.disconnect()};
  source.start(time);source.stop(time+duration);return source;
 }
 function note(midi,time,duration,strength=.16){voice(440*2**((midi-69)/12),time,duration,strength,music,true)}
 function fillMusic(){
  if(!context||!visible||!settings.enabled||settings.bgm===0)return;
  if(scene==='game'){
   const pulse=[50,57,62,57,50,58,62,57,48,55,60,55,46,53,58,53],bass=[38,38,36,34];
   if(nextTime<context.currentTime)nextTime=context.currentTime+.03;
   while(nextTime<context.currentTime+.22){
    const i=step%pulse.length;
    if(i%4===0)note(bass[Math.floor(i/4)],nextTime,.75,.12);
    note(pulse[i],nextTime,.19,i%4===0?.14:.10);
    if(i%8===6)note(pulse[i]+12,nextTime,.32,.065);
    nextTime+=.24;step++;
   }
   return;
  }
  // Keep the original title melody unchanged.
  const melody=[64,null,67,null,69,67,null,64,62,null,64,null,67,64,null,62,60,null,64,null,67,64,null,60,62,null,67,null,69,67,null,62];
  const roots=[48,45,41,43];
  if(nextTime<context.currentTime)nextTime=context.currentTime+.03;
  while(nextTime<context.currentTime+.22){
   const index=step%melody.length;
   if(index%8===0)note(roots[Math.floor(index/8)],nextTime,2.8,.10);
   if(melody[index]!==null)note(melody[index],nextTime,1.5);
   nextTime+=.58;step++;
  }
 }
 function sync(){
  if(!context||disposed)return;
  if(!settings.enabled||settings.sfx===0||!visible){stopHisses();stopRewards();}
  gain(master.gain,settings.enabled&&visible?1:0);gain(music.gain,settings.bgm/100*(context.currentTime<duckUntil?.25:1));
  if(context.currentTime<duckUntil)music.gain.setTargetAtTime(settings.bgm/100,duckUntil,.12);gain(effects.gain,settings.sfx/100);
  if(settings.enabled&&visible&&settings.bgm>0&&unlocked){
   if(timer===null){nextTime=context.currentTime+.04;step=0;fillMusic();timer=schedule(fillMusic,100);timer?.unref?.()}
  }else stopMusic();
 }
 function unlock(){
  if(disposed||!settings.enabled||!visible||!Context)return false;
  try{
   if(!context){
    context=new Context();master=context.createGain();music=context.createGain();effects=context.createGain();
    master.gain.value=0;music.connect(master);effects.connect(master);master.connect(context.destination);
    context.onstatechange=()=>{if(!disposed&&context.state==='running'&&visible&&settings.enabled){stopMusic();nextTime=context.currentTime+.03;sync()}};
   }
   unlocked=true;
   const resumed=context.resume();
   resumed?.then?.(()=>{if(!disposed&&visible&&settings.enabled){nextTime=Math.max(nextTime,context.currentTime+.03);sync()}})?.catch?.(()=>{});
   sync();return true;
  }catch{return false}
 }
 return {
  get settings(){return {...settings}},
  get scene(){return scene},
  setScene(value){const next=value==='game'?'game':'title';if(scene===next)return;scene=next;stopMusic();sync()},
  setEnabled(enabled){settings.enabled=Boolean(enabled);save();sync()},
  setVolume(channel,value){if(!['bgm','sfx'].includes(channel))return;settings=cleanAudioSettings({...settings,[channel]:Number(value)});save();sync()},
  unlock,
  setVisible(value){
   visible=Boolean(value);sync();
   // Serialize suspend/resume: a late background suspend must not silence the foreground.
   visibilityTask=visibilityTask.catch(()=>{}).then(async()=>{
    if(!context||disposed)return;
    if(!visible){await context.suspend();return;}
    if(unlocked&&settings.enabled){
     await context.resume();
     if(visible&&!disposed){stopMusic();sync();}
    }
   });
   return visibilityTask.catch(()=>{});
  },
  effect(kind='click'){
   if(!settings.enabled||settings.sfx===0||!visible||!unlock())return;
   const mining=kind==='mine',length=mining?.14:.042,key=mining?'mine':'click';
   let buffer=effectBuffers.get(key);
   if(!buffer){
    buffer=context.createBuffer(1,Math.ceil(context.sampleRate*length),context.sampleRate);
    const samples=buffer.getChannelData(0);let previous=0;
    for(let i=0;i<samples.length;i++){
     const t=i/context.sampleRate,noise=Math.random()*2-1;
     const grain=noise-previous;previous=noise;
     const body=mining?Math.sin(2*Math.PI*430*t)*Math.exp(-t*48)+.38*Math.sin(2*Math.PI*1170*t)*Math.exp(-t*80):Math.sin(2*Math.PI*1200*t)*Math.exp(-t*210);
     const tap=grain*Math.exp(-t*(mining?100:320));
     samples[i]=Math.min(1,t/.001)*(.32*body+.16*tap)*(1-t/length);
    }
    effectBuffers.set(key,buffer);
   }
   const source=context.createBufferSource();source.buffer=buffer;source.connect(effects);
   source.onended=()=>source.disconnect();source.start(context.currentTime);source.stop(context.currentTime+length);
  },
  explode(){
   stopHisses();
   if(!settings.enabled||settings.sfx===0||!visible||!unlock())return;
   const length=1.05;let buffer=effectBuffers.get('explosion');
   if(!buffer){
    buffer=context.createBuffer(1,Math.ceil(context.sampleRate*length),context.sampleRate);
    const samples=buffer.getChannelData(0);let rumble=0;
    for(let i=0;i<samples.length;i++){
     const t=i/context.sampleRate,noise=Math.random()*2-1;rumble=rumble*.94+noise*.06;
     const bass=Math.sin(2*Math.PI*(95*t-28*t*t))*.32*Math.exp(-t*8);
     const blast=noise*.34*Math.exp(-t*20)+rumble*.65*Math.exp(-t*4);
     let chips=0;
     for(const start of [.11,.19,.30,.44]){const u=t-start;if(u>=0&&u<.10)chips+=noise*.12*Math.exp(-u*55);}
     samples[i]=Math.max(-.75,Math.min(.75,(bass+blast+chips)*Math.min(1,t/.002)*Math.min(1,(length-t)/.10)));
    }
    effectBuffers.set('explosion',buffer);
   }
   const source=context.createBufferSource(),time=context.currentTime;source.buffer=buffer;source.connect(effects);rewardVoices.add(source);
   source.onended=()=>{rewardVoices.delete(source);source.disconnect()};source.start(time);source.stop(time+length);
  },
  reward(shiny=false){
   if(!settings.enabled||settings.sfx===0||!visible||!unlock())return;
   const length=shiny?1.65:1.25,key=shiny?'reward-shiny':'reward';
   let buffer=effectBuffers.get(key);
   if(!buffer){
    buffer=context.createBuffer(1,Math.ceil(context.sampleRate*length),context.sampleRate);
    const samples=buffer.getChannelData(0),notes=shiny?[72,76,79,84,88,91]:[72,76,79,84];
    for(let i=0;i<samples.length;i++){
     const t=i/context.sampleRate;let sample=0;
     // Low fracture, then three short scattered stone chips.
     if(t<.25)sample+=.20*Math.sin(2*Math.PI*(150-200*t)*t)*Math.exp(-t*26);
     for(const start of [0,.045,.10]){const u=t-start;if(u>=0&&u<.13)sample+=(Math.random()*2-1)*.27*Math.exp(-u*48)*(1-u/.13);}
     // The first glint lands with the card's CSS release delay (.22 seconds).
     for(let n=0;n<notes.length;n++){
      const u=t-(.24+n*.10);if(u<0)continue;
      const hz=440*2**((notes[n]-69)/12),phase=2*Math.PI*hz*u;
      sample+=(Math.sin(phase)+.22*Math.sin(phase*2)+.10*Math.sin(phase*4))*Math.min(1,u/.007)*Math.exp(-u*5.5)*.15;
     }
     if(t>.62){const u=t-.62;for(const midi of [72,76,79])sample+=.035*Math.sin(2*Math.PI*440*2**((midi-69)/12)*u)*Math.min(1,u/.02)*Math.exp(-u*4);}
     samples[i]=Math.max(-.85,Math.min(.85,sample))*Math.min(1,(length-t)/.08);
    }
    effectBuffers.set(key,buffer);
   }
   const source=context.createBufferSource(),time=context.currentTime;source.buffer=buffer;source.connect(effects);rewardVoices.add(source);
   source.onended=()=>{rewardVoices.delete(source);source.disconnect()};source.start(time);source.stop(time+length);
   // Let the reward stand out without changing the user's BGM slider.
   duckUntil=time+length-.15;
   music.gain.cancelScheduledValues(time);music.gain.setTargetAtTime(settings.bgm/100*.25,time,.025);
   music.gain.setTargetAtTime(settings.bgm/100,duckUntil,.12);
  },
  tone(hz=300,duration=.08){
   if(!settings.enabled||settings.sfx===0||!visible||!unlock())return;
   voice(hz,context.currentTime,Math.max(.10,duration),.20,effects);
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
  dispose(){disposed=true;stopRewards();stopHisses();stopMusic();context?.close()?.catch?.(()=>{})},
 };
}
