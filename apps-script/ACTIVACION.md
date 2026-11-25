# Cuentas, pedidos y transferencias de Showtime

Implementación preparada para el catálogo de Google Sheets y el Apps Script existente. No se activa hasta configurar y validar el servidor. No hay datos de clientes en el repositorio público.

## Configuración privada

Los alias, titulares y teléfonos confirmados se cargan solamente en las propiedades del proyecto Apps Script. No incluir esos valores en el repositorio. El código de pruebas usa datos ficticios.

## Flujo

El cartel invita a crear una cuenta sin bloquear el catálogo y recuerda el cierre durante siete días. El cliente entra con un código enviado por mail. La adhesión a ofertas por mail y WhatsApp es opcional y separada. Las campañas y la acumulación/canje de puntos siguen sin activar porque faltan sus reglas.

Una solicitud crea un pedido persistente con identificador y sucursal. El personal verifica precio, talle y stock físico y separa la mercadería. Al confirmar esa reserva se muestran el alias y titular de la sucursal. El cliente transfiere y carga un comprobante privado. El personal verifica el ingreso bancario y marca el pedido pagado, listo para retirar y entregado.

Los pedidos USA y la confección a medida siguen por presupuesto en WhatsApp; no reciben un cobro directo del carrito. El catálogo actual no tiene inventario fiable por sucursal y talle. La reserva necesita confirmación del personal; este módulo no descuenta Stock del catálogo. No hay liberación automática ni plazo de reserva publicado sin acordar esa regla.

## Instalación en Apps Script

1. Guardar una copia completa de los tres archivos y la versión desplegada actuales.
2. Agregar `Comercio.gs` y `AdminPedidos.html` al proyecto existente.
3. Al principio de `doGet(e)`, agregar estas rutas, conservando todas las rutas actuales:

```js
if(e && e.parameter.action === 'commerce') return json_(commercePublic_());
if(e && e.parameter.action === 'orders-admin') return HtmlService.createHtmlOutputFromFile('AdminPedidos').setTitle('Pedidos · Showtime');
```

4. Reemplazar únicamente la función `doPost` actual por:

```js
function doPost(e) { return commercePost_(e); }
```

5. Configurar propiedades privadas: `TRANSFER_BROWN_ALIAS`, `TRANSFER_BROWN_HOLDER`, `CONTACT_BROWN_WA`, `TRANSFER_VM_ALIAS`, `TRANSFER_VM_HOLDER`, `CONTACT_VM_WA` con los datos confirmados; teléfonos en formato internacional. `ORDERS_EMAIL` contiene el mail autorizado para avisos; `RECEIPTS_FOLDER_ID` apunta a una carpeta privada de Drive. Mantener `COMMERCE_ENABLED=false` durante la instalación. El secreto se genera en el servidor. No copiar valores de configuración, claves ni contraseñas al HTML ni al repositorio.
6. Agregar al sitio, después de su código existente: `<link rel="stylesheet" href="club.css">` y `<script src="club.js" defer></script>`. Conservar `index.html`, el catálogo y los enlaces de WhatsApp.
7. Ejecutar `prepararComercio` desde el editor del propietario y autorizar los permisos de Google. Crea una planilla independiente y privada en `COMMERCE_SHEET_ID` y una carpeta privada de comprobantes; verifica su acceso antes de continuar. No guardar clientes en la planilla del catálogo. Ejecutar `probarCorreoComercio` y verificar la recepción en el correo del negocio. Verificar el cupo real con MailApp. El acceso por código falla de forma explícita si no hay cupo; el catálogo y el pedido por WhatsApp siguen disponibles.
8. Desplegar una nueva versión de Apps Script conservando la URL existente. El panel de pedidos queda en `URL_EXEC?action=orders-admin`, con la misma contraseña de administración. No cambiar permisos de la planilla ni publicar hojas de clientes o pedidos.
9. Verificar primero con datos de prueba: código recibido, cuenta correcta, pedido guardado una sola vez aun al reintentar, datos bancarios ocultos hasta separar, sucursal correcta, comprobante privado, cambios de estado y aislamiento entre dos cuentas.
10. Habilitar `COMMERCE_ENABLED=true` solamente después de esas comprobaciones. Una sucursal sin alias no puede confirmar reservas para transferencia.

## Avisos

El módulo prepara avisos automáticos por mail al destinatario configurado en `ORDERS_EMAIL`. Fallar el aviso no borra el pedido: queda marcado como pendiente en el panel y el cliente puede contactar al local.

El enlace de WhatsApp contiene número de pedido, productos, talles y sucursal; el mensaje lo envía el cliente al confirmarlo en WhatsApp. Para un WhatsApp saliente automático del servidor hace falta conectar y autorizar un proveedor de WhatsApp Business; no hay integración, credenciales, plantillas ni costos aprobados todavía. No afirmar que esos mensajes automáticos ya funcionan.

## Estado

Código instalado en el editor del Apps Script existente, con las rutas de cuentas y panel de pedidos agregadas. Correo del negocio verificado y configurado como destinatario privado, junto con los datos de ambas sucursales. Google solicita autorización antes de ejecutar la preparación y el envío de prueba. La versión publicada y el frontend siguen sin activar este módulo. No activar publicidad, puntos ni mensajes masivos.

Validación local: `node tests/commerce.test.cjs` cubre 16 casos de acceso, códigos de un solo uso, consentimiento, precios calculados por servidor, reintentos, aislamiento entre cuentas, estados, sucursales, comprobantes privados, base separada y controles de propietario. Las pruebas usan servicios simulados; faltan la validación con Google y la prueba visual en navegador. El navegador conectado no pudo acceder a la vista local de prueba.
