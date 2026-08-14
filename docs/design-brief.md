# Design brief

Contexto para pasarle a una herramienta/agente de diseño (ej. Claude Design) que ayude a pulir la UI de esta app.

## Proyecto

**AnimeAppImage** — reproductor local de anime, estilo Netflix, para Steam Machine (control-first).

Repo: github.com/GiomarOsorio/AnimeAppImage

## Qué es

App de escritorio (Electron + React + TypeScript, empaquetada como AppImage para Linux/SteamOS) que lee una biblioteca local de video (`Videos/Anime/Temporada/EPxx.mp4`), trae metadata (póster + sinopsis traducida al español) de MyAnimeList/Jikan, y reproduce con video.js. Uso 100% personal, un solo usuario, contenido obtenido legalmente por el dueño — no hay backend, no hay cuentas, no hay monetización.

## Restricción de hardware/input — la más importante para el diseño

- Se usa sentado en un sillón, TV a distancia (10-foot UI), con control de Steam/Xbox como input principal, teclado como fallback.
- No existe hover — todo el feedback visual tiene que ser un estado "focused" explícito y muy visible (outline/scale/glow), navegado por D-pad o flechas.
- Botones físicos ya mapeados (remapeables por el usuario): A=confirmar, B=volver, Y=favorito, Start=Configuración, Select=Ayuda, D-pad/stick=navegación.
- Todo debe tener target grande, alto contraste, y márgenes de seguridad para overscan de TV.

## Pantallas actuales

1. **Grid de biblioteca** (tipo catálogo Netflix): grid de tarjetas de anime, póster + título, badge de favorito, focus con borde rojo + scale.
2. **Detalle de anime**: hero con fondo (blur del póster, no hay banner real disponible — MAL/Jikan solo dan póster), póster nítido a un lado, título, badges (score, # episodios, géneros), sinopsis en español, lista de temporadas/episodios debajo.
3. **Reproductor**: video.js embebido, pantalla completa.
4. **Configuración** (3 tabs, navegables con izq/der en la tab-bar): "Videos" (elegir carpeta), "MyAnimeList Metadata" (Client ID/Secret + botón Probar/Guardar), "Controles" (tabla remapeable teclado+gamepad por acción).
5. **Modal de Ayuda**: tabla de acción → tecla → botón de control.
6. **Top bar**: pastillas "Ayuda (Select)" / "Configuración (Start)".

## Estilo visual actual (base, sin pulir)

- Fondo `#0b0b0f`, tarjetas `#1a1a22`, acento rojo `#e5322d`, texto blanco, tipografía `system-ui, sans-serif`.
- Sin sistema de diseño formal, CSS plano por componente.

## Datos disponibles por anime

Para diseñar tarjetas/detalle: título (ES si hay alt_title, si no romaji/inglés), póster (`coverImage`), sinopsis traducida, score (0-10), géneros (lista), # episodios. No hay banner/backdrop horizontal real, ni trailers, ni actores/staff.

## Lo que se busca

- Pulir el lenguaje visual completo (color, tipografía, espaciado, elevación) manteniendo estética oscura tipo streaming premium.
- Estados de foco fuertes y legibles a distancia (10-foot UI), consistentes en todas las pantallas.
- Mejorar el layout del grid de biblioteca y el hero de detalle (compensar la falta de banner real).
- Diseño coherente para Configuración (tabs, filas, inputs, tabla de rebind) y el modal de Ayuda.
- Opcional: ícono de la app para el AppImage/`.desktop` file.

## Lo que NO hace falta

Onboarding, marketing, landing page, responsive mobile — es una app fullscreen de un solo dispositivo.
