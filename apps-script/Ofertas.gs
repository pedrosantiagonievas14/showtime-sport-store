/** Weekly promotional mail, within the existing free MailApp quota. No paid provider. */
const OFERTAS = {zone:'America/Argentina/Buenos_Aires',site:'https://showtimesportstore.com.ar/',reserve:25,batch:50,maxMillis:180000,fields:['Cliente_ID','Email_Hash','Semana','Estado','Intento_En','Enviado_En']};
function ofertasEscape_(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ofertasDate_(now){return Utilities.formatDate(now,OFERTAS.zone,'yyyy-MM-dd');}
function ofertasWeek_(day){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+3)%7));return d.toISOString().slice(0,10);}
function ofertasTable_(){const book=commerceBook_();let s=book.getSheetByName('OFERTAS_EMAIL');if(!s){s=book.insertSheet('OFERTAS_EMAIL');s.getRange(1,1,1,OFERTAS.fields.length).setValues([OFERTAS.fields]);s.setFrozenRows(1);}if(s.getRange(1,1,1,OFERTAS.fields.length).getValues()[0].join('|')!==OFERTAS.fields.join('|'))throw new Error('Revisar columnas de OFERTAS_EMAIL.');return s;}
function ofertasRows_(){const s=ofertasTable_();return s.getLastRow()<2?[]:s.getRange(2,1,s.getLastRow()-1,OFERTAS.fields.length).getValues().map((v,i)=>({row:i+2,...Object.fromEntries(OFERTAS.fields.map((k,j)=>[k,v[j]]))}));}
function ofertasWrite_(r){const s=ofertasTable_(),v=OFERTAS.fields.map(k=>safe_(r[k]??''));if(r.row)s.getRange(r.row,1,1,v.length).setValues([v]);else s.appendRow(v);SpreadsheetApp.flush();}
function ofertasProducts_(){
 return ['LOCAL','ZAPATILLAS'].flatMap(table=>read_(table).map(x=>({...x.row,section:table==='LOCAL'?'local':'zapas'})))
 .filter(r=>r.Visible!==false&&r.Oferta_Activa===true&&!/pedido|usa/i.test(String(r.Categoria))&&!(Number.isFinite(number_(r.Stock))&&number_(r.Stock)<=0)&&number_(r.Precio_Oferta)>0&&number_(r.Precio_Original)>number_(r.Precio_Oferta))
 .map(r=>({id:String(r.ID),name:String(r.Nombre),original:number_(r.Precio_Original),price:number_(r.Precio_Oferta),image:/^https:\/\//i.test(String(r.Imagen||''))?String(r.Imagen):'',section:r.section}))
 .sort((a,b)=>(1-b.price/b.original)-(1-a.price/a.original)).slice(0,4);
}
function ofertasToken_(id){return Utilities.computeHmacSha256Signature('ofertas-email:'+id,commerceSecret_()).map(b=>(b&255).toString(16).padStart(2,'0')).join('');}
function ofertasUnsubscribe_(p){
 if(!/^[a-f0-9-]{36}$/i.test(String(p.id||''))||!(/^[a-f0-9]{64}$/).test(String(p.signature||'')))throw new Error('El enlace de baja no es válido.');
 const expected=ofertasToken_(p.id);if(expected.split('').reduce((n,c,i)=>n|(c.charCodeAt(0)^p.signature.charCodeAt(i)),0))throw new Error('El enlace de baja no es válido.');
 return locked_(()=>{const member=commerceRows_('CLIENTES_WEB').find(r=>r.ID===p.id);if(member)commerceWrite_('CLIENTES_WEB',{...member,Ofertas_Email:false,Consentimiento_En:new Date().toISOString()},member.row);return {ok:true};});
}
function ofertasMessage_(member,products,testing){
 const esc=ofertasEscape_,money=n=>'$'+Math.round(n).toLocaleString('es-AR'),url=OFERTAS.site+'?vista=promos';
 const unsub=testing?'':OFERTAS.site+'baja.html?id='+encodeURIComponent(member.ID)+'&signature='+ofertasToken_(member.ID);
 const cards=products.map(p=>'<tr><td style="padding:20px 28px;border-bottom:1px solid #eee">'+(p.image?'<a href="'+url+'"><img src="'+esc(p.image)+'" width="220" alt="'+esc(p.name)+'" style="display:block;max-width:100%;height:auto;margin:0 auto 16px"></a>':'')+'<p style="font-size:18px;font-weight:bold;margin:8px 0">'+esc(p.name)+'</p><p style="margin:8px 0;color:#777"><s>'+money(p.original)+'</s> <strong style="font-size:24px;color:#ee6100">'+money(p.price)+'</strong></p></td></tr>').join('');
 const footer=testing?'<p>PRUEBA: enviada únicamente al correo configurado del negocio.</p>':'<p>Recibís este mail porque aceptaste las ofertas por email de Showtime.</p><p><a href="'+esc(unsub)+'" style="color:#666">Dejar de recibir ofertas</a> · <a href="'+OFERTAS.site+'" style="color:#666">Mi cuenta</a></p>';
 const html='<!doctype html><html lang="es"><body style="margin:0;background:#f3f3f3;font-family:Arial,sans-serif;color:#111"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 8px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fff"><tr><td style="padding:30px 28px;background:#111;color:#fff"><p style="margin:0;font-size:30px;font-style:italic;font-weight:900">SHOWTIME</p><p style="margin:4px 0 24px;font-size:11px;letter-spacing:4px">SPORT STORE</p><h1 style="font-size:36px;line-height:1.05;margin:0">OFERTAS<br><span style="color:#ff6a00">EXCLUSIVAS</span></h1><p style="margin:18px 0 0;font-size:17px">Las promos de esta semana, en nuestra web.</p></td></tr>'+cards+'<tr><td align="center" style="padding:28px"><a href="'+url+'" style="display:inline-block;background:#ff6a00;color:#fff;text-decoration:none;font-weight:bold;padding:16px 28px;border-radius:6px">VER OFERTAS</a><p style="font-size:12px;color:#666;margin:20px 0 0">Precios y disponibilidad al momento del envío. Consultá talles y stock en la web.</p></td></tr><tr><td style="padding:20px 28px;background:#eee;font-size:12px;color:#666"><p>Showtime Sport Store · Bahía Blanca<br>Brown 153 · Garibaldi 243</p>'+footer+'</td></tr></table></td></tr></table></body></html>';
 const body='SHOWTIME SPORT STORE\nOFERTAS EXCLUSIVAS\n\n'+products.map(p=>p.name+' — Antes '+money(p.original)+' / Ahora '+money(p.price)).join('\n')+'\n\nVer ofertas: '+url+'\nPrecios y disponibilidad al momento del envío. Consultá talles y stock.\n\n'+(testing?'PRUEBA: solo al correo del negocio.':'Aceptaste recibir ofertas de Showtime. Para darte de baja: '+unsub);
 const mail={to:commerceEmail_(member.Email),name:'Showtime Sport Store',subject:(testing?'[PRUEBA] ':'')+'Ofertas exclusivas en la web de Showtime',body,htmlBody:html};
 const reply=commerceProps_().getProperty('ORDERS_EMAIL');if(reply)mail.replyTo=commerceEmail_(reply);return mail;
}
function ofertasEligible_(member,history,week,now){
 if(member.Ofertas_Email!==true)return false;
 let hash;try{hash=commerceHash_(commerceEmail_(member.Email));}catch(e){return false;}
 const related=history.filter(r=>r.Cliente_ID===member.ID||r.Email_Hash===hash);
 return !related.some(r=>r.Semana===week||Date.parse(r.Enviado_En||r.Intento_En)>now.getTime()-7*86400000);
}
function ofertasClaim_(id,week,now){return locked_(()=>{
 const member=commerceRows_('CLIENTES_WEB').find(r=>r.ID===id),history=ofertasRows_();
 if(!member||!ofertasEligible_(member,history,week,now)||MailApp.getRemainingDailyQuota()<=OFERTAS.reserve)return null;
 const record={Cliente_ID:member.ID,Email_Hash:commerceHash_(commerceEmail_(member.Email)),Semana:week,Estado:'en_proceso',Intento_En:now.toISOString(),Enviado_En:''};ofertasWrite_(record);
 return {member,record:{...record,row:ofertasTable_().getLastRow()}};
});}
function ofertasWeeklyRun_(){
 const p=commerceProps_();if(p.getProperty('OFERTAS_EMAIL_ENABLED')!=='true')return {sent:0,reason:'paused'};
 if(DriveApp.getFileById(p.getProperty('COMMERCE_SHEET_ID')).getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('La base de clientes debe ser privada.');
 const now=new Date(),day=ofertasDate_(now),start=p.getProperty('OFERTAS_EMAIL_START');if(!start||day<start)return {sent:0,reason:'not_started'};
 const week=ofertasWeek_(day),products=ofertasProducts_();if(!products.length)return {sent:0,reason:'no_offers'};
 const history=ofertasRows_(),members=commerceRows_('CLIENTES_WEB').filter(m=>ofertasEligible_(m,history,week,now));let sent=0,attempted=0;
 for(const member of members){
  if(attempted>=OFERTAS.batch||Date.now()-now.getTime()>OFERTAS.maxMillis||p.getProperty('OFERTAS_EMAIL_ENABLED')!=='true'||MailApp.getRemainingDailyQuota()<=OFERTAS.reserve)break;
  const claim=ofertasClaim_(member.ID,week,new Date());if(!claim)continue;attempted++;
  try{
   // Recheck consent immediately before sending. A reserved record prevents duplicate sends
   // even if execution stops after delivery and before recording the result.
   const current=commerceRows_('CLIENTES_WEB').find(r=>r.ID===member.ID);
   if(!current||current.Ofertas_Email!==true||current.Email!==claim.member.Email){locked_(()=>ofertasWrite_({...claim.record,Estado:'omitido'}));continue;}
   MailApp.sendEmail(ofertasMessage_(current,products,false));
   locked_(()=>ofertasWrite_({...claim.record,Estado:'enviado',Enviado_En:new Date().toISOString()}));sent++;
  }catch(error){locked_(()=>ofertasWrite_({...claim.record,Estado:'revisar'}));break;}
 }
 const result={sent,pending:Math.max(0,members.length-attempted),checked:now.toISOString(),week};p.setProperty('OFERTAS_EMAIL_LAST_RUN',JSON.stringify(result));Logger.log(JSON.stringify(result));return result;
}
// Trigger functions can be invoked only by an installed time trigger, never google.script.run.
function enviarOfertasSemanales_(e){if(!e||!e.triggerUid)throw new Error('Usar el activador horario.');return ofertasWeeklyRun_();}
function probarOfertasEmail(){commerceOwner_();const products=ofertasProducts_();if(!products.length)throw new Error('No hay ofertas activas con precio válido.');if(MailApp.getRemainingDailyQuota()<=OFERTAS.reserve)throw new Error('Sin cupo libre para la prueba.');const email=commerceEmail_(commerceProps_().getProperty('ORDERS_EMAIL'));MailApp.sendEmail(ofertasMessage_({Email:email},products,true));Logger.log('Prueba de ofertas enviada solo al correo configurado del negocio. Productos: '+products.length);}
function activarOfertasEmail(){commerceOwner_();return locked_(()=>{
 const p=commerceProps_();commerceEmail_(p.getProperty('ORDERS_EMAIL'));const file=DriveApp.getFileById(p.getProperty('COMMERCE_SHEET_ID'));if(file.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('La base de clientes debe ser privada.');ofertasTable_();
 if(!p.getProperty('OFERTAS_EMAIL_START')){const today=ofertasDate_(new Date()),d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+((4-d.getUTCDay()+7)%7||7));p.setProperty('OFERTAS_EMAIL_START',d.toISOString().slice(0,10));}
 const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='enviarOfertasSemanales_');
 if(!triggers.length)ScriptApp.newTrigger('enviarOfertasSemanales_').timeBased().everyDays(1).atHour(12).nearMinute(0).inTimezone(OFERTAS.zone).create();
 triggers.slice(1).forEach(t=>ScriptApp.deleteTrigger(t));p.setProperty('OFERTAS_EMAIL_ENABLED','true');Logger.log('Ofertas por email activas desde '+p.getProperty('OFERTAS_EMAIL_START')+'. Un mail por cliente cada 7 días; procesamiento diario alrededor de las 12, Buenos Aires. Cupo reservado: '+OFERTAS.reserve+'.');return estadoOfertasEmail();
});}
function pausarOfertasEmail(){commerceOwner_();commerceProps_().setProperty('OFERTAS_EMAIL_ENABLED','false');Logger.log('Ofertas por email pausadas.');}
function estadoOfertasEmail(){commerceOwner_();const p=commerceProps_(),result={enabled:p.getProperty('OFERTAS_EMAIL_ENABLED')==='true',start:p.getProperty('OFERTAS_EMAIL_START'),subscribers:commerceRows_('CLIENTES_WEB').filter(c=>c.Ofertas_Email===true).length,quota:MailApp.getRemainingDailyQuota(),triggers:ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='enviarOfertasSemanales_').length,lastRun:p.getProperty('OFERTAS_EMAIL_LAST_RUN')};Logger.log(JSON.stringify(result));return result;}
