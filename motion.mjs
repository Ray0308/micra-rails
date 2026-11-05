import {nextStep,advance} from './engine.mjs?v=0.3.1';

export const CREEPER_FUSE_MS=3000;
export const CREEPER_STEP_MS=1700;

export function createMotion(state){
  return {elapsed:0,route:[state.a],aDistance:0,bDistance:null,segment:null,fuse:0,movingA:false,movingB:false,cartStopped:false};
}

export function sampleRoute(route,distance){
  const d=Math.max(0,Math.min(distance,route.length-1));
  const i=Math.min(Math.floor(d),Math.max(0,route.length-2));
  const from=route[i],to=route[Math.min(i+1,route.length-1)],t=d-i;
  const x=from%4,y=Math.floor(from/4),dx=to%4-x,dy=Math.floor(to/4)-y;
  return {x:x+dx*t,y:y+dy*t,dx,dy};
}

// Distances are measured along the trail in cells, independently of frame rate.
export function updateMotion(state,m,delta,{aInterval=2600,bInterval=2200,delay=5500,fuseMs=CREEPER_FUSE_MS,pausePursuitOnBrake=false}={}){
  if(state.status!=='running')return false;
  if(pausePursuitOnBrake&&m.cartStopped){m.movingA=m.movingB=false;return false;}
  let changed=false;
  // Small steps keep entry locking and the explosion fuse consistent on slow frames.
  for(let remaining=delta;remaining>0&&state.status==='running';){
    const dt=Math.min(remaining,16);remaining-=dt;
    const before=m.elapsed;m.elapsed+=dt;
    if(!m.segment&&!m.cartStopped){
      const step=nextStep(state);
      if(step){
        m.segment={progress:0,committed:false};
        m.route.push(step.index);
        state.reserved=step.index;
        changed=true;
      }
    }
    m.movingA=Boolean(m.segment)&&!m.cartStopped;
    if(m.segment&&!m.cartStopped){
      const segment=m.segment;
      segment.progress=Math.min(1,segment.progress+dt/aInterval);
      m.aDistance=m.route.length-2+segment.progress;
      // Entering the next tile locks it. Reservation prevents sliding it under the cart.
      if(segment.progress>=.5&&!segment.committed){
        if(!advance(state))throw Error('A reserved rail changed during travel');
        if(state.status==='won')state.status='running';
        state.reserved=null;segment.committed=true;changed=true;
      }
      if(segment.progress>=1){
        m.segment=null;
        if(state.a===15){state.status='won';m.movingA=m.movingB=false;changed=true;break;}
      }
    }
    const activeTime=Math.max(0,m.elapsed-delay)-Math.max(0,before-delay);
    m.movingB=false;
    if(m.elapsed>=delay){
      if(m.bDistance===null){m.bDistance=0;changed=true;}
      const previous=m.bDistance;
      const ignited=m.fuse>0;
      if(!ignited)m.bDistance=Math.min(m.aDistance,m.bDistance+activeTime/bInterval);
      m.movingB=!ignited&&m.bDistance>previous;
      state.bStep=Math.floor(m.bDistance);
      state.b=m.route[Math.min(state.bStep,m.route.length-1)];
      const a=sampleRoute(m.route,m.aDistance),b=sampleRoute(m.route,m.bDistance);
      const close=Math.hypot(a.x-b.x,a.y-b.y)<(ignited ? .75 : .2);
      const oldFuse=m.fuse;
      m.fuse=close?m.fuse+dt:0;
      if(m.fuse>0)m.movingB=false;
      if(Boolean(oldFuse)!==Boolean(m.fuse))changed=true;
      if(m.fuse>=fuseMs){state.status='lost';m.movingA=m.movingB=false;changed=true;}
    }
  }
  return changed;
}
