import {linkedCode} from './stripe-id.mjs';
import {setupTemplate} from './template-editor.mjs';
import {encodeItem} from './payload.mjs';
import {money,readField} from '../price.mjs';
import {writeSymbol} from './write-symbol.mjs';
import {stockLabels,rectangularLabels} from './stock-label.mjs';
import {labelDetails} from './label-details.mjs';
import {setupPrinter} from '../printing/panel.mjs';
import {rasterizeLabel} from '../printing/label-command.mjs';

const byId=id=>document.getElementById(id);
export function setupMaker(getItem,reportError) {
  const dialog=byId('make-dialog'),preview=byId('tag-preview'),paper=byId('tag-print-sheet');
  const save=byId('save-tag'),print=byId('browser-print-tag'),feedback=byId('make-feedback');
  const pageSelect=byId('tag-page'),pageControl=byId('tag-page-control');
  const heightInput=byId('label-height');
  try {const saved=Number(localStorage.getItem('ogj-rectangle-height'));if(Number.isInteger(saved)&&saved>=20&&saved<=100)heightInput.value=String(saved);} catch {}
  const pageStyle=document.createElement('style');document.head.append(pageStyle);
  let item,revision=0,imageURLs=[],printable=false,format='rectangle',heightMM=25;
  const template=setupTemplate(()=>render());
  const designed=()=>format==='custom'||template.isBuilt(format);
  async function makeLabels(symbol,px){
    if(!designed())return format==='rectangle'?rectangularLabels(symbol,item,heightMM,px):stockLabels(symbol,item,px);
    const labels=await template.render(symbol,item,px);
    if(symbol.striped && byId("stripe-companion").checked){
      // The companion QR carries the complete item for a different device.
      const full=await writeSymbol(encodeItem(item),'qr');
      const {widthMM:w,heightMM:h}=labels[0], side=Math.min(h-1,w-11,32);
      const dots=Math.floor(side*8/full.modules), size=dots*full.modules/8;
      const canvas=document.createElement('canvas');canvas.width=Math.round(w*px);canvas.height=Math.round(h*px);
      const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
      const img=new Image(),url=URL.createObjectURL(full.blob);
      try{img.src=url;await img.decode();ctx.imageSmoothingEnabled=false;
        const n=Math.round(size*px);ctx.drawImage(img,Math.round((canvas.width-n)/2),Math.round((canvas.height-n)/2),n,n)
      }finally{URL.revokeObjectURL(url)}
      const blob=await new Promise(r=>canvas.toBlob(r));if(!blob)throw Error('Could not export full-data QR.');
      labels.push({blob,widthMM:w,heightMM:h,thermalFits:dots>=1,warning:dots<1?'Increase the template height to fit the companion QR.':''});
    }
    return labels;
  }
  async function currentSymbol(){
    const payload=encodeItem(item);
    if(designed()&&template.isBar()){
      const symbol=await writeSymbol(linkedCode(payload),'stripe-label');return {...symbol,striped:true}
    }
    return writeSymbol(payload,format);
  }
  const printer=setupPrinter(async reverse=>{
    const labels=await makeLabels(await currentSymbol(),8);
    return Promise.all(labels.map(label=>rasterizeLabel(label.blob,{format:designed()?'custom':format,reverse})));
  },busy=>{
    dialog.querySelector('.format-picker').disabled=busy;
    heightInput.disabled=busy;
    byId('custom-editor').disabled=busy;
    print.disabled=busy || !printable;
  });
  function releaseImages() {
    imageURLs.forEach(url=>URL.revokeObjectURL(url));imageURLs=[];
    paper.replaceChildren();pageControl.hidden=true;
  }
  function selectPage() {
    const index=Number(pageSelect.value) || 0;
    preview.src=imageURLs[index];
    if(designed())template.showPage(index);
    preview.alt=['label','rectangle'].includes(format) ? `Jewellery label ${index+1} of ${imageURLs.length}: individual embellishment weights and selected prices` : `${format==='qr'?'QR':'Code 128'} tag for ${item.carat}K, ${item.weight} grams`;
    save.href=imageURLs[index];
    save.download=`OmGanpati-${item.carat}K-${item.weight}g-${designed()?byId('cw').value+'x'+byId('ch').value+'mm':format==='rectangle'?`58x${heightMM}mm-horizontal`:format==='label'?'100x15mm':format==='qr'?'QR':'Code128'}${imageURLs.length>1?'-'+(index+1)+'-of-'+imageURLs.length:''}.png`;
  }
  pageSelect.addEventListener('change',selectPage);
  async function render() {
    const run=++revision;
    format=dialog.querySelector('input[name=tag-format]:checked').value;
    byId('custom-editor').hidden=format!=='custom';
    byId('stripe-companion-option').hidden=!(designed()&&template.isBar());
    byId('edit-built').hidden=!template.isBuilt(format);
    const isStock=designed()||['label','rectangle'].includes(format),measured=item.gross!==undefined;
    heightMM=Number(heightInput.value);
    byId('rectangle-size').hidden=format!=='rectangle';
    pageStyle.textContent='';
    save.removeAttribute('href');save.setAttribute('aria-disabled','true');
    releaseImages();printable=false;print.disabled=true;printer.setReady(false);printer.setLayout(format);
    document.body.classList.remove('printing-tag');preview.hidden=true;
    feedback.dataset.error='false';feedback.textContent='Preparing your tag…';
    byId('tag-item').textContent=item.name+' · '+item.carat+'K';
    byId('tag-weights').textContent=(measured?'Gross '+item.gross+' g · Less '+item.stoneWeight+' g · ':'')+'Net '+item.weight+' g';
    byId('tag-charges').textContent='Making '+item.making+'% · Embellishments '+money(readField('stone',item.stone).value)+' · GST '+item.gst+'%';
    byId('tag-embellishments').textContent='';
    if(isStock && !measured) {
      feedback.textContent='This older tag stores net weight only. Enter gross and embellishment weights in the calculator for a full label, or choose a code-only format.';return;
    }
    try {
      if(measured) byId('tag-embellishments').textContent=labelDetails(item).materials.map(material=>material.lines.join(' · ')).join('\n');
      const text=encodeItem(item);byId('label-data').textContent=text;
      const symbol=await currentSymbol();
      if(run!==revision)return;
      const labels=isStock?await makeLabels(symbol,designed()?12:40):[symbol];
      if(run!==revision || !dialog.open) return;
      if(isStock) pageStyle.textContent=`@page { size: ${labels[0].widthMM}mm ${labels[0].heightMM}mm; margin: 0; }`;
      if(format==='rectangle') {try {localStorage.setItem('ogj-rectangle-height',String(heightMM));} catch {}}
      imageURLs=labels.map(label=>URL.createObjectURL(label.blob));
      pageSelect.replaceChildren(...labels.map((_,i)=>new Option(`Label ${i+1} of ${labels.length}`,String(i))));
      pageControl.hidden=labels.length===1;
      pageSelect.value=String(Math.min(template.pageIndex(),labels.length-1));
      selectPage();
      const sheets=labels.map((label,i)=>{
        const image=new Image();image.src=imageURLs[i];image.className='print-tag-page';
        image.style.setProperty('--symbol-width',label.widthMM+'mm');
        return image;
      });
      paper.replaceChildren(...sheets);
      await Promise.all([preview.decode(),...sheets.map(image=>image.decode())]);
      if(run!==revision || !dialog.open) return;
      preview.hidden=false;save.removeAttribute('aria-disabled');
      printable=!(designed()&&template.needsSave());print.disabled=!printable;
      const fits=!(designed()&&template.needsSave()) && labels.every(label=>label.thermalFits!==false);
      printer.setReady(isStock && fits,(designed()&&template.needsSave()?'Save your edited template first.':'') || labels.find(l=>l.warning)?.warning || (!fits?'This item has too much QR data for the small thermal label. Shorten descriptions or choose a larger QR code.':''));
      byId('print-tag').textContent=labels.length>1?`Print ${labels.length}-label set`:'Print tag';
      byId('printer-test').textContent=labels.length>1?`Test 1 set (${labels.length} labels)`:'Test one tag';
      document.body.classList.add('printing-tag');
      feedback.textContent=designed()?(labels.find(l=>l.warning)?.warning || (template.needsSave()?'Save this edited template as a preset before printing.':(template.isBar()?'Code 128 uses this device’s item record. Select the companion QR for scanning on another device. ':'')+labels.length+' label(s) per set.')) : isStock ? (labels.length>1 ? `${labels.length} labels per set keep every embellishment readable. Each label repeats the item, total deduction and full QR data. Print sends the complete set; Save PNG saves the selected label. ` : 'Each embellishment shows its weight and selected rate or total. ')+(format==='rectangle'?`Horizontal · 58 × ${heightMM} mm. The shop details and QR stay together on each sticker.`:'100 × 15 mm; the fastening tail stays blank.') : 'Print at actual size, about '+Math.round(symbol.widthMM)+' × '+Math.round(symbol.heightMM)+' mm. '+(format==='linear'?'Choose QR for a smaller code.':'Keep the white border.');
    } catch(error) {
      if(run!==revision || !dialog.open) return;
      feedback.dataset.error='true';feedback.textContent=error.message || 'Could not prepare the tag. Try Create tag again.';
    }
  }
  byId('open-maker').addEventListener('click',()=>{
    try {item=getItem();} catch(error) {reportError(error);return;}
    dialog.querySelector('[value=shortQR]').checked=true;template.applyBase('shortQR');dialog.showModal();printer.open();render();
  });
  byId('edit-built').onclick=()=>{
    template.applyBase(format);dialog.querySelector('[value=custom]').checked=true;render()
  };
  dialog.querySelector('.format-picker').addEventListener('change',()=>{
    const id=dialog.querySelector('input[name=tag-format]:checked').value;
    if(template.isBuilt(id))template.applyBase(id);
    if(id==='custom')template.applyBase('legacy');
    render()
  });
  byId('stripe-companion').addEventListener('change',render);
  heightInput.addEventListener('input',render);
  print.addEventListener('click',()=>{if(!print.disabled) window.print();});
  dialog.addEventListener('close',()=>{
    if(dialog.open) return;
    printer.close();printable=false;printer.setReady(false);pageStyle.textContent='';
    revision++;releaseImages();document.body.classList.remove('printing-tag');
  });
}
