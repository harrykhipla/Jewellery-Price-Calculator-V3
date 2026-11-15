import {detailCount,signature,resembles} from './detail.mjs';
import {selectionRegion,guide} from './region.mjs';
import {weightSummary,grams} from './weights.mjs';
import {categories as kinds,reviewedKind,assign} from './review.mjs';
import {detect,stabilise} from './detect.mjs';
const colours=['#fff0b3','#39deff','#fa72c9','#ffab48','#95a9ff','#53ea9b','#fff3dc','#e9688f','#c8b9a2'];
const by=id=>document.getElementById(id);
export function setupCounter(){
  const dialog=by('stone-counter'),canvas=by('stone-frame'),ctx=canvas.getContext('2d'),frame=document.createElement('canvas'),
    fctx=frame.getContext('2d',{willReadFrequently:true}),video=by('stone-video'),note=by('stone-note'),group=by('stone-kind');
  group.replaceChildren(...kinds.map((k,i)=>new Option(k,i)));
  let hits=[],active=-1,revision=0,timer,stream,live=false,hasFrame=false;
  let selected=new Set(),undo=null;
  const mode=by('stone-mode');
  const mask=document.createElement('canvas'),ink=mask.getContext('2d',{willReadFrequently:true});
  let painting=false,pointer=null,previous=null,inside=null,counted=false;
  const regionTools=by('stone-area-tools');
  function maskSize(){mask.width=frame.width;mask.height=frame.height}
  function startArea(fresh){
    if(!hasFrame)return;
    if(fresh)maskSize();
    painting=true;counted=false;pointer=null;inside=null;hits=[];active=-1;clearReview();
    note.textContent='Brush along the stones, including their edges. Leave the model and props unpainted.';
    display();
  }
  let counting=false;
  async function commitArea(whole){
    if(counting)return;
    const pixels=ink.getImageData(0,0,mask.width,mask.height).data;
    if(!whole&&!pixels.some((v,i)=>i%4===3&&v>=128)){note.textContent='Paint over the jewellery first.';return}
    if(whole){ink.fillStyle='#20d4bb';ink.fillRect(0,0,mask.width,mask.height)}
    inside=whole?null:selectionRegion(pixels,mask.width,mask.height);
    const run=++revision;counting=true;regionTools.disabled=true;note.textContent='Inspecting the selected area…';
    try{
      await new Promise(r=>setTimeout(r,0));
      const found=await detailCount(fctx.getImageData(0,0,frame.width,frame.height),inside,()=>revision===run);
      if(revision!==run)return;hits=found;active=-1;
    }catch{if(revision===run)note.textContent='Could not finish counting. Try a smaller jewellery area or a closer photo.';return}finally{counting=false;regionTools.disabled=false}
    painting=false;counted=true;clearReview();display();note.textContent='Review the numbered stones.';
  }
  by('stone-area-count').onclick=()=>commitArea(false);
  by('stone-area-all').onclick=()=>commitArea(true);
  by('stone-area-edit').onclick=()=>startArea(false);
  by('stone-area-clear').onclick=()=>{ink.clearRect(0,0,mask.width,mask.height);display()};
  function paint(event){
    const b=canvas.getBoundingClientRect(),x=(event.clientX-b.left)*mask.width/b.width,y=(event.clientY-b.top)*mask.height/b.height;
    const thickness=Math.max(5,mask.width*Number(by('stone-brush-width').value)/100);
    ink.save();ink.globalCompositeOperation=by('stone-brush-mode').value==='erase'?'destination-out':'source-over';
    ink.fillStyle=ink.strokeStyle='#20d4bb';ink.lineCap='round';ink.lineWidth=thickness;
    if(previous){ink.beginPath();ink.moveTo(previous.x,previous.y);ink.lineTo(x,y);ink.stroke()}
    ink.beginPath();ink.arc(x,y,thickness/2,0,2*Math.PI);ink.fill();ink.restore();
    previous={x,y};display();
  }
  canvas.onpointerdown=e=>{if(counting||!painting||pointer!==null)return;e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);previous=null;paint(e)};
  canvas.onpointermove=e=>{if(!counting&&painting&&pointer===e.pointerId)paint(e)};
  canvas.onpointerup=canvas.onpointercancel=()=>{pointer=null;previous=null};
  function clearReview(){selected.clear();undo=null;mode.value='one'}
  function remember(){undo=hits.map(h=>({...h}))}
  const bridge=window.webkit?.messageHandlers?.printer;
  const inputs=kinds.map((label,i)=>{
    const row=document.createElement('tr'),name=document.createElement('th');
    name.scope='row';const dot=document.createElement('i');dot.style.background=colours[i];dot.className='stone-dot';
    name.append(dot,label);row.append(name);
    const cell=()=>row.appendChild(document.createElement('td'));
    const count=cell(),per=cell(),mass=document.createElement('input'),unit=document.createElement('select'),total=cell();
    mass.type='text';mass.inputMode='decimal';mass.placeholder='Each';mass.maxLength=16;mass.setAttribute('aria-label',label+' weight per piece');
    unit.replaceChildren(new Option('g','g'),new Option('ct','ct'));unit.setAttribute('aria-label',label+' weight unit');
    per.append(mass,unit);by('sw-rows').append(row);mass.oninput=unit.onchange=weights;
    return {mass,unit,count,total};
  });
  by('sw-gross').oninput=weights;
  function weights(){
    const counts=kinds.map((_,i)=>hits.filter(h=>reviewedKind(h)===i).length);
    inputs.forEach((r,i)=>{r.count.parentElement.hidden=i>=4&&!counts[i]&&!r.mass.value});
    const result=weightSummary(counts,inputs.map(r=>({weight:r.mass.value,unit:r.unit.value})),by('sw-gross').value,counted);
    inputs.forEach((r,i)=>{r.count.textContent=counted?counts[i]:'—';r.total.textContent=grams(result.rows[i])});
    by('sw-deduct').textContent=grams(result.total);by('sw-net').textContent=grams(result.net);
    by('sw-hint').textContent=result.excess?'Embellishment weight exceeds gross weight. Check the counts, units and weights.':
      !counted?'Select the jewellery area to calculate its weights.':
      result.total===null?'Enter a positive weight for each counted category (up to 5 decimal places).':
      result.net===null?'Enter the gross weight in grams.':'Based on the visible count and your per-piece weights.';
  }
  function stop(){
    revision++;clearTimeout(timer);if(live&&bridge)bridge.postMessage({op:'stopStoneCamera'}).catch(()=>{});
    live=false;stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;
    by('stone-freeze').hidden=true;by('stone-live').disabled=false;
  }
  function display(){
    by('sw-count').textContent=counted?'Total visible count: '+hits.length:'Total visible count: —';
    weights();
    regionTools.hidden=!painting;by('stone-area-edit').hidden=live||!counted;canvas.style.touchAction=painting?'none':'auto';
    by('stone-controls').hidden=live||!counted;by('stone-remove').disabled=active<0;by('stone-markers').replaceChildren(new Option('Choose a marker','-1'),...hits.map((h,i)=>new Option((i+1)+' · '+kinds[reviewedKind(h)]+(h.confirmed!=null?' ✓':''),i)));
    by('stone-markers').value=String(active);if(active>=0&&mode.value==='one')group.value=String(reviewedKind(hits[active]));
    by('stone-apply').disabled=!selected.size;by('stone-similar').disabled=!selected.size;
    by('stone-undo').disabled=!undo;
    by('stone-all').disabled=!hits.length;
    by('stone-remove').disabled=selected.size!==1;
    const single=selected.size===1?hits[[...selected][0]]:null;
    by('stone-selected').textContent=single?
      (single.manual?'Added manually':'Visual estimate: '+kinds[single.kind])+(single.confirmed!=null?' · Your label: '+kinds[single.confirmed]:''):
      selected.size+' markers selected';
    canvas.hidden=!hasFrame;if(!hasFrame)return;ctx.drawImage(frame,0,0);
    if(painting){ctx.save();ctx.globalAlpha=.5;ctx.drawImage(mask,0,0);ctx.restore();return}
    if(live){const g=guide(canvas.width,canvas.height);ctx.save();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.setLineDash([7,4]);ctx.strokeRect(g.x,g.y,g.width,g.height);ctx.restore()}
    hits.forEach((h,i)=>{
      ctx.beginPath();ctx.ellipse(h.x,h.y,h.rx||h.r,h.ry||h.r,0,0,Math.PI*2);
      ctx.strokeStyle='#272039';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle=colours[reviewedKind(h)];ctx.lineWidth=2;ctx.stroke();
      if(selected.has(i)){ctx.setLineDash([3,2]);ctx.strokeRect(h.x-h.r-2,h.y-h.r-2,2*h.r+4,2*h.r+4);ctx.setLineDash([])}
      ctx.font='bold 11px sans-serif';ctx.lineWidth=3;ctx.strokeStyle='#14202c';ctx.strokeText(i+1,h.x+2,h.y);ctx.fillStyle=colours[reviewedKind(h)];ctx.fillText(i+1,h.x+2,h.y)
    });
  }
  function analyse(image){
    clearReview();
    const w=image.videoWidth||image.naturalWidth||image.width,h=image.videoHeight||image.naturalHeight||image.height;if(!w||!h)return;
    const s=Math.min(1,(live?680:1440)/Math.max(w,h));frame.width=canvas.width=Math.max(1,Math.round(w*s));frame.height=canvas.height=Math.max(1,Math.round(h*s));
    fctx.drawImage(image,0,0,frame.width,frame.height);hasFrame=true;
    if(!live){startArea(true);return}
    const g=guide(frame.width,frame.height);
    inside=(x,y,rx=0,ry=0)=>x-rx>=g.x&&x+rx<=g.x+g.width&&y-ry>=g.y&&y+ry<=g.y+g.height;
    const found=detect(fctx.getImageData(0,0,frame.width,frame.height),inside);
    hits=stabilise(found,hits);counted=true;active=-1;display();
  }
  async function photo(src){const img=new Image();img.src=src;await img.decode();return img}
  function error(e){return e?.message||String(e)}
  by('stone-live').onclick=async()=>{
    stop();painting=false;counted=false;hits=[];hasFrame=false;live=true;const run=revision;by('stone-live').disabled=true;note.textContent='Starting camera…';
    try{
      if(bridge)await bridge.postMessage({op:'startStoneCamera'});
      else{
        const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
        if(run!==revision){media.getTracks().forEach(t=>t.stop());return}
        stream=media;video.srcObject=media;await video.play();
      }
      if(run!==revision)return;
      by('stone-freeze').hidden=false;display();note.textContent='Position the jewellery inside the dashed guide. Freeze to paint its exact outline.';
      async function tick(){if(run!==revision)return;try{
        let img=video;if(bridge){const jpg=await bridge.postMessage({op:'stoneFrame'});img=jpg?await photo('data:image/jpeg;base64,'+jpg):null}
        if(run!==revision)return;if(img)analyse(img);timer=setTimeout(tick,450);
      }catch(e){if(run===revision){stop();display();note.textContent=error(e)}}}tick();
    }catch(e){if(run===revision){stop();display();note.textContent='Camera unavailable. Use Take photo or Upload. '+error(e)}}
  };
  by('stone-freeze').onclick=()=>{stop();startArea(true)};
  for(const id of ['stone-file','stone-capture']){
    by(id).onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;
      stop();const run=revision,url=URL.createObjectURL(file);try{const img=await photo(url);if(run!==revision)return;analyse(img)}catch{if(run===revision)note.textContent='Could not read that photo. Try JPEG or PNG.'}finally{URL.revokeObjectURL(url)}};
  }
  canvas.onclick=e=>{if(live||!counted||painting)return;const b=canvas.getBoundingClientRect(),x=(e.clientX-b.left)*canvas.width/b.width,y=(e.clientY-b.top)*canvas.height/b.height;
    const nearest=hits.map((h,i)=>({i,d:Math.hypot(x-h.x,y-h.y),r:h.r})).sort((a,b)=>a.d-b.d)[0];
    if(mode.value==='add'){
      if(inside&&!inside(x,y)){note.textContent='That point is outside the selected jewellery.';return}
      remember();active=hits.length;hits.push({x,y,r:6,kind:3,confirmed:Number(group.value),manual:true});selected=new Set([active]);mode.value='one';
    }else if(nearest&&nearest.d<=Math.max(7*canvas.width/b.width,nearest.r*1.1)){
      pick(nearest.i);return;
    }
    display();
  };
  function pick(i){
    if(i<0||i>=hits.length)return;
    active=i;
    if(mode.value==='multi'){if(selected.has(i))selected.delete(i);else selected.add(i)}
    else {mode.value='one';selected=new Set([i])}
    display();
  }
  mode.onchange=()=>{selected.clear();active=-1;display()};
  by('stone-markers').onchange=e=>pick(Number(e.target.value));
  by('stone-similar').onclick=()=>{
    const pixels=fctx.getImageData(0,0,frame.width,frame.height);
    const examples=[...selected].map(i=>signature(pixels,hits[i]));
    hits.forEach((h,i)=>{const candidate=signature(pixels,h);if(examples.some(e=>resembles(candidate,e)))selected.add(i)});
    mode.value='multi';active=-1;display();note.textContent='Review highlighted matches, choose their material, then tap Apply category.';
  };
  by('stone-all').onclick=()=>{
    mode.value='multi';selected=new Set(hits.map((_,i)=>i));active=-1;group.value='4';display();
  };
  by('stone-apply').onclick=()=>{
    if(!selected.size)return;remember();hits=assign(hits,selected,Number(group.value));
    note.textContent='Updated '+selected.size+' marker(s).';display();
  };
  by('stone-undo').onclick=()=>{if(!undo)return;hits=undo;undo=null;selected.clear();active=-1;display()};
  by('stone-remove').onclick=()=>{if(selected.size!==1)return;remember();hits.splice([...selected][0],1);selected.clear();active=-1;display()};
  by('open-stones').onclick=()=>{dialog.showModal();display()};
  dialog.addEventListener('close',()=>{stop();painting=false;counted=false;pointer=null;inside=null;clearReview();hasFrame=false;hits=[];active=-1;by('sw-gross').value='';inputs.forEach(r=>{r.mass.value='';r.unit.value='g'});note.textContent='';display()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&live){stop();startArea(true);note.textContent='Camera paused. Paint over the jewellery to review this frame.'}});
  window.addEventListener('pagehide',stop);
}
