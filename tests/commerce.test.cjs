const {readFileSync,existsSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const path=require('node:path');
const root=existsSync(path.join(__dirname,'club.js'))?__dirname:path.join(__dirname,'..');
const appRoot=existsSync(path.join(root,'Comercio.gs'))?root:path.join(root,'apps-script');
const source=readFileSync(path.join(appRoot,'Comercio.gs'),'utf8');
new vm.Script(source);
new vm.Script(readFileSync(path.join(root,'club.js'),'utf8'));
new vm.Script(readFileSync(path.join(appRoot,'AdminPedidos.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]);
let rows={},messages=[],cache=new Map(),quota=100,files=[];
const props=new Map([['COMMERCE_ENABLED','true'],['TRANSFER_BROWN_ALIAS','test.alias'],['TRANSFER_BROWN_HOLDER','Titular de prueba'],['CONTACT_BROWN_WA','5492915000000'],['CONTACT_VM_WA','5492915000001'],['ORDERS_EMAIL','orders@example.test'],['RECEIPTS_FOLDER_ID','private-test-folder']]);
const products=[{ID:'shirt',Nombre:'Camiseta de prueba',Talle:'M|L',Precio_Original:30000,Precio_Oferta:25000,Oferta_Activa:true,Stock:3,Visible:true,Categoria:'FUTBOL'}];
const ctx=vm.createContext({console,Map,Date,JSON,Number,String,Math,Object,RegExp,Array,Error,Boolean,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
 Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(a,v)=>[...crypto.createHash('sha256').update(v).digest()],base64Decode:s=>[...Buffer.from(s,'base64')],newBlob:(bytes,mime,name)=>({bytes,mime,name})},
 MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:m=>{if(quota<1)throw new Error('quota');quota--;messages.push(m);}},
 DriveApp:{Access:{PRIVATE:'private'},getFolderById:()=>({createFile:blob=>{const f={id:'receipt-'+files.length,...blob};files.push(f);return {getId:()=>f.id,getSharingAccess:()=> 'private',setTrashed:()=>{f.deleted=true;}};}})},
 locked_:fn=>fn(),safe_:v=>v,json_:v=>v,auth_:t=>{if(t!=='staff-test')throw new Error('auth');},
 number_:v=>v===''||v==null?NaN:Number(String(v).replace(',','.')),
 read_:table=>table==='LOCAL'?products.map((row,i)=>({index:i+2,row})):[],
});
vm.runInContext(source,ctx);
ctx.commerceRows_=name=>(rows[name]||[]).map((v,i)=>({...v,row:i+2}));
ctx.commerceWrite_=(name,data,row)=>{rows[name]??=[];const v={...data};delete v.row;if(row)rows[name][row-2]=v;else rows[name].push(v);};
function reset(){rows={};messages=[];cache=new Map();quota=100;files=[];products[0].Stock=3;props.set('COMMERCE_ENABLED','true');props.delete('TRANSFER_VM_ALIAS');}
function post(p){return ctx.commercePost_({postData:{contents:JSON.stringify(p)}});}
function register(email='one@example.test'){
 const response=post({action:'requestCode',name:'Cliente de prueba',phone:'2915000000',email,emailOffers:false,waOffers:false});assert.equal(response.ok,true);
 const code=messages.at(-1).body.match(/\d{6}/)[0];
 const account=post({action:'verifyCode',challenge:response.challenge,code});assert.equal(account.ok,true);return {...account,challenge:response.challenge,code};
}
function create(account,extra={}){return post({action:'createOrder',token:account.token,requestId:'12345678-1234-1234-1234-123456789abc',branch:'brown',items:[{type:'local',id:'shirt',size:'M',qty:1,price:1}],...extra});}
let passed=0;
function test(name,fn){reset();fn();passed++;console.log('OK '+name);}
test('public settings never disclose bank data before a reservation',()=>{const result=ctx.commercePublic_();assert.equal(result.enabled,true);assert.equal(result.branches[0].transferAvailable,true);assert.equal(result.branches[1].transferAvailable,false);assert.equal(JSON.stringify(result).includes('test.alias'),false);});
test('customer data requires a separate configured private workbook',()=>{props.delete('COMMERCE_SHEET_ID');assert.throws(()=>ctx.commerceBook_(),/base privada/);props.set('COMMERCE_SHEET_ID','private-commerce-test');const opened=[];ctx.SpreadsheetApp={openById:id=>{opened.push(id);return {test:true};}};assert.equal(ctx.commerceBook_().test,true);assert.equal(opened[0],'private-commerce-test');});
test('preparation and test-email helpers cannot run as another user',()=>{ctx.Session={getEffectiveUser:()=>({getEmail:()=> 'owner@example.test'}),getActiveUser:()=>({getEmail:()=> 'other@example.test'})};assert.throws(()=>ctx.prepararComercio(),/propietario/);assert.throws(()=>ctx.probarCorreoComercio(),/propietario/);assert.equal(messages.length,0);});
test('feature gate blocks requests before activation',()=>{props.set('COMMERCE_ENABLED','false');assert.equal(post({action:'me',token:'x'}).ok,false);assert.equal(messages.length,0);});
test('OTP creates one private customer, grants no offer consent and cannot replay',()=>{const a=register();assert.equal(rows.CLIENTES_WEB.length,1);assert.equal(rows.CLIENTES_WEB[0].Ofertas_Email,false);assert.equal(rows.CLIENTES_WEB[0].Ofertas_WhatsApp,false);assert.equal(post({action:'verifyCode',challenge:a.challenge,code:a.code}).ok,false);assert.equal(post({action:'me',token:'f'.repeat(64)}).ok,false);});
test('wrong OTP is bounded and mail quotas fail explicitly',()=>{const r=post({action:'requestCode',name:'Cliente',phone:'2915000000',email:'test@example.test'}),correct=messages.at(-1).body.match(/\d{6}/)[0],wrong=correct==='000000'?'111111':'000000';for(let i=0;i<5;i++)assert.equal(post({action:'verifyCode',challenge:r.challenge,code:wrong}).ok,false);assert.equal(post({action:'verifyCode',challenge:r.challenge,code:correct}).ok,false);quota=5;const result=post({action:'requestCode',name:'Otro',phone:'2915000000',email:'other@example.test'});assert.equal(result.ok,false);assert.match(result.error,/código ahora/);});
test('customer can withdraw each marketing consent without changing another account',()=>{const a=register(),b=register('two@example.test');assert.equal(post({action:'preferences',token:a.token,emailOffers:true,waOffers:true}).ok,true);assert.equal(post({action:'preferences',token:a.token,emailOffers:false,waOffers:false}).ok,true);const result=post({action:'me',token:a.token});assert.equal(result.preferences.email,false);assert.equal(result.preferences.whatsapp,false);assert.equal(post({action:'me',token:b.token}).preferences.email,false);});
test('server computes prices and saves retries as one pending order with no payment data',()=>{const a=register(),first=create(a),again=create(a);assert.equal(first.ok,true);assert.equal(again.order.id,first.order.id);assert.equal(rows.PEDIDOS_WEB.length,1);assert.equal(first.order.total,25000);assert.equal(first.order.status,'solicitado');assert.equal(first.order.bank,null);assert.equal(messages.filter(m=>m.subject.includes('Nuevo pedido')).length,1);});
test('another account cannot see the order or attach a receipt',()=>{const a=register(),order=create(a).order,b=register('two@example.test');assert.equal(post({action:'me',token:b.token}).orders.length,0);assert.equal(post({action:'receipt',token:b.token,orderId:order.id,mime:'application/pdf',base64:Buffer.from('%PDF- TEST').toString('base64')}).ok,false);assert.equal(files.length,0);});
test('combined quantities over sizes are checked against product stock',()=>{const a=register(),result=create(a,{items:[{type:'local',id:'shirt',size:'M',qty:2},{type:'local',id:'shirt',size:'L',qty:2}]});assert.equal(result.ok,false);assert.equal((rows.PEDIDOS_WEB||[]).length,0);});
test('size changes and quoted products cannot reach payment checkout',()=>{const a=register();assert.equal(create(a,{items:[{type:'local',id:'shirt',size:'XXL',qty:1}]}).ok,false);assert.equal(create(a,{items:[{type:'confeccion',id:'shirt',size:'M',qty:1}]}).ok,false);});
test('reserve requires actual separation, configured branch, and current version',()=>{const a=register(),o=create(a).order;assert.throws(()=>ctx.pedidosAdminUpdate('staff-test',{id:o.id,version:1,status:'reservado'}),/separaste/);const confirmed=ctx.pedidosAdminUpdate('staff-test',{id:o.id,version:1,status:'reservado',separated:true});assert.equal(confirmed.order.bank.alias,'test.alias');assert.equal(confirmed.order.bank.phone,'5492915000000');assert.throws(()=>ctx.pedidosAdminUpdate('staff-test',{id:o.id,version:1,status:'pagado'}),/Otro usuario/);assert.throws(()=>ctx.pedidosAdminList('bad'),/auth/);});
test('Villa Mitre cannot expose Brown bank data when its alias is missing',()=>{const a=register(),o=create(a,{branch:'vm'}).order;assert.throws(()=>ctx.pedidosAdminUpdate('staff-test',{id:o.id,version:1,status:'reservado',separated:true}),/Falta configurar/);assert.equal(post({action:'me',token:a.token}).orders[0].bank,null);});
test('receipt stays private, is not a confirmed payment, and cannot be replayed',()=>{const a=register(),o=create(a).order;ctx.pedidosAdminUpdate('staff-test',{id:o.id,version:1,status:'reservado',separated:true});const request={action:'receipt',token:a.token,orderId:o.id,mime:'application/pdf',base64:Buffer.from('%PDF- FAKE TEST ONLY').toString('base64')};const result=post(request);assert.equal(result.ok,true);assert.equal(result.order.status,'pago_a_verificar');assert.equal(result.order.receipt,true);assert.equal(JSON.stringify(result).includes('receipt-'),false);assert.equal(post(request).ok,false);assert.equal(files.length,1);});
test('new order remains registered even when the notification fails',()=>{const a=register();quota=0;const result=create(a);assert.equal(result.ok,true);assert.equal(result.order.notificationPending,true);assert.equal(rows.PEDIDOS_WEB.length,1);});
test('only staff can advance payment and delivery; catalog stock is not silently changed',()=>{const a=register(),o=create(a).order;assert.throws(()=>ctx.pedidosAdminUpdate('staff-test',{id:o.id,version:1,status:'pagado'}),/inválido/);assert.equal(post({action:'pedidosAdminUpdate',token:a.token,id:o.id,status:'pagado'}).ok,false);let version=1;for(const status of ['reservado','pagado','listo','entregado'])ctx.pedidosAdminUpdate('staff-test',{id:o.id,version:version++,status,separated:true});assert.equal(products[0].Stock,3);assert.equal(rows.AUDITORIA_PEDIDOS.length,4);});
console.log(passed+' commerce tests passed; JavaScript syntax valid.');
