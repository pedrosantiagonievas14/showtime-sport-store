/** Private customer/order data. Never add these sheets to the public catalog. */
const COMMERCE_TABLES = {
 CLIENTES_WEB:['ID','Email','Nombre','Telefono','Ofertas_Email','Ofertas_WhatsApp','Consentimiento_En','Creado_En'],
 PEDIDOS_WEB:['ID','Cliente_ID','Solicitud_ID','Sucursal','Items_JSON','Total','Estado','Actualizado_En','Creado_En','Banco_JSON','Comprobante_ID','Version','Aviso_Pendiente'],
 AUDITORIA_PEDIDOS:['Pedido_ID','Desde','Hasta','Fecha','Operador'],
};
function commerceProps_(){return PropertiesService.getScriptProperties();}
function commerceEnabled_(){if(commerceProps_().getProperty('COMMERCE_ENABLED')!=='true')throw new Error('Los pedidos online todavía no están habilitados. Podés consultar por WhatsApp.');}
function commerceSheet_(name){
 if(!Object.prototype.hasOwnProperty.call(COMMERCE_TABLES,name))throw new Error('Tabla inválida.');
 const book=commerceBook_(),fields=COMMERCE_TABLES[name];let sheet=book.getSheetByName(name);
 if(!sheet){sheet=book.insertSheet(name);sheet.getRange(1,1,1,fields.length).setValues([fields]);sheet.setFrozenRows(1);}
 if(sheet.getRange(1,1,1,fields.length).getValues()[0].join('|')!==fields.join('|'))throw new Error('Revisar columnas de '+name+'.');
 return sheet;
}
function commerceRows_(name){
 const s=commerceSheet_(name),fields=COMMERCE_TABLES[name];if(s.getLastRow()<2)return [];
 return s.getRange(2,1,s.getLastRow()-1,fields.length).getValues().map((v,i)=>({row:i+2,...Object.fromEntries(fields.map((k,j)=>[k,v[j]]))}));
}
function commerceWrite_(name,data,row){
 const sheet=commerceSheet_(name),v=COMMERCE_TABLES[name].map(k=>safe_(data[k]??''));
 if(row)sheet.getRange(row,1,1,v.length).setValues([v]);else sheet.appendRow(v);
 SpreadsheetApp.flush();
}
function commerceHash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(b=>(b&255).toString(16).padStart(2,'0')).join('');}
function commerceSecret_(){let s=commerceProps_().getProperty('COMMERCE_SECRET');if(!s){s=Utilities.getUuid()+Utilities.getUuid();commerceProps_().setProperty('COMMERCE_SECRET',s);}return s;}
function commerceRandom_(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');}
function commerceEmail_(v){const e=String(v||'').trim().toLowerCase();if(e.length>160||!/^\S+@[^\s@]+\.[^\s@]+$/.test(e))throw new Error('Ingresá un mail válido.');return e;}
function commerceText_(v,min,max,label){const s=String(v||'').trim();if(s.length<min||s.length>max||/[\u0000-\u001f]/.test(s))throw new Error('Revisá '+label+'.');return s;}
function commerceBranches_(){
 const p=commerceProps_();
 return [{id:'brown',name:'Brown 153',phone:p.getProperty('CONTACT_BROWN_WA')||'',holder:p.getProperty('TRANSFER_BROWN_HOLDER')||'',alias:p.getProperty('TRANSFER_BROWN_ALIAS')||''},
 {id:'vm',name:'Garibaldi 243',phone:p.getProperty('CONTACT_VM_WA')||'',holder:p.getProperty('TRANSFER_VM_HOLDER')||'',alias:p.getProperty('TRANSFER_VM_ALIAS')||''}];
}
function commercePublic_(){const branches=commerceBranches_(),ready=commerceProps_().getProperty('COMMERCE_ENABLED')==='true'&&branches.every(b=>/^549\d{10}$/.test(b.phone));return {ok:true,version:1,enabled:ready&&commerceProps_().getProperty('COMMERCE_PUBLIC_ENABLED')==='true',testing:ready,branches:branches.map(b=>({id:b.id,name:b.name,phone:b.phone,transferAvailable:!!(b.alias&&b.holder)}))};}
function commerceThrottle_(key,max,seconds){const cache=CacheService.getScriptCache(),n=Number(cache.get(key)||0);if(n>=max)throw new Error('Alcanzaste el límite de intentos. Probá más tarde.');cache.put(key,String(n+1),seconds);}
function commerceRequestCode_(p){
 const email=commerceEmail_(p.email),name=commerceText_(p.name,2,80,'tu nombre'),phone=String(p.phone||'').replace(/[\s()+-]/g,'');
 if(!/^\d{10,15}$/.test(phone))throw new Error('Ingresá un teléfono con código de área.');
 return locked_(()=>{
  const cache=CacheService.getScriptCache(),emailKey=commerceHash_(email);
  commerceThrottle_('otp-email:'+emailKey,1,60);commerceThrottle_('otp-hour:'+emailKey,5,3600);commerceThrottle_('otp-global',30,3600);
  if(MailApp.getRemainingDailyQuota()<15)throw new Error('No podemos enviar el código ahora. Podés pedir por WhatsApp.');
  const id=commerceRandom_(),random=commerceHash_(commerceRandom_()+commerceSecret_()),code=String(parseInt(random.slice(0,10),16)%1000000).padStart(6,'0');
  const record={email,name,phone,emailOffers:p.emailOffers===true,waOffers:p.waOffers===true,hash:commerceHash_(id+code+commerceSecret_()),attempts:0};
  cache.put('otp:'+id,JSON.stringify(record),600);
  try{MailApp.sendEmail({to:email,subject:'Tu código de acceso a Showtime',body:'Tu código es '+code+'. Vence en 10 minutos. No lo compartas. Si no lo pediste, ignorá este mensaje.',name:'Showtime Sport Store'});}catch(e){cache.remove('otp:'+id);throw new Error('No pudimos enviar el código. Volvé a intentar más tarde.');}
  return {ok:true,challenge:id};
 });
}
function commerceVerifyCode_(p){
 if(!/^[a-f0-9]{64}$/.test(String(p.challenge))||!/^\d{6}$/.test(String(p.code)))throw new Error('Revisá el código de seis dígitos.');
 return locked_(()=>{
  const cache=CacheService.getScriptCache(),key='otp:'+p.challenge,record=JSON.parse(cache.get(key)||'null');
  if(!record||record.attempts>=5)throw new Error('El código venció. Pedí uno nuevo.');
  if(commerceHash_(p.challenge+p.code+commerceSecret_())!==record.hash){record.attempts++;cache.put(key,JSON.stringify(record),600);throw new Error('Código incorrecto.');}
  cache.remove(key);
  let member=commerceRows_('CLIENTES_WEB').find(r=>r.Email===record.email);
  if(!member){member={ID:Utilities.getUuid(),Email:record.email,Nombre:record.name,Telefono:record.phone,Ofertas_Email:record.emailOffers,Ofertas_WhatsApp:record.waOffers,Consentimiento_En:new Date().toISOString(),Creado_En:new Date().toISOString()};commerceWrite_('CLIENTES_WEB',member);}
  const token=commerceRandom_();cache.put('customer:'+commerceHash_(token),member.ID,21600);
  return {ok:true,token,customer:{name:member.Nombre,email:member.Email,phone:member.Telefono}};
 });
}
function commerceCustomer_(token){
 if(!/^[a-f0-9]{64}$/.test(String(token||'')))throw new Error('Volvé a ingresar a tu cuenta.');
 const id=CacheService.getScriptCache().get('customer:'+commerceHash_(token));
 const member=id&&commerceRows_('CLIENTES_WEB').find(r=>r.ID===id);if(!member)throw new Error('Tu sesión venció. Volvé a ingresar.');return member;
}
function commerceOrderView_(order){
 const canPay=['reservado','pago_a_verificar'].includes(order.Estado);
 return {id:order.ID,branch:order.Sucursal,items:JSON.parse(order.Items_JSON),total:Number(order.Total)||0,status:order.Estado,version:Number(order.Version),created:order.Creado_En,bank:canPay&&order.Banco_JSON?JSON.parse(order.Banco_JSON):null,receipt:!!order.Comprobante_ID,notificationPending:order.Aviso_Pendiente===true};
}
function commerceMe_(p){const c=commerceCustomer_(p.token);return {ok:true,customer:{name:c.Nombre,email:c.Email,phone:c.Telefono},preferences:{email:c.Ofertas_Email===true,whatsapp:c.Ofertas_WhatsApp===true},orders:commerceRows_('PEDIDOS_WEB').filter(r=>r.Cliente_ID===c.ID).slice(-100).reverse().map(commerceOrderView_)};}
function commercePreferences_(p){const c=commerceCustomer_(p.token);if(typeof p.emailOffers!=='boolean'||typeof p.waOffers!=='boolean')throw new Error('Revisá las preferencias.');return locked_(()=>{const current=commerceRows_('CLIENTES_WEB').find(r=>r.ID===c.ID);commerceWrite_('CLIENTES_WEB',{...current,Ofertas_Email:p.emailOffers,Ofertas_WhatsApp:p.waOffers,Consentimiento_En:new Date().toISOString()},current.row);return {ok:true};});}
function commerceItem_(item){
 const table={local:'LOCAL',zapas:'ZAPATILLAS',confeccion:'CONFECCION'}[item.type];if(!table)throw new Error('Este artículo requiere presupuesto por WhatsApp.');
 const found=read_(table).find(r=>String(r.row.ID)===String(item.id));const r=found&&found.row;
 if(!r||r.Visible===false)throw new Error('Un producto ya no está disponible. Revisá el carrito.');
 if(table==='CONFECCION'||/pedido|usa/i.test(String(r.Categoria)))throw new Error('Los pedidos USA y la confección se cotizan por WhatsApp.');
 const qty=Number(item.qty);if(!Number.isInteger(qty)||qty<1||qty>20)throw new Error('La cantidad debe ser de 1 a 20.');
 const stock=number_(r.Stock);if(Number.isFinite(stock)&&qty>stock)throw new Error('No alcanza el stock de '+r.Nombre+'.');
 const size=commerceText_(item.size,1,50,'el talle');
 const sizes=String(r.Talles_US||r.Talle||'').split(/[|;,]/).map(s=>s.trim()).filter(Boolean);
 if(sizes.length&&!sizes.includes(size)&&!sizes.some(s=>('US '+s)===size))throw new Error('El talle de '+r.Nombre+' cambió. Revisá el carrito.');
 const price=number_(r.Oferta_Activa?r.Precio_Oferta:r.Precio_Original);
 return {type:item.type,id:String(r.ID),name:String(r.Nombre),size,qty,price:Number.isFinite(price)&&price>0?price:0};
}
function commerceCreateOrder_(p){
 const customer=commerceCustomer_(p.token);
 if(!/^[a-f0-9-]{20,80}$/.test(String(p.requestId||'')))throw new Error('Volvé a abrir el pedido.');
 if(!commerceBranches_().some(b=>b.id===p.branch))throw new Error('Elegí la sucursal de retiro.');
 if(!Array.isArray(p.items)||!p.items.length||p.items.length>30)throw new Error('Revisá los productos del pedido.');
 const order=locked_(()=>{
  const orders=commerceRows_('PEDIDOS_WEB'),prior=orders.find(r=>r.Cliente_ID===customer.ID&&r.Solicitud_ID===p.requestId);if(prior)return prior;
  if(orders.filter(r=>r.Cliente_ID===customer.ID&&r.Estado==='solicitado').length>=3)throw new Error('Ya tenés pedidos pendientes de confirmación. Contactanos para revisarlos.');
  const merged=new Map();p.items.forEach(i=>{const k=[i.type,i.id,i.size].join('|'),old=merged.get(k);merged.set(k,{...i,qty:Number(i.qty)+(old?Number(old.qty):0)});});
  const items=[...merged.values()].map(commerceItem_);
  // Validate aggregate quantity across sizes as Stock is currently per product.
  const totals=new Map();items.forEach(i=>totals.set(i.type+'|'+i.id,(totals.get(i.type+'|'+i.id)||0)+i.qty));
  items.forEach(i=>commerceItem_({...i,qty:totals.get(i.type+'|'+i.id)}));
  const now=new Date().toISOString(),created={ID:'ST-'+Utilities.getUuid().slice(0,8).toUpperCase(),Cliente_ID:customer.ID,Solicitud_ID:p.requestId,Sucursal:p.branch,Items_JSON:JSON.stringify(items),Total:items.every(i=>i.price>0)?items.reduce((s,i)=>s+i.qty*i.price,0):0,Estado:'solicitado',Actualizado_En:now,Creado_En:now,Banco_JSON:'',Comprobante_ID:'',Version:1,Aviso_Pendiente:true};
  commerceWrite_('PEDIDOS_WEB',created);return commerceRows_('PEDIDOS_WEB').find(r=>r.ID===created.ID);
 });
 if(order.Aviso_Pendiente===true)commerceNotify_(order,customer,'Nuevo pedido para revisar y separar');
 return {ok:true,order:commerceOrderView_(commerceRows_('PEDIDOS_WEB').find(r=>r.ID===order.ID))};
}
function commerceNotify_(order,customer,subject){
 // Staff email is configured privately. WhatsApp below remains a customer-sent message.
 const recipient=commerceProps_().getProperty('ORDERS_EMAIL');if(!recipient)return;
 try{
  if(MailApp.getRemainingDailyQuota()<1)return;
  const branch=commerceBranches_().find(b=>b.id===order.Sucursal),items=JSON.parse(order.Items_JSON);
  MailApp.sendEmail({to:recipient,name:'Showtime Pedidos',subject:subject+' · '+order.ID+' · '+branch.name,body:'Pedido: '+order.ID+'\nSucursal: '+branch.name+'\nCliente: '+customer.Nombre+'\nMail: '+customer.Email+'\nTeléfono: '+customer.Telefono+'\nEstado: '+order.Estado+'\n\n'+items.map(i=>i.name+' · '+i.size+' · x'+i.qty).join('\n')+'\n\nTotal: '+(Number(order.Total)>0?'ARS '+order.Total:'A confirmar')+'\nRevisá el panel de pedidos. El comprobante no confirma el cobro.'});
  locked_(()=>{const current=commerceRows_('PEDIDOS_WEB').find(r=>r.ID===order.ID);if(current&&Number(current.Version)===Number(order.Version))commerceWrite_('PEDIDOS_WEB',{...current,Aviso_Pendiente:false},current.row);});
 }catch(e){/* Order remains durable and visible with pending notification. */}
}
function commerceReceipt_(p){
 const customer=commerceCustomer_(p.token);
 if(!['image/jpeg','image/png','application/pdf'].includes(p.mime)||typeof p.base64!=='string'||p.base64.length>2800000||!/^[A-Za-z0-9+/]*={0,2}$/.test(p.base64))throw new Error('Subí JPG, PNG o PDF de hasta 2 MB.');
 const result=locked_(()=>{
  const order=commerceRows_('PEDIDOS_WEB').find(r=>r.ID===p.orderId&&r.Cliente_ID===customer.ID);
  if(!order||order.Estado!=='reservado')throw new Error('El local debe confirmar la reserva antes de recibir el comprobante.');
  const folderId=commerceProps_().getProperty('RECEIPTS_FOLDER_ID');if(!folderId)throw new Error('Todavía no está habilitada la carga de comprobantes. Contactá al local.');
  const bytes=Utilities.base64Decode(p.base64);if(bytes.length>2097152)throw new Error('El archivo supera 2 MB.');
  const prefix=bytes.slice(0,5).map(b=>b&255);
  if(p.mime==='application/pdf'&&String.fromCharCode(...prefix)!=='%PDF-'||p.mime==='image/png'&&prefix.slice(0,4).join(',')!=='137,80,78,71'||p.mime==='image/jpeg'&&(prefix[0]!==255||prefix[1]!==216))throw new Error('El contenido del archivo no coincide con su formato.');
  const suffix={'image/jpeg':'jpg','image/png':'png','application/pdf':'pdf'}[p.mime];
  const file=DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes,p.mime,order.ID+'.'+suffix));
  if(file.getSharingAccess()!==DriveApp.Access.PRIVATE){file.setTrashed(true);throw new Error('La carpeta de comprobantes debe ser privada.');}
  const updated={...order,Estado:'pago_a_verificar',Comprobante_ID:file.getId(),Actualizado_En:new Date().toISOString(),Version:Number(order.Version)+1,Aviso_Pendiente:true};
  commerceWrite_('PEDIDOS_WEB',updated,order.row);return updated;
 });
 commerceNotify_(result,customer,'Comprobante recibido: verificar cobro');return {ok:true,order:commerceOrderView_(result)};
}
function commercePost_(e){
 try{
  if(!e.postData||e.postData.contents.length>2900000)throw new Error('Solicitud inválida.');
  const p=JSON.parse(e.postData.contents);
  if(p.action==='unsubscribe')return json_(ofertasUnsubscribe_(p));
  commerceEnabled_();
  const actions={requestCode:commerceRequestCode_,verifyCode:commerceVerifyCode_,me:commerceMe_,preferences:commercePreferences_,createOrder:commerceCreateOrder_,receipt:commerceReceipt_,logout:q=>{commerceCustomer_(q.token);CacheService.getScriptCache().remove('customer:'+commerceHash_(q.token));return {ok:true};}};
  if(!Object.prototype.hasOwnProperty.call(actions,p.action))throw new Error('Acción inválida.');return json_(actions[p.action](p));
 }catch(error){return json_({ok:false,error:String(error.message||'No pudimos procesar la solicitud.').slice(0,250)});}
}
function pedidosAdminList(token){auth_(token);return locked_(()=>{const clients=new Map(commerceRows_('CLIENTES_WEB').map(c=>[c.ID,c]));return {orders:commerceRows_('PEDIDOS_WEB').slice(-200).reverse().map(o=>({...commerceOrderView_(o),customer:clients.get(o.Cliente_ID),receiptUrl:o.Comprobante_ID?'https://drive.google.com/file/d/'+o.Comprobante_ID+'/view':null}))};});}
function pedidosAdminUpdate(token,p){
 auth_(token);const updated=locked_(()=>{
  const order=commerceRows_('PEDIDOS_WEB').find(r=>r.ID===p.id);if(!order)throw new Error('Pedido inexistente.');
  if(Number(p.version)!==Number(order.Version))throw new Error('Otro usuario actualizó este pedido. Recargá la lista.');
  const next={solicitado:['reservado','cancelado'],reservado:['pagado','cancelado'],pago_a_verificar:['pagado','reservado'],pagado:['listo'],listo:['entregado'],entregado:[],cancelado:[]};
  if(!(next[order.Estado]||[]).includes(p.status))throw new Error('Cambio de estado inválido.');
  const patch={...order,Estado:p.status,Version:Number(order.Version)+1,Actualizado_En:new Date().toISOString()};
  if(p.status==='reservado'){
   if(p.separated!==true)throw new Error('Confirmá que verificaste los talles y separaste la mercadería.');
   const bank=commerceBranches_().find(b=>b.id===order.Sucursal);if(!bank.alias||!bank.holder||!/^549\d{10}$/.test(bank.phone))throw new Error('Falta configurar la transferencia de esta sucursal.');
   const total=Number(p.total||order.Total);if(!Number.isFinite(total)||total<=0||total>100000000)throw new Error('Confirmá el importe total del pedido.');
   patch.Total=total;patch.Banco_JSON=JSON.stringify(bank);
   const held=commerceRows_('PEDIDOS_WEB').filter(o=>o.ID!==order.ID&&['reservado','pago_a_verificar','pagado','listo'].includes(o.Estado)).flatMap(o=>JSON.parse(o.Items_JSON));
   const items=JSON.parse(order.Items_JSON),sum=(arr,i)=>arr.filter(x=>x.type===i.type&&x.id===i.id).reduce((s,x)=>s+x.qty,0);
   for(const item of items){const table={local:'LOCAL',zapas:'ZAPATILLAS'}[item.type],entry=read_(table).find(r=>String(r.row.ID)===item.id);if(!entry||entry.row.Visible===false)throw new Error('Revisá el stock de '+item.name+'.');const stock=number_(entry.row.Stock);if(Number.isFinite(stock)&&sum(held,item)+sum(items,item)>stock)throw new Error('Ya hay reservas que consumen el stock de '+item.name+'.');}
  }
  // Catalog Stock is currently aggregate, not an inventory by size/store.
  // Staff verifies/separates physical units; this module never mutates catalog stock.
  commerceWrite_('PEDIDOS_WEB',patch,order.row);commerceWrite_('AUDITORIA_PEDIDOS',{Pedido_ID:order.ID,Desde:order.Estado,Hasta:p.status,Fecha:patch.Actualizado_En,Operador:'administración'});return patch;
 });return {ok:true,order:commerceOrderView_(updated)};
}
function commerceBook_(){const id=commerceProps_().getProperty("COMMERCE_SHEET_ID");if(!id)throw new Error("Falta preparar la base privada de pedidos.");return SpreadsheetApp.openById(id);}
function commerceOwner_(){const owner=Session.getEffectiveUser().getEmail();if(!owner||Session.getActiveUser().getEmail()!==owner)throw new Error("Esta operación se ejecuta únicamente desde el editor del propietario.");}
function prepararComercio(){commerceOwner_();return locked_(()=>{const p=commerceProps_();if(!p.getProperty("COMMERCE_SHEET_ID")){const book=SpreadsheetApp.create("Showtime · Clientes y pedidos");p.setProperty("COMMERCE_SHEET_ID",book.getId());}const file=DriveApp.getFileById(p.getProperty("COMMERCE_SHEET_ID"));if(file.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("La base de clientes y pedidos debe ser privada.");if(!p.getProperty("RECEIPTS_FOLDER_ID")){const folder=DriveApp.createFolder("Showtime · Comprobantes privados");p.setProperty("RECEIPTS_FOLDER_ID",folder.getId());}const folder=DriveApp.getFolderById(p.getProperty("RECEIPTS_FOLDER_ID"));if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("La carpeta de comprobantes debe ser privada.");Object.keys(COMMERCE_TABLES).forEach(commerceSheet_);Logger.log("Base de pedidos y carpeta de comprobantes preparadas de forma privada.");});}
function probarCorreoComercio(){commerceOwner_();const email=commerceEmail_(commerceProps_().getProperty("ORDERS_EMAIL"));MailApp.sendEmail({to:email,name:"Showtime Pedidos",subject:"Showtime · Prueba de avisos de pedidos",body:"Este mensaje confirma que la dirección del negocio puede recibir los avisos del sistema de pedidos. Es una prueba de configuración: no corresponde a una compra ni a un pago real."});Logger.log("Correo de prueba enviado al destinatario configurado.");}

