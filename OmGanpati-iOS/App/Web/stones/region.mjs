// Summed-area mask: accept a candidate only if its entire central footprint
// is inside the jewellery selection. Empty areas and erased holes stay excluded.
export function selectionRegion(alpha,w,h){
  const stride=w+1,prefix=new Uint32Array(stride*(h+1));
  for(let y=0;y<h;y++){
    let sum=0;
    for(let x=0;x<w;x++){
      sum+=Number(alpha[4*(y*w+x)+3]>=128);
      prefix[(y+1)*stride+x+1]=prefix[y*stride+x+1]+sum;
    }
  }
  return (x,y,rx=0,ry=0)=>{
    const l=Math.max(0,Math.floor(x-rx*.7)),r=Math.min(w,Math.ceil(x+rx*.7)+1);
    const t=Math.max(0,Math.floor(y-ry*.7)),b=Math.min(h,Math.ceil(y+ry*.7)+1);
    if(l>=r||t>=b)return false;
    return prefix[b*stride+r]-prefix[t*stride+r]-prefix[b*stride+l]+prefix[t*stride+l]===(r-l)*(b-t);
  };
}
export function guide(w,h){return {x:w*.17,y:h*.32,width:w*.66,height:h*.36}}
