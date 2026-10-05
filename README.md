# Afrodita

Estilista personal de moda con inteligencia artificial. Combina la ropa que ya tienes, descubre looks para cada ocasión y míralos puestos sobre una foto tuya con el probador con IA.

## Funcionalidad

- **Closet digital**: carga fotos de prendas con color, material, marca y temporada.
- **Estilista IA**: conversa con el asistente y recibe 3 opciones de outfit para la ocasión que describas.
- **Probador con IA**: sube una foto tuya una vez y un modelo de imagen de Gemini te muestra con cada outfit puesto, de forma fotorrealista.

## Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **UI**: Tailwind CSS 4
- **Base de datos**: Neon (PostgreSQL) + Prisma
- **Auth**: Better Auth
- **IA**: Gemini (estilista y probador), OpenAI y Anthropic como alternativas para el estilista
- **Testing**: Vitest
- **Despliegue**: Vercel

## Desarrollo local

```bash
pnpm install
cp .env.example .env.local   # completa las variables
pnpm db:push                 # aplica el esquema a Neon
pnpm dev
```

### Autenticación

Correo y contraseña, Google, o ambos sobre la misma cuenta (`better-auth`, `src/lib/auth.ts`).

- Google es opcional: sin `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` los botones no aparecen. En Google Cloud Console crea un ID de cliente web y autoriza la URI de redireccionamiento `<BETTER_AUTH_URL>/api/auth/callback/google` (y la de `http://localhost:3000` para desarrollo).
- Los correos de las cuentas con contraseña no están verificados, así que Google **no se enlaza solo por coincidir el correo** (permitiría apropiarse de una cuenta ajena). El enlace es explícito, desde `/account`: quien entró con contraseña conecta Google, y quien entró con Google añade una contraseña.
- Si alguien intenta entrar con Google con un correo que ya tiene cuenta con contraseña, vuelve a `/login?error=account_not_linked` con la explicación.

### Planes y pagos

Tres suscripciones mensuales (`src/lib/billing/plans.ts`): Básico $10, Estándar $25 y Pro $50 USD, con topes de looks con imagen por mes y por día, fotos base por mes, prendas por mes y tamaño del closet. Los topes salen del costo de un look (~US$0,07-0,11 con `gemini-3.1-flash-image`), así que ajústalos allí si cambia.

- **Cobro**: Mercado Pago, suscripción recurrente (`/preapproval`). `POST /api/billing/checkout` crea la suscripción y devuelve la página de pago; el cliente paga allí. El estado llega por webhook (`POST /api/billing/webhook`), que consulta la API de Mercado Pago en lugar de fiarse del aviso, y se guarda en `Subscription`. El consumo del mes vive en `UsageMonth`.
- **Cancelar** (`POST /api/billing/cancel`): detiene los cobros y conserva el plan hasta el final del mes pagado.
- **Apagado por defecto**: sin `BILLING_ENABLED=true` no se aplica ningún plan y la app funciona como antes. `BILLING_EXEMPT_EMAILS` deja usar la app sin pagar (con topes Pro).
- **Precio local**: se muestra en USD y se cobra en `MERCADOPAGO_CURRENCY` (COP) a `BILLING_USD_RATE`, o al valor de `PLAN_<PLAN>_PRICE_<MONEDA>`.
- **Configuración**: crea una aplicación en Mercado Pago (Tus integraciones), copia el access token en `MERCADOPAGO_ACCESS_TOKEN` y registra `<BETTER_AUTH_URL>/api/billing/webhook` con el evento «Planes y suscripciones»; la clave secreta que te da va en `MERCADOPAGO_WEBHOOK_SECRET`. Aplica el esquema con `pnpm db:push` (tablas `Subscription` y `UsageMonth`).
- Un plan no se puede cambiar a mitad de mes: se cancela y se elige otro al terminar el mes pagado.

### Probador con IA

El probador (`src/lib/tryon/`, `src/components/tryon/`) genera una imagen del usuario con el outfit puesto:

- **Foto base**: el usuario sube una foto de cuerpo entero (`PUT /api/tryon/photo`). Se guarda privada en el bucket, bajo `tryon/<userId>/`, y puede eliminarla junto con todos sus looks (`DELETE`).
- **Recorte antes de subir** (`ui/image-crop-dialog.tsx`, con `react-image-crop`): tanto la foto base (2:3, 3:4 o libre) como las fotos de prendas (3:4, 1:1 o libre) pasan por un paso de recorte en el navegador. Lo que se revisa y se guarda es el recorte. Los formatos que el navegador no puede mostrar (HEIC fuera de Safari) se pueden subir sin recortar.
- **Revisión de la foto antes de guardarla** (`photo-check.ts`): el usuario confirma unas condiciones (es él, mayor de 18, vestido) y Gemini describe la foto (personas, desnudez, edad aparente, contenido dañino, cuánto cuerpo se ve). Las reglas de decisión viven en el código, no en el modelo. Se permite ropa interior, traje de baño y torso descubierto en hombres; se rechaza desnudez o contenido sexual, menores aparentes, contenido dañino, ninguna o varias personas y fotos de solo la cara. **Falla cerrado**: si no se puede revisar, la foto no se guarda. Lo rechazado nunca llega al bucket ni queda registrado; solo el motivo en el log. Tope de intentos por usuario y día (`PHOTO_CHECK_DAILY_LIMIT`, 15 por defecto). La fecha y versión de las condiciones aceptadas se guardan en `tryon/<user>/consent.json`.
- **Generación**: `POST /api/tryon/looks/[optionId]` envía a Gemini la foto y las fotos de las prendas de esa opción en una sola llamada (`gemini.ts`). Requiere `GEMINI_API_KEY`; el modelo se puede cambiar con `GEMINI_IMAGE_MODEL`.
- **Caché**: cada look se guarda con un hash de la foto y las prendas, así que solo se paga una vez por combinación. Hay un tope por usuario y día (`TRYON_DAILY_LIMIT`, 20 por defecto).

No hay tablas nuevas: todo vive en el almacenamiento de objetos.

## Despliegue en Vercel

1. Conecta el repositorio en [vercel.com](https://vercel.com).
2. Define las variables de entorno de `.env.example` en el proyecto de Vercel (Neon, Better Auth, IA, storage).
3. El build ejecuta `prisma generate` y copia automáticamente los assets WASM/Draco.
4. Aplica el esquema a la base de producción: `pnpm db:push`.

## Estructura

```
src/
  app/            # Rutas App Router (landing, auth, dashboard, API)
  components/     # UI (chat, closet, probador, layout)
  lib/            # Lógica (IA, auth, i18n, probador, almacenamiento)
prisma/
  schema.prisma   # Modelos: User, Wardrobe, Outfit
```
