const parse = value => {
  const s=String(value).trim();
  if(!/^(?:\d{1,9}(?:\.\d{0,5})?|\.\d{1,5})$/.test(s))return null;
  const [whole,fraction='']=s.split('.');
  return BigInt(whole || '0')*100000n + BigInt(fraction.padEnd(5,'0'));
};
// We store fifths of 0.00001 gram so even the smallest accepted carat entry is exact.
export function weightSummary(counts,entries,gross,hasFrame){
  const rows=counts.map((count,i)=>{
    if(!hasFrame)return null;
    if(!count)return 0n;
    const mass=parse(entries[i].weight);
    return mass===null||mass<=0n?null:BigInt(count)*mass*(entries[i].unit==='ct'?1n:5n);
  });
  const total=hasFrame&&rows.every(v=>v!==null)?rows.reduce((a,b)=>a+b,0n):null;
  const g=parse(gross);
  const excess=total!==null && g!==null && g>0n && total>g*5n;
  return {rows,total,net:!excess&&total!==null&&g!==null&&g>0n?g*5n-total:null,excess};
}
export function grams(n){
  if(n===null)return '—';
  const micros=n*2n;
  const fraction=String(micros%1000000n).padStart(6,'0').replace(/0+$/,'');
  return String(micros/1000000n)+(fraction?'.'+fraction:'')+' g';
}
