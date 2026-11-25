/* Customer accounts and transfer checkout. Enabled only by the configured server. */
(() => {
 'use strict';
 const API = typeof ADMIN_APP_URL==='string'?ADMIN_APP_URL:'';
 const $ = id=>document.getElementById(id);
 const escape = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money = n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
 const labels={solicitado:'Recibido · estamos revisando el stock',reservado:'Mercadería separada · podés transferir',pago_a_verificar:'Comprobante recibido · verificando el cobro',pagado:'Pago confirmado',listo:'Listo para retirar',entregado:'Entregado',cancelado:'Cancelado'};
 let config=null,token='',customer=null,challenge='',checkout=false,requestId='',previousFocus=null,poll=null,busy=false;
 try{token=sessionStorage.getItem('showtime.customer')||'';requestId=sessionStorage.getItem('showtime.orderRequest')||'';}catch(e){}
 const setStatus=(message,error=false)=>{const el=$('clubStatus');el.textContent=message;el.setAttribute('role',error?'alert':'status');};
 function newRequest(){requestId=crypto.randomUUID();try{sessionStorage.setItem('showtime.orderRequest',requestId);}catch(e){}}
 async function call(action,payload={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
  try{
   const response=await fetch(API,{method:'POST',credentials:'omit',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token,...payload}),signal:controller.signal});
   if(!response.ok)throw new Error('No pudimos conectar con Showtime.');
   const result=await response.json();if(!result.ok)throw new Error(result.error||'No pudimos completar la solicitud.');return result;
  }catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw new Error('No recibimos respuesta. Revisá tu conexión y reintentá. El pedido no se duplica si volvés a confirmar.');throw error;}
  finally{clearTimeout(timer);}
 }
 async function run(button,work){if(busy)return;busy=true;button.disabled=true;setStatus('Procesando…');try{await work();}catch(e){setStatus(e.message,true);}finally{busy=false;if(button.isConnected)button.disabled=false;}}
 function open(wantsCheckout=false){
  checkout=wantsCheckout;previousFocus=document.activeElement;$('clubDialog').showModal();clearInterval(poll);
  if(customer)account();else signup();
 }
 function close(){if(busy){setStatus('Esperá a que termine la solicitud.');return;}$('clubDialog').close();clearInterval(poll);try{localStorage.setItem('showtime.clubDismissed',String(Date.now()));}catch(e){}previousFocus?.focus();}
 function frame(title,body){$('clubTitle').textContent=title;$('clubBody').innerHTML=body;setStatus('');$('clubBody').querySelector('input,button,select')?.focus();}
 function signup(){
  frame('Tu cuenta Showtime',`<p class="club-intro">Tus pedidos y próximos retiros, en un mismo lugar.</p><form id="clubSignup"><label>Nombre y apellido<input name="name" autocomplete="name" minlength="2" maxlength="80" required></label><label>Mail<input name="email" type="email" autocomplete="email" maxlength="160" required></label><label>Teléfono con código de área<input name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="[0-9()+ \\-]{10,22}" required></label><fieldset><legend>Elegí si querés recibir ofertas</legend><label class="club-check"><input name="emailOffers" type="checkbox"> Por mail</label><label class="club-check"><input name="waOffers" type="checkbox"> Por WhatsApp</label></fieldset><p class="club-fine">Usamos tus datos para identificar tu cuenta y gestionar tus pedidos. Las ofertas son opcionales y podés dejar de recibirlas.</p><button class="club-primary" type="submit">Recibir código por mail</button></form><p class="club-fine">Si ya tenés cuenta, ingresá el mismo mail. No necesitás contraseña.</p>`);
  $('clubSignup').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);run(form.querySelector('button'),async()=>{const result=await call('requestCode',{name:data.get('name'),email:data.get('email'),phone:data.get('phone'),emailOffers:data.has('emailOffers'),waOffers:data.has('waOffers')});challenge=result.challenge;verify(data.get('email'));});});
 }
 function verify(email){
  frame('Revisá tu mail',`<p>Enviamos un código de seis dígitos a <strong>${escape(email)}</strong>. Vence en 10 minutos.</p><form id="clubVerify"><label>Código de acceso<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button class="club-primary">Ingresar</button></form><button class="club-text" id="clubRestart">Cambiar datos o pedir otro código</button>`);
  $('clubRestart').onclick=signup;
  $('clubVerify').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;run(f.querySelector('button'),async()=>{const result=await call('verifyCode',{challenge,code:new FormData(f).get('code')});token=result.token;customer=result.customer;try{sessionStorage.setItem('showtime.customer',token);}catch(e){}$('clubOpen').textContent='Mi cuenta';if(checkout)checkoutForm();else await account();});};
 }
 function cartItems(){return typeof cart!=='undefined'?cart.map(i=>({type:i.type,id:i.id,size:i.size,qty:i.qty})):[];}
 function checkoutForm(){
  const items=cartItems();if(!items.length){checkout=false;return account();}
  const original=typeof cart!=='undefined'?cart:[];
  const quoted=original.some(i=>{const p=cartProduct(i);return i.type==='confeccion'||p?.section==='pedido';});
  if(quoted){frame('Tu pedido requiere cotización','<p>Los equipos a medida y los pedidos USA se cotizan por WhatsApp. Confirmamos diseño, disponibilidad, precio y seña antes de pagar.</p><button id="clubQuote" class="club-primary">Consultar este pedido por WhatsApp</button>');$('clubQuote').onclick=()=>{close();sendCartToWhatsApp();};return;}
  frame('Elegí dónde retirás',`<p>Hola, ${escape(customer.name)}. Primero revisamos los talles y separamos tu pedido. Consultá tu cuenta para saber cuándo podés transferir.</p><div class="club-summary">${original.map(i=>`<p><strong>${escape(i.nombre)}</strong><br>Talle ${escape(i.size)} · ${i.qty} unidad${i.qty===1?'':'es'}</p>`).join('')}</div><form id="clubCheckout"><label>Sucursal de retiro<select name="branch" required><option value="">Elegí una sucursal</option>${config.branches.map(b=>`<option value="${escape(b.id)}">${escape(b.name)}</option>`).join('')}</select></label><p class="club-fine">El pedido queda pendiente hasta que el local confirme el stock y el importe. No transfieras antes de recibir esa confirmación.</p><button class="club-primary">Solicitar reserva</button></form>`);
  if(!requestId)newRequest();
  $('clubCheckout').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;run(f.querySelector('button'),async()=>{const result=await call('createOrder',{requestId,branch:new FormData(f).get('branch'),items});checkout=false;if(typeof cart!=='undefined'){cart=[];saveCart();}newRequest();await account(result.order.id);});};
 }
 function whatsapp(order){
  const branch=config.branches.find(b=>b.id===order.branch);
  const text='Hola, hice el pedido '+order.id+' en la web. Retiro en '+branch.name+'.\nCliente: '+customer.name+'\n'+order.items.map(i=>i.name+' · Talle '+i.size+' · x'+i.qty).join('\n')+'\nEstado: '+(labels[order.status]||order.status)+'.\n¿Me confirman cuando esté separado?';
  return 'https://wa.me/'+branch.phone+'?text='+encodeURIComponent(text);
 }
 function orderHTML(order,highlight){
  const branch=config.branches.find(b=>b.id===order.branch),pay=order.bank&&order.status==='reservado';
  return `<article class="club-order${order.id===highlight?' club-highlight':''}"><div class="club-order-title"><h3>${escape(order.id)}</h3><span>${escape(branch?.name||order.branch)}</span></div><p><strong>${escape(labels[order.status]||order.status)}</strong></p>${order.items.map(i=>`<p>${escape(i.name)} · ${escape(i.size)} · x${i.qty}</p>`).join('')}<p>Total ${order.status==='solicitado'?'estimado':''}: <strong>${order.total?money(order.total):'A confirmar'}</strong></p>${order.notificationPending?'<p class="club-alert">Tu pedido quedó registrado. El aviso al local está pendiente: escribinos para coordinar.</p>':''}${pay?`<section class="club-bank"><h4>Transferencia para este pedido</h4><p>Alias: <strong>${escape(order.bank.alias)}</strong></p><p>Titular: ${escape(order.bank.holder)}</p><p>Importe: <strong>${money(order.total)}</strong></p><button type="button" class="club-text" data-copy="${escape(order.bank.alias)}">Copiar alias</button><p class="club-fine">Comprobá alias, titular e importe en tu banco antes de transferir. Subir un comprobante no confirma el pago.</p><label>Comprobante JPG, PNG o PDF · hasta 2 MB<input type="file" accept="image/jpeg,image/png,application/pdf" data-receipt="${escape(order.id)}"></label></section>`:''}<a class="club-link" href="${escape(whatsapp(order))}" target="_blank" rel="noopener">Escribir al local por este pedido</a><p class="club-fine">WhatsApp se envía cuando lo confirmás en la aplicación.</p></article>`;
 }
 async function account(highlight=''){
  if(checkout)return checkoutForm();
  frame('Mi cuenta','<p>Cargando tus pedidos…</p>');
  try{
   const result=await call('me');customer=result.customer;
   frame('Hola, '+customer.name,`<div class="club-account-actions"><button type="button" id="clubRefresh">Actualizar pedidos</button><button type="button" class="club-text" id="clubLogout">Cerrar sesión</button></div><p class="club-fine">Entrá acá para consultar la reserva, ver los datos de transferencia y cargar el comprobante.</p><div id="clubOrders">${result.orders.length?result.orders.map(o=>orderHTML(o,highlight)).join(''):'<p>Todavía no tenés pedidos online. Podés empezar por el catálogo.</p>'}</div>`);
   const prefs=document.createElement('form');prefs.id='clubPreferences';prefs.innerHTML=`<details><summary>Preferencias de ofertas</summary><label class="club-check"><input name="emailOffers" type="checkbox" ${result.preferences?.email?'checked':''}>Recibir ofertas por mail</label><label class="club-check"><input name="waOffers" type="checkbox" ${result.preferences?.whatsapp?'checked':''}>Recibir ofertas por WhatsApp</label><button type="submit">Guardar preferencias</button></details>`;$('clubOrders').insertAdjacentElement('afterend',prefs);prefs.onsubmit=e=>{e.preventDefault();run(prefs.querySelector('button'),async()=>{const data=new FormData(prefs);await call('preferences',{emailOffers:data.has('emailOffers'),waOffers:data.has('waOffers')});setStatus('Preferencias guardadas.');});};
   $('clubRefresh').onclick=()=>account();$('clubLogout').onclick=()=>run($('clubLogout'),async()=>{await call('logout');token='';customer=null;try{sessionStorage.removeItem('showtime.customer');}catch(e){}$('clubOpen').textContent='Mi cuenta';signup();});
   document.querySelectorAll('[data-copy]').forEach(button=>button.onclick=()=>navigator.clipboard.writeText(button.dataset.copy).then(()=>setStatus('Alias copiado.')).catch(()=>setStatus('Seleccioná y copiá el alias.')));
   document.querySelectorAll('[data-receipt]').forEach(input=>input.onchange=()=>receipt(input));
  }catch(e){setStatus(e.message,true);if(/sesión|ingresar/.test(e.message)){token='';customer=null;signup();setStatus('Volvé a ingresar para ver tus pedidos.');}}
 }
 async function receipt(input){
  const file=input.files[0];if(!file)return;if(file.size>2097152||!['image/jpeg','image/png','application/pdf'].includes(file.type)){setStatus('Elegí JPG, PNG o PDF de hasta 2 MB.',true);input.value='';return;}
  await run(input,async()=>{const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(new Error('No pudimos leer el archivo.'));r.readAsDataURL(file);});await call('receipt',{orderId:input.dataset.receipt,mime:file.type,base64});await account();setStatus('Comprobante recibido. El local verificará el cobro.');});
 }
 async function init(){
  if(!API)return;
  try{const response=await fetch(API+'?action=commerce',{credentials:'omit'});config=await response.json();if(config.version!==1||(!config.enabled&&!(config.testing&&new URLSearchParams(location.search).get('prueba_cuenta')==='1')))return;}catch(e){return;}
  const dialog=document.createElement('dialog');dialog.id='clubDialog';dialog.className='club-dialog';dialog.setAttribute('aria-labelledby','clubTitle');dialog.innerHTML='<button type="button" class="club-close" aria-label="Cerrar">✕</button><p class="club-brand">SHOWTIME SPORT STORE</p><h2 id="clubTitle"></h2><div id="clubBody"></div><p id="clubStatus" role="status" aria-live="polite"></p>';
  document.body.appendChild(dialog);dialog.querySelector('.club-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close();});
  const button=document.createElement('button');button.id='clubOpen';button.type='button';button.className='club-open';button.textContent='Mi cuenta';button.onclick=()=>open();$('cartOpen').insertAdjacentElement('beforebegin',button);
  const transfer=document.createElement('button');transfer.type='button';transfer.className='cart-primary club-checkout';transfer.textContent='Pedir con transferencia';transfer.onclick=()=>{if(!cartItems().length){showToast('Tu carrito está vacío');return;}closeCart();open(true);};$('cartSend').insertAdjacentElement('beforebegin',transfer);
  if(token){try{const result=await call('me');customer=result.customer;}catch(e){token='';}}
  let dismissed=0;try{dismissed=Number(localStorage.getItem('showtime.clubDismissed')||0);}catch(e){}
  if(!customer&&Date.now()-dismissed>7*86400000)setTimeout(()=>{const other=document.querySelector('.modal-bg.show,.cart-backdrop.show,dialog[open]');if(!other&&document.visibilityState==='visible')open();},10000);
 }
 init();
})();
