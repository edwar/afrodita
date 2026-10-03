# Afrodita

Estilista personal de moda con inteligencia artificial. Combina la ropa que ya tienes, descubre looks para cada ocasión y pruébatelos en tiempo real sobre tu cuerpo con probador 3D.

## Funcionalidad

- **Closet digital**: carga fotos de prendas con color, material, marca y temporada.
- **Estilista IA**: conversa con el asistente y recibe 3 opciones de outfit para la ocasión que describas.
- **Probador 3D en vivo**: seguimiento de poses con MediaPipe y deformación de prendas 3D (skinning) sobre tu cuerpo con Three.js / React Three Fiber.

## Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **UI**: Tailwind CSS 4
- **Base de datos**: Neon (PostgreSQL) + Prisma
- **Auth**: Better Auth
- **3D**: Three.js / React Three Fiber + MediaPipe Tasks Vision
- **IA**: Gemini (principal), OpenAI y Anthropic como alternativas
- **Testing**: Vitest
- **Despliegue**: Vercel

## Desarrollo local

```bash
pnpm install
cp .env.example .env.local   # completa las variables
pnpm db:push                 # aplica el esquema a Neon
pnpm dev
```

### Assets 3D (pipeline Blender)

El probador 3D usa modelos GLB procesados offline con Blender y `gltf-transform` (`scripts/asset-pipeline/`). Requiere Blender 4.5+:

```bash
pnpm assets:wasm       # copia el runtime WASM de MediaPipe a public/
pnpm assets:draco      # copia el decoder Draco de three.js a public/
pnpm assets:retopo -- --in raw.glb --out retopo.glb --category camisa
pnpm assets:rig -- --in retopo.glb --out rigged.glb --category camisa
pnpm assets:lods -- --in rigged.glb --skinned
pnpm assets:validate -- rigged.lod0.glb --require-skin
```

## Despliegue en Vercel

1. Conecta el repositorio en [vercel.com](https://vercel.com).
2. Define las variables de entorno de `.env.example` en el proyecto de Vercel (Neon, Better Auth, IA, storage).
3. El build ejecuta `prisma generate` y copia automáticamente los assets WASM/Draco.
4. Aplica el esquema a la base de producción: `pnpm db:push`.

## Estructura

```
src/
  app/            # Rutas App Router (landing, auth, dashboard, API)
  components/     # UI (chat, closet, probador 3D, layout)
  lib/            # Lógica (IA, auth, i18n, VTO, almacenamiento)
  workers/        # Inferencia MediaPipe en Web Worker
scripts/
  asset-pipeline/ # Pipeline offline de modelos 3D (Blender + gltf-transform)
prisma/
  schema.prisma   # Modelos: User, Wardrobe, Outfit
```
