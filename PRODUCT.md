# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personas que quieren vestir bien con la ropa que ya tienen en su closet. El usuario tiene prendas, zapatos y accesorios guardados y necesita ayuda para combinarlos según la ocasión. No quiere comprar más ropa; quiere aprovechar lo que ya posee.

El cliente final usa la app para elegir su outfit del día: pasa un prompt describiendo lo que necesita (ej: "outfit casual para una cena con amigos"), y la IA busca en las prendas previamente cargadas en la base de datos para crear una representación 3D del outfit recomendado.

## Product Purpose

Afrodita resuelve el problema diario de "¿qué me pongo hoy?" usando inteligencia artificial para analizar el closet personal del usuario y generar combinaciones de outfits visualizadas en un avatar 3D personalizado con las medidas y facciones reales del cliente.

El éxito significa: el usuario abre la app, describe su necesidad, ve 3 opciones de outfit en su avatar, y elige una confiado en que se verá bien.

## Positioning

La diferencia con apps de moda tradicionales es que Afrodita no vende ropa nueva: usa exclusivamente lo que el usuario ya tiene. El mecanismo diferenciador es la combinación de IA para recomendación + avatar 3D con medidas reales para visualización exacta. Ninguna otra app combina这两个 elementos con switching dinámico de modelos de IA para obtener los mejores resultados.

## Operating Context

1. El usuario carga fotos de sus prendas (camisas, pantalones, zapatos, accesorios) con metadata (color, material, marca, estación)
2. Chatea con la IA describiendo qué outfit necesita (ocasión, estilo, clima, etc.)
3. La IA analiza el closet disponible y genera 3 opciones de outfit
4. El usuario configura su avatar 3D con medidas corporales y foto de rostro
5. Visualiza las 3 opciones vestidas en su avatar
6. Elige la que más le gusta

## Capabilities and Constraints

**Funcionalidades MVP:**
- Landing page explicativa
- Módulo de carga de prendas (CRUD con fotos)
- Chat conversacional para definir el outfit deseado
- Procesamiento de outfits con IA (generación de 3 opciones)
- Creación de avatar 3D con medidas corporales
- Upload de foto de rostro para el avatar
- Detección de tono de piel desde la foto
- Visualización de 3 opciones de outfit en el avatar

**Restricciones:**
- MVP usa Google Gemini (free tier) para evitar costos iniciales
- Producción permitirá switching a OpenAI/Anthropic para mejor calidad
- El 3D inicial puede ser simplificado (sin animaciones complejas)
- Las prendas deben ser fotografiadas individualmente

**Modelos de IA soportados:**
- Gemini (MVP, gratis)
- OpenAI GPT-4 (producción, pago)
- Anthropic Claude (producción, pago)

## Brand Commitments

- Nombre: Afrodita
- Tono: Cercano, útil, sin pretensiones de alta costura
- Enfoque: Practacidad sobre moda por moda

## Evidence on Hand

Ninguno. Todo el contenido, fotos de prendas, y datos de usuarios serán generados o cargados por los usuarios.

## Product Principles

1. **Usa lo que tienes**: Nunca sugiere comprar; trabaja exclusivamente con el closet existente del usuario
2. **Visualiza antes de decidir**: El avatar 3D elimina la incertidumbre de cómo se verá el outfit
3. **IA como asistente, no como dueño**: La IA recomienda, el usuario decide
4. **Simpleza sobre complejidad**: Un flujo claro de 5 pasos sin opciones abrumadoras
5. **Sin costos ocultos**: MVP gratuito con Gemini; el usuario solo paga si quiere modelos premium

## Accessibility & Inclusion

El avatar debe representar diversidad de cuerpos y tonos de piel. Las medidas son configurables para todo tipo de complexión.
