import {detect} from './detect.mjs';

// Full-resolution tiles use a halo large enough for the fine detector's
// largest sampling ellipse. Each tile owns only centres in its core.
export async function detailCount(image,inside,active=()=>true){
  const {width:w,height:h,data}=image;
  const div=Math.max(1,Math.ceil(Math.max(w,h)/680));
  const sw=Math.floor(w/div),sh=Math.floor(h/div);
  if(!sw||!sh)return [];
  const small=new Uint8ClampedArray(sw*sh*4);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
    const target=(y*sw+x)*4;
    const sums=[0,0,0];
    for(let j=0;j<div;j++)for(let i=0;i<div;i++){
      const p=((y*div+j)*w+x*div+i)*4;
      for(let k=0;k<3;k++)sums[k]+=data[p+k];
    }
    for(let k=0;k<3;k++)small[target+k]=sums[k]/(div*div);
  }
  const coarse=detect({data:small,width:sw,height:sh},inside&&((x,y,rx,ry)=>inside(x*div,y*div,rx*div,ry*div)));
  const out=coarse.map(p=>({...p,x:p.x*div,y:p.y*div,r:p.r*div,rx:p.rx*div,ry:p.ry*div}));
  if(div===1)return out;
  const fine=[],core=256,halo=28;
  for(let y=0;y<h;y+=core)for(let x=0;x<w;x+=core){
    if(!active())return [];
    const x0=Math.max(0,x-halo),y0=Math.max(0,y-halo);
    const tw=Math.min(w,x+core+halo)-x0,th=Math.min(h,y+core+halo)-y0;
    const tile=new Uint8ClampedArray(tw*th*4);
    for(let j=0;j<th;j++){const p=((y0+j)*w+x0)*4;tile.set(data.subarray(p,p+tw*4),j*tw*4)}
    const bounds=(a,b,rx,ry)=>{const i=a+x0,j=b+y0;return i>=x&&i<x+core&&j>=y&&j<y+core&&(!inside||inside(i,j,rx,ry))};
    for(const p of detect({width:tw,height:th,data:tile},bounds,[3,4,6,9,13]))
      fine.push({...p,x:p.x+x0,y:p.y+y0});
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  // Give resolved small stones priority over coarse blobs spanning neighbours.
  const merged=[];
  for(const p of fine.sort((a,b)=>b.score-a.score).concat(out)){
    if(!merged.some(v=>Math.hypot((p.x-v.x)/Math.max(p.rx,v.rx),(p.y-v.y)/Math.max(p.ry,v.ry))<1.12))merged.push(p);
  }
  return merged.sort((a,b)=>a.y-b.y||a.x-b.x);
}

export function signature({data,width:w,height:h},stone){
  const samples=[],colour=[0,0,0];
  for(const scale of [.25,.55,.8])for(let i=0;i<16;i++){
    const theta=i*Math.PI/8, x=Math.min(w-1,Math.max(0,Math.round(stone.x+scale*(stone.rx||stone.r)*Math.cos(theta)))),
      y=Math.min(h-1,Math.max(0,Math.round(stone.y+scale*(stone.ry||stone.r)*Math.sin(theta))));
    const p=(y*w+x)*4,[r,g,b]=data.subarray(p,p+3),sum=r+g+b+1;
    colour[0]+=r/sum;colour[1]+=g/sum;colour[2]+=b/sum;samples.push(.299*r+.587*g+.114*b);
  }
  samples.sort((a,b)=>a-b);
  return {colour:colour.map(v=>v/48),spread:samples[42]-samples[5],radius:stone.r};
}
export function resembles(a,b){
  const ratio=a.radius/b.radius;
  return ratio>=.52&&ratio<=1.9&&Math.hypot(...a.colour.map((v,i)=>v-b.colour[i]))<.12&&Math.abs(a.spread-b.spread)<58;
}
