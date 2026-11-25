# Ofertas semanales por email

Usa MailApp del proyecto existente, sin proveedor pago, compras ni WhatsApp saliente. Solo selecciona clientes de la base privada cuyo consentimiento `Ofertas_Email` es booleano verdadero; no importa contactos de Gmail ni Instagram.

Instalar `Ofertas.gs` junto a `Comercio.gs`, que admite la acción POST `unsubscribe` antes del control de activación de pedidos. Publicar `baja.html` en la raíz del sitio y desplegar nueva versión del servidor conservando URL. La página de baja no realiza cambios al abrirse: exige pulsar Confirmar baja y valida la firma de alcance limitado en el servidor. La baja no cambia pedidos ni preferencias de WhatsApp.

Ejecutar `probarOfertasEmail` como propietario: solo manda al correo del negocio configurado privadamente en `ORDERS_EMAIL`. Después ejecutar `activarOfertasEmail`. La primera tanda comienza el jueves siguiente a la instalación, alrededor de las 12, hora Buenos Aires. Un activador privado diario distribuye la cola sin superar 50 intentos por ejecución ni gastar los últimos 25 destinatarios de la cuota diaria. Cada cliente recibe como máximo un correo por semana y cada siete días; la dirección normalizada también se deduplica. Google no garantiza una hora exacta.

El correo muestra hasta cuatro promociones reales, visibles, con stock no agotado y precio de oferta menor que el original; excluye pedidos USA cotizados y confección. Si no hay ofertas válidas, no manda nada. Los productos y precios se leen del catálogo al ejecutar cada tanda. Diseño naranja/negro, enlace a Promos y baja firmada. Se envía con el nombre Showtime Sport Store desde la cuenta propietaria actual del script; las respuestas se dirigen al correo de pedidos. No suplanta otra dirección de Gmail.

El historial `OFERTAS_EMAIL` se guarda exclusivamente en el libro privado de clientes y pedidos. Una reserva persistida antes del envío evita duplicados ante cortes; los casos inciertos quedan en estado `revisar` sin reintentos automáticos esa semana. No se registran correos ni contenidos de mensajes en los logs. La función del activador termina en `_`, para no exponerla a `google.script.run`. Los controles de activación, pausa, prueba y estado exigen propietario.

Control: `estadoOfertasEmail`. Pausa sin borrar historial: `pausarOfertasEmail`. No agregar tarjetas ni servicios pagos para ampliar cupo: la cola espera. La cuota gratuita de Google es compartida con OTP y avisos; si la cantidad de suscriptores supera la capacidad semanal, algunos quedarán pendientes hasta que haya cupo. No se promete entrega a todos ni recepción fuera de Spam.

Validación: `node tests/ofertas.test.cjs` cubre consentimiento, deduplicación, cadencia, cuotas, fallos parciales, baja firmada e idempotente, privacidad, seguridad HTML, prueba aislada e instalación del activador sin duplicados. Conservar además las pruebas de comercio.

Estado de instalación real: verificar ejecución y propiedades privadas; este documento no sustituye esa verificación. No contiene datos de destinatarios, tokens ni credenciales.
