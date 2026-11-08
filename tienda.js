const shop = (() => {
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const split=v=>String(v||'').split(/[|;,]/).map(s=>s.trim()).filter(Boolean);
 const parseUS=value=>{
  const match=/^\s*(\d{1,2}(?:[.,]5)?)([CY])?\s*(?:US)?\s*(?:[-–]\s*\d{2}(?:[.,]\d+)?\s*CM)?$/i.exec(value);
  if(!match)return '';
  const n=Number(match[1].replace(',','.'));
  return n>0&&n<=22?String(n)+(match[2]||'').toUpperCase():'';
 };
 const fresh=p=>!p.cotizado||Date.parse(p.vence)>=Date.now();
 const us=p=>fresh(p)?[...new Set((p.us?.length?p.us:(p.talles||[]).filter(s=>/US|^[\d.]+[CY]$/i.test(s))).map(parseUS).filter(Boolean))]:[];
 const labels=p=>!fresh(p)||p.sinTalle?[]:(p.us?.length?us(p).map(s=>'US '+s):(p.talles||[]).filter(t=>t&&t!=='-'));
 const brand=p=>({nike:'Nike',adidas:'Adidas',puma:'Puma',jordan:'Jordan','under armour':'Under Armour'})[key(/^(nike|adidas|puma|jordan|under armour)\b/i.exec(p.nombre||'')?.[1]||p.marca)]||p.marca||'';
 const lines=[['G.T. Cut',/\bg\s*t\s*cut/],['G.T. Hustle',/\bg\s*t\s*hustle/],['LeBron',/\blebron/],['Giannis',/\b(giannis|freak|immortality|inmortality)/],['Ja',/\bja\s*(?:morant|\d)/],['KD',/\b(kd\s*\d|kevin durant)/],['Kobe',/\bkobe/],['Sabrina',/\bsabrina/],['Jordan',/\b(jordan|luka|tatum|heir|zion)/],['Book',/\bbook\s*\d/],['Curry',/\bcurry/]];
 const line=p=>p.linea||lines.find(([,re])=>re.test(key([p.nombre,p.modelo].join(' '))))?.[0]||'';
 const available=p=>p.section==='pedido'?(p.estado==='proximamente'?'Próximamente USA':p.estado==='agotado'?'Agotado en USA':'A pedido USA'):(p.stock!==''&&p.stock!=null&&Number(p.stock)===0?'Agotado':'En stock · Bahía Blanca');
 function cdn(url,w){
  const match=/^(https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/)(v\d+\/[^?#]+)$/.exec(url);
  return match?match[1]+'c_limit,w_'+w+'/q_auto/f_auto/'+match[2]:url;
 }
 function picture(url,alt,w=640,eager=false,cls=''){
  if(!url)return '';
  const options=w>640?[480,800,1200]:w<=160?[80,160]:[320,640,960];
  const responsive=cdn(url,w)!==url?' srcset="'+esc(options.map(n=>cdn(url,n)+' '+n+'w').join(', '))+'" sizes="'+(w<=160?'60px':w>640?'(max-width: 760px) 95vw, 50vw':'(max-width: 580px) 50vw, 320px')+'"':'';
  return '<img class="'+cls+'" src="'+esc(cdn(url,w))+'"'+responsive+' alt="'+esc(alt)+'" decoding="async" '+(eager?'fetchpriority="high"':'loading="lazy"')+'>';
 }
 function images(root){
  root.querySelectorAll('img:not([data-photo])').forEach(img=>{
   img.dataset.photo='';const fail=()=>{img.hidden=true;};
   img.addEventListener('error',fail,{once:true});if(img.complete&&!img.naturalWidth)fail();
  });
 }
 let mode='all',limit=24,openProduct=null,returnTo=null,initial=new URLSearchParams(location.search).get('producto');
 const filterIDs=['Brand','Line','Size','Min','Max','Sort'];
 const control=name=>$('shoe'+name);
 function options(name,values,label){
  const field=control(name),previous=field.value;
  const choices=[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
  field.replaceChildren(new Option(label,''),...choices.map(v=>new Option(v,v)));field.value=choices.includes(previous)?previous:'';
 }
 function filters(){
  const visible=zapas.filter(p=>p.visible!==false);
  $('catRowZapas').innerHTML=[['all','Todas'],['stock','Stock local'],['pedido','A pedido USA']].map(([id,label])=>'<button type="button" class="cat-btn'+(id===mode?' active':'')+'" data-shoe-mode="'+id+'" aria-pressed="'+(id===mode)+'">'+label+' <span class="count">'+visible.filter(p=>id==='all'||p.section===id).length+'</span></button>').join('');
  const items=visible.filter(p=>mode==='all'||p.section===mode);
  options('Brand',items.map(brand),'Todas');
  options('Line',items.map(line),'Todas');
  options('Size',items.flatMap(us).map(s=>'US '+s),'Todos');
 }
 function grid(){
  const query=key($('searchZapas').value).split(' ').filter(Boolean),min=control('Min').valueAsNumber,max=control('Max').valueAsNumber;
  const selectedBrand=control('Brand').value,selectedLine=control('Line').value,selectedSize=control('Size').value,sort=control('Sort').value;
  const items=zapas.filter(p=>{
   if(p.visible===false||mode!=='all'&&p.section!==mode||selectedBrand&&brand(p)!==selectedBrand||selectedLine&&line(p)!==selectedLine||selectedSize&&!us(p).includes(selectedSize.slice(3)))return false;
   const price=productPrices(p).actual;
   if(Number.isFinite(min)&&(!price||price<min)||Number.isFinite(max)&&(!price||price>max))return false;
   const value=key([p.nombre,p.modelo,p.color,p.sku,brand(p),line(p)].join(' '));
   return query.every(term=>value.includes(term));
  });
  items.sort((a,b)=>{
   if(!sort)return Number(a.section==='pedido')-Number(b.section==='pedido');
   const x=productPrices(a).actual,y=productPrices(b).actual;
   return !x||!y?Number(!x)-Number(!y):sort==='asc'?x-y:y-x;
  });
  $('resultsZapas').textContent=items.length+' zapatilla'+(items.length===1?'':'s');
  $('shoeMore').hidden=items.length<=limit;
  $('gridZapas').innerHTML=items.slice(0,limit).map(p=>{
   const media=picture(productImages(p)[0],p.nombre,640,false,'card-img');
   const details=[brand(p),p.color,p.genero].filter(Boolean).map(esc).join(' · ');
   const sizes=labels(p).slice(0,4).map(s=>'<span class="size-pill">'+esc(s)+'</span>').join('');
   return '<article class="card shoe-card"><div class="card-img-wrap"><span class="card-cat-badge">'+available(p)+'</span><span class="shoe-empty">Foto en preparación</span>'+media+'</div><div class="card-body"><h2 class="card-title"><button data-shoe="'+zapas.indexOf(p)+'" type="button">'+esc(p.nombre)+'</button></h2><div class="card-meta">'+details+'</div>'+productPriceHtml(p)+(p.caja!==false?'<p class="shoe-box">Incluye caja original</p>':'')+'<div class="card-sizes">'+sizes+'</div></div></article>';
  }).join('')||'<p class="empty-state">No encontramos zapatillas con esos filtros.</p>';
  images($('gridZapas'));
 }
 function browse(next){
  mode=next;limit=24;setView('zapas');filters();grid();
 }
 function boot(){
  $('catRowZapas').addEventListener('click',e=>{
   const button=e.target.closest('[data-shoe-mode]');if(!button)return;
   mode=button.dataset.shoeMode;limit=24;filters();grid();
   $('catRowZapas').querySelector('[data-shoe-mode="'+mode+'"]').focus();
  });
  $('gridZapas').addEventListener('click',e=>{
   const button=e.target.closest('.shoe-card')?.querySelector('[data-shoe]');if(button)openModal('zapas',Number(button.dataset.shoe));
  });
  filterIDs.forEach(name=>control(name).addEventListener('input',()=>{limit=24;grid();}));
  $('shoeReset').onclick=()=>{filterIDs.forEach(name=>control(name).value='');$('searchZapas').value='';$('clearZapas').classList.remove('show');mode='all';limit=24;filters();grid();$('searchZapas').focus();};
  $('shoeMore').onclick=()=>{const before=limit;limit+=24;grid();$('gridZapas').querySelectorAll('[data-shoe]')[before]?.focus();};
  $('shoeWhatsApp').onclick=()=>{
   if(!openProduct)return;
   const size=$('cartSize').value;
   if(!size){showToast('Elegí un talle');$('cartSize').focus();return;}
   const p=openProduct,price=productPrices(p).actual;
   track('whatsapp_consult',p);
   openWhatsAppChooser(['Hola, quiero consultar por estas zapatillas.', 'Modelo: '+p.nombre,'Color: '+(p.color||'a confirmar'),'Talle: '+(size==='Sin talle'?'a confirmar':size),'Precio: '+(price?fmtPrecio(price):'a confirmar'),p.section==='pedido'?'Modalidad: A pedido USA':'Modalidad: stock local'].join('\n'));
   $('waPedro').focus();
  };
  $('modalBg').addEventListener('keydown',e=>{
   if(e.key!=='Tab'||document.querySelector('#waChooser.show,#shoeZoom[open]'))return;
   const nodes=[...$('modalBg').querySelectorAll('button:not(:disabled),a[href],select,summary')].filter(el=>el.getClientRects().length);
   if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}
   if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}
  });
  $('shoeZoom').addEventListener('close',()=>$('shoeZoom').querySelector('img').removeAttribute('src'));
 }
 function gallery(p){
  const root=$('mIcon'),items=productImages(p);let index=0,start=null,swiped=false;
  root.innerHTML=items.length?'<button type="button" class="shoe-zoom" aria-label="Ampliar foto"></button><div class="shoe-thumbs" role="group" aria-label="Fotos del producto"></div>':'<div class="shoe-no-image">Foto en preparación</div>';
  if(!items.length)return;
  const zoom=root.querySelector('.shoe-zoom'),thumbs=root.querySelector('.shoe-thumbs');
  function show(next){
   index=(next+items.length)%items.length;
   zoom.innerHTML='<span class="shoe-empty">Foto en preparación</span>'+picture(items[index],p.nombre+' · foto '+(index+1),960,true);
   [...thumbs.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));images(zoom);
  }
  if(items.length>1)items.forEach((url,i)=>{
   const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Ver foto '+(i+1));b.innerHTML=picture(url,'',120);b.onclick=()=>show(i);thumbs.append(b);
  });
  zoom.onpointerdown=e=>{if(e.pointerType==='touch'){start=e.clientX;swiped=false;}};
  zoom.onpointercancel=()=>{start=null;};
  zoom.onpointerup=e=>{if(start!==null&&items.length>1&&Math.abs(e.clientX-start)>42){swiped=true;show(index+(e.clientX<start?1:-1));}start=null;};
  zoom.onkeydown=e=>{if(items.length>1&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();show(index+(e.key==='ArrowRight'?1:-1));}};
  zoom.onclick=()=>{if(swiped){swiped=false;return;}if(zoom.querySelector('img')?.hidden)return;const dialog=$('shoeZoom');const img=dialog.querySelector('img');img.src=cdn(items[index],1600);img.alt=p.nombre;dialog.showModal();};
  show(0);images(thumbs);
 }
 const charts=[['Nike hombre','calzado-de-hombre'],['Nike mujer','calzado-de-mujer'],['Nike niños','calzado-para-ninos']];
 function sizeGuide(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  const rows=raw.split(/\r?\n/).map(row=>row.split('|').map(cell=>cell.trim()));
  if(!rows.every(row=>row.length===3&&row.every(Boolean)))return '<p>'+esc(raw)+'</p>';
  return '<table class="shoe-size-table"><thead><tr><th scope="col">US</th><th scope="col">AR</th><th scope="col">Largo del pie (cm)</th></tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 }
 function details(p){
  const order=p.section==='pedido';
  const date=String(p.revisado||'').slice(0,10);
  const nike=/^https:\/\/(?:www\.)?nike\.com\/t\/[^\s"'<>]+$/i.test(p.nike||'')?'<a target="_blank" rel="noopener" href="'+esc(p.nike)+'">Ver en Nike US</a>':'';
  const source=[Number(p.usd)>0?'Referencia en Nike US: USD '+Number(p.usd).toLocaleString('es-AR'):'',/^\d{4}-\d{2}-\d{2}$/.test(date)?'Revisado el '+date.split('-').reverse().join('/'):'',nike].filter(Boolean).join(' · ');
  return (p.caja!==false?'<p><strong>Incluye caja original</strong></p>':'')+
   (order?'<p>Señás el 50% cuando confirmamos el pedido. Pagás el saldo al llegar. Demora aproximada de 30 días.</p>':'')+
   (order&&(p.sinTalle||!fresh(p)||!productPrices(p).actual)?'<p>Confirmá talle, disponibilidad y precio por WhatsApp.</p>':'')+
   (order&&source?'<p>'+source+'</p>':'')+
   '<details><summary>Guía de talles</summary><p>Medí el pie del talón al dedo más largo. Si tu talle figura en AR, pasanos los centímetros para confirmar la equivalencia del modelo.</p>'+
   sizeGuide(p.guia)+(['Nike','Jordan'].includes(brand(p))?'<p>'+charts.map(([label,link])=>'<a target="_blank" rel="noopener" href="https://www.nike.com/us/es/size-fit/'+link+'">'+label+'</a>').join(' · ')+'</p>':'')+'</details>'+
   (p.materiales?'<details><summary>Materiales</summary><p>'+esc(p.materiales)+'</p></details>':'')+
   '<details><summary>Envíos y cambios</summary><p>Hacemos envíos a todo el país. Pasanos tu código postal para cotizar. Consultanos las condiciones de cambio antes de comprar.</p></details>';
 }
 function track(event,p){
  const item={item_id:String(p.id||p.nombre),item_name:p.nombre};
  if(typeof window.gtag==='function')window.gtag('event',event,event==='view_item'?{items:[item]}:item);
  if(typeof window.fbq==='function')window.fbq('trackCustom',event,item);
 }
 const titles={home:'Showtime Sport Store',zapas:'Zapatillas de básquet',local:'Indumentaria deportiva',etnia:'ETNIA',promos:'Promociones',confeccion:'Confección para clubes',mayorista:'Venta mayorista'};
 function meta(view){
  const title=(titles[view]||titles.home)+' · Bahía Blanca';
  const desc=view==='home'?'Zapatillas de básquet, indumentaria y confección en Bahía Blanca.':(titles[view]||titles.home)+' en Showtime Sport Store, Bahía Blanca.';
  document.title=title;document.querySelector('meta[name="description"]').content=desc;
  document.querySelector('meta[property="og:title"]').content=title;document.querySelector('meta[property="og:description"]').content=desc;
  const url='https://showtimesportstore.com.ar/'+(view==='home'?'':'?vista='+view);
  document.querySelector('link[rel="canonical"]').href=url;document.querySelector('meta[property="og:url"]').content=url;
 }
 function modal(p,type){
  returnTo=document.activeElement;openProduct=type==='zapas'?p:null;
  $('modalBg').dataset.shoe=String(Boolean(openProduct));gallery(p);$('shoeWhatsApp').hidden=!openProduct;$('shoeDetails').innerHTML=openProduct?details(p):'';
  if(!openProduct)return;
  $('mMeta').textContent=[brand(p),p.color,available(p)].filter(Boolean).join(' · ');
  const url=new URL(location.href);url.searchParams.set('vista','zapas');url.searchParams.set('producto',p.id||p.slug||p.nombre);
  history.replaceState(null,'',url);document.title=p.nombre+' · Showtime Bahía Blanca';
  const offer=productPrices(p).actual;
  const schema={'@context':'https://schema.org','@type':'Product',name:p.nombre};
  if(p.descripcion)schema.description=p.descripcion;
  if(brand(p))schema.brand={'@type':'Brand',name:brand(p)};
  if(p.sku)schema.sku=p.sku;
  if(productImages(p).length)schema.image=productImages(p).filter(x=>/^https:/.test(x));
  if(offer>0)schema.offers={'@type':'Offer',price:offer,priceCurrency:'ARS',url:'https://showtimesportstore.com.ar/'+url.search,availability:'https://schema.org/'+(p.section==='pedido'?'PreOrder':available(p)==='Agotado'?'OutOfStock':'InStock')};
  $('shoeSchema').textContent=JSON.stringify(schema);
  track('view_item',p);
 }
 function closed(){
  if(openProduct){
   const url=new URL(location.href);url.searchParams.delete('producto');history.replaceState(null,'',url);meta(url.searchParams.get('vista')||'home');
  }
  openProduct=null;$('shoeSchema').textContent='';returnTo?.focus();returnTo=null;
 }
 function linked(){
  if(!initial)return;
  const idx=zapas.findIndex(p=>p.visible!==false&&[p.id,p.slug,p.nombre].some(x=>String(x||'')===initial));
  if(idx>=0){initial=null;if(!$('view-zapas').classList.contains('active'))setView('zapas');openModal('zapas',idx);}
 }
 function home(){
  const options=zapas.filter(p=>p.section==='stock'&&p.visible!==false&&available(p)!=='Agotado'&&productImages(p).length);
  const featured=options.filter(p=>p.destacado);
  const chosen=featured[0]||options.find(p=>productPrices(p).actual)||options[0];
  const button=$('shoeHeroPhoto'),url=chosen?productImages(chosen)[0]:'';
  if(button.dataset.url!==url||button.dataset.name!==chosen?.nombre){
   button.dataset.url=url;button.dataset.name=chosen?.nombre||'';button.hidden=!chosen;
   button.innerHTML=chosen?'<span class="shoe-empty">Foto en preparación</span>'+picture(url,chosen.nombre,960,true)+'<span class="shoe-hero-caption">'+esc(chosen.nombre)+'</span>':'';
   images(button);
  }
  button.onclick=()=>{if(chosen){browse('stock');openModal('zapas',zapas.indexOf(chosen));}};
  const now=Date.now();
  const recent=options.filter(p=>{const t=Date.parse(p.ingreso);return t<=now&&now-t<=30*86400000;}).sort((a,b)=>Date.parse(b.ingreso)-Date.parse(a.ingreso));
  [['shoeFeatured',featured],['shoeRecent',recent]].forEach(([id,list])=>{
   const section=$(id);section.hidden=!list.length;
   const root=section.querySelector('.shoe-feature-list');
   root.innerHTML=list.slice(0,4).map(p=>'<button type="button" data-item="'+zapas.indexOf(p)+'">'+picture(productImages(p)[0],p.nombre,640)+'<strong>'+esc(p.nombre)+'</strong></button>').join('');
   root.onclick=e=>{const item=e.target.closest('[data-item]');if(item){browse('stock');openModal('zapas',Number(item.dataset.item));}};
   images(root);
  });
 }
 return {boot,grid,filters,browse,labels,split,fresh,modal,closed,linked,home,meta};
})();
