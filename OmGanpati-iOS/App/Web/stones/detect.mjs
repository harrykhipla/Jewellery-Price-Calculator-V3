import {tree} from './model.mjs';
export const kinds=['Pearl-like','Clear faceted (CZ-like)','Coloured stone-like','Other / uncertain'];
const angles=Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8),Math.sin(i*Math.PI/8)]);
function classify(data,w,x,y,rx,ry,scale){
  const mean=[0,0,0],l=[];
  for(const [dx,dy] of angles){
    const p=4*(Math.round(y+scale*ry*dy)*w+Math.round(x+scale*rx*dx));
    for(let i=0;i<3;i++)mean[i]+=data[p+i]/16;
    l.push(.299*data[p]+.587*data[p+1]+.114*data[p+2]);
  }
  const avg=l.reduce((a,b)=>a+b)/16;
  const f=[Math.max(...mean)-Math.min(...mean),avg,Math.sqrt(l.reduce((a,b)=>a+(b-avg)**2,0)/16),
    l.reduce((a,b,i)=>a+Math.abs(b-l[(i+15)%16]),0)/16,mean[0]-mean[2],mean[0]-mean[1]];
  let n=tree;while(Array.isArray(n))n=f[n[0]]<=n[1]?n[2]:n[3];return n;
}
export function detect({data,width:w,height:h},inside,radii=[3,4,6,9,13,19,28,40,58]){
  const candidates=[];
  // Evaluate elliptical contours as well as circles. Compare opposing sides
  // of the boundary to avoid mistaking a single metal edge for a setting.
  for(const radius of radii){
    for(const [ax,ay] of (radius<6?[[1,1]]:[[1,1],[1.45,.80],[.80,1.45]])){
      const rx=radius*ax,ry=radius*ay,mx=Math.ceil(rx*1.23)+1,my=Math.ceil(ry*1.23)+1;
      const step=radius<=4?1:Math.max(2,Math.floor(radius/3));
      if(2*mx>=w||2*my>=h)continue;
      const offsets=angles.filter((_,i)=>i%2===0).map(([dx,dy])=>[.73,1.2].map(f=>4*(Math.round(f*ry*dy)*w+Math.round(f*rx*dx))));
      for(let y=my;y<h-my;y+=step)for(let x=mx;x<w-mx;x+=step){
        if(inside&&!inside(x,y,rx,ry))continue;
        const p=4*(y*w+x);
        let sum=0,min=Infinity,covered=0,dir=0;
        for(const [a,b] of offsets){
          const dr=data[p+a]-data[p+b],dg=data[p+a+1]-data[p+b+1],db=data[p+a+2]-data[p+b+2];
          const d=(Math.abs(dr)+Math.abs(dg)+Math.abs(db))/3;
          sum+=Math.min(d,155);min=Math.min(d,min);if(d>18)covered++;
          dir+=Math.sign(dr+2*dg+db);
        }
        if(covered<7)continue;
        const score=.65*sum/8+.35*Math.min(min,155)+Math.abs(dir)*.75;
        if(score<=33)continue;
        let supported=0,aligned=0;
        for(const [dx,dy] of angles){
          let best=0;
          for(const scale of [.86,1,1.12]){
            const i=4*((y+Math.round(ry*dy*scale))*w+x+Math.round(rx*dx*scale));
            const nx=dx/rx,ny=dy/ry;
            for(let k=0;k<3;k++){
              const gx=data[i+4+k]-data[i-4+k],gy=data[i+4*w+k]-data[i-4*w+k];
              const length=Math.hypot(gx,gy);
              if(length>12)best=Math.max(best,Math.abs(gx*nx+gy*ny)/(length*Math.hypot(nx,ny)));
            }
          }
          if(best>.68)supported++;aligned+=best;
        }
        if(supported>=8)candidates.push({x,y,r:radius,rx,ry,score:score*(.55+.45*aligned/16)});
      }
    }
  }
  candidates.sort((a,b)=>b.score-a.score||b.r-a.r);
  const hits=[];
  for(const c of candidates){
    if(hits.some(v=>Math.hypot((c.x-v.x)/Math.max(c.rx,v.rx),(c.y-v.y)/Math.max(c.ry,v.ry))<1.17))continue;
    const votes=[0,0,0,0];for(const scale of [.40,.63,.80])votes[classify(data,w,c.x,c.y,c.rx,c.ry,scale)]++;
    const high=Math.max(...votes);hits.push({...c,kind:high>=2?votes.indexOf(high):3});
    if(hits.length>=250)break;
  }
  return hits.sort((a,b)=>a.y-b.y||a.x-b.x);
}

// Match only to nearby markers from the immediately preceding frame. Never
// accumulate counts as the camera moves to another view.
export function stabilise(current,previous){
  const used=new Set();
  return current.map(h=>{
    let match=-1,best=.6;
    for(let i=0;i<previous.length;i++){
      const v=previous[i];if(used.has(i)||Math.min(v.r,h.r)/Math.max(v.r,h.r)<.65)continue;
      const d=Math.hypot(v.x-h.x,v.y-h.y)/h.r;if(d<best){match=i;best=d}
    }
    if(match<0)return {...h,history:[h.kind]};
    used.add(match);const v=previous[match],history=[...(v.history||[v.kind]).slice(-2),h.kind];
    const majority=history.find(k=>history.filter(n=>n===k).length>=2);
    return {...h,x:.75*h.x+.25*v.x,y:.75*h.y+.25*v.y,history,kind:majority??h.kind};
  });
}
