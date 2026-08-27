# Preguntas para el equipo de Hubix — integración con Solicitudes de Accesos

Estamos automatizando la invitación/desactivación de usuarios en Hubix desde
"Solicitudes de Accesos" (el sistema donde se tramitan las altas y bajas de
Capital Inteligente). Cuando un ticket llega al paso de Hubix, un botón
("Invitar en Hubix" / "Eliminar en Hubix") va a llamar a su API — necesitamos
lo siguiente para implementarlo.

**Importante:** no queremos crear el usuario directamente. Necesitamos el
endpoint equivalente al apartado donde ustedes cargan correo + empresa + ws
y Hubix le manda una **invitación por correo** a la persona (no una cuenta
ya creada).

## 1. Acceso y autenticación

- [ ] URL base de la API (ej. `https://api.hubix.app` o similar).
- [ ] Link a la documentación de la API (endpoints, formatos de request/response).
- [ ] Cómo se autentica: API key, Bearer token, OAuth, etc. — y si es un
      secreto único o hay que generarlo por integración/cliente.
- [ ] ¿La API tiene ambiente de pruebas (sandbox/staging) donde probar antes
      de tocar datos reales?

## 2. Enviar invitación (NO crear el usuario directo)

Necesitamos el endpoint equivalente a la pantalla donde ustedes cargan
correo + empresa + ws para mandar la invitación — que la persona reciba el
correo y complete su propia alta, no que quede creada de una desde acá.

- [ ] Endpoint y método HTTP (ej. `POST /invitations`).
- [ ] Campos requeridos. Sabemos que se necesita:
  - Correo
  - Empresa (sería "Capital Inteligente")
  - Workspace (sería "ws capital inteligente")

  Falta confirmar: ¿"Empresa" y "Workspace" son **texto literal** o **IDs
  internos** de Hubix que hay que buscar/mapear primero (ej. un endpoint
  `GET /empresas` o `GET /workspaces` para obtener el id correcto)?
- [ ] ¿Se necesita también nombre completo de la persona, o algún otro campo
      obligatorio además de correo/empresa/workspace?
- [ ] ¿Qué responde la API si ya existe una invitación pendiente o un
      usuario con ese correo? (para no duplicar si se reintenta)
- [ ] ¿La invitación tiene vencimiento? ¿Se puede reenviar desde la API si
      la persona no la usó a tiempo?

## 3. Eliminar (desactivar) usuario

- [ ] Endpoint y método HTTP (ej. `PATCH /users/{id}/deactivate` o similar).
- [ ] Confirmamos que es **desactivación** (recuperable), no borrado
      definitivo — ¿es así del lado de Hubix también?
- [ ] ¿Se identifica al usuario por correo directamente, o la API devuelve
      un ID interno (al invitar, o en algún endpoint de búsqueda) que
      tendríamos que guardar nosotros para usarlo después al desactivar?
- [ ] ¿Qué pasa si se intenta desactivar a alguien que ya está desactivado o
      no existe?

## 4. Errores y límites

- [ ] Formato de los errores (código HTTP + cuerpo) para poder mostrar un
      mensaje claro si algo falla.
- [ ] ¿Hay rate limiting? (para saber si necesitamos reintentos/backoff)

---

Con esas respuestas armamos el botón de "Invitar en Hubix" / "Eliminar en
Hubix" dentro del flujo de tickets existente.
