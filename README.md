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

### Probador con IA

El probador (`src/lib/tryon/`, `src/components/tryon/`) genera una imagen del usuario con el outfit puesto:

- **Foto base**: el usuario sube una foto de cuerpo entero (`PUT /api/tryon/photo`). Se guarda privada en el bucket, bajo `tryon/<userId>/`, y puede eliminarla junto con todos sus looks (`DELETE`).
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
