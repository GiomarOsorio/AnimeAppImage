# MyAnimeList API v2 — referencia técnica

Extraído de la spec OpenAPI oficial (Redoc, `myanimelist.net/apiconfig/references/api/v2`), resumido para uso futuro en este proyecto. No usar aún — el proyecto usa Jikan (no-oficial) por simplicidad, esto queda documentado por si migramos a la API oficial (requiere Client ID registrado en tu cuenta MAL).

## Base URL

```
https://api.myanimelist.net/v2
```

## Autenticación

Dos esquemas, uno de los dos es obligatorio según el endpoint:

### `main_auth` (OAuth2)
- Authorization URL: `https://myanimelist.net/v1/oauth2/authorize`
- Scope: `write:users` — perfil básico + lectura/escritura de listas del usuario
- La spec solo documenta el flujo `implicit`. En la práctica (confirmado por la MAL API Club y por implementaciones existentes), MAL usa **Authorization Code + PKCE** con `code_challenge_method=plain` (no soporta S256):
  - Token URL: `https://myanimelist.net/v1/oauth2/token`
  - No requiere `client_secret` si tu app está registrada como tipo "other"
  - Refresh: `grant_type=refresh_token`

### `client_auth` (API Key)
- Header: `X-MAL-CLIENT-ID: <tu_client_id>`
- Sirve para endpoints que no requieren usuario logueado (listas públicas, búsqueda, ranking)

## Endpoints — anime

| Método | Path | Auth | Notas |
|---|---|---|---|
| GET | `/anime` | main_auth o client_auth | Búsqueda. Params: `q`, `limit` (def 100, max 100), `offset`, `fields` |
| GET | `/anime/{anime_id}` | main_auth o client_auth | Detalle. Params: `fields` |
| GET | `/anime/ranking` | main_auth o client_auth | Params: `ranking_type` (requerido), `limit` (max 500), `offset`, `fields` |
| GET | `/anime/season/{year}/{season}` | main_auth o client_auth | Path: `year`, `season`. Query: `sort`, `limit` (max 500), `offset`, `fields` |
| GET | `/anime/suggestions` | main_auth | Sugerencias para el usuario autenticado |

`ranking_type` valores: `all`, `airing`, `upcoming`, `tv`, `ova`, `movie`, `special`, `bypopularity`, `favorite`

`sort` (para `/anime/season/...`): `anime_score`, `anime_num_list_users` (ambos descendente)

## Endpoints — user animelist (tag relevante para nuestra app)

| Método | Path | Auth | Notas |
|---|---|---|---|
| PATCH | `/anime/{anime_id}/my_list_status` | main_auth | Crea o actualiza status en la lista del usuario. Body `application/x-www-form-urlencoded` |
| DELETE | `/anime/{anime_id}/my_list_status` | main_auth | 404 si no existía en la lista |
| GET | `/users/{user_name}/animelist` | main_auth o client_auth | `user_name` o `@me`. Query: `status`, `sort`, `limit` (max 1000), `offset` |

Body de `PATCH /anime/{anime_id}/my_list_status`:

| Campo | Tipo | Notas |
|---|---|---|
| status | string | `watching`, `completed`, `on_hold`, `dropped`, `plan_to_watch` |
| is_rewatching | boolean | |
| score | integer | 0–10 |
| num_watched_episodes | integer | |
| priority | integer | 0–2 |
| num_times_rewatched | integer | |
| rewatch_value | integer | 0–5 |
| tags | string | |
| comments | string | |

`sort` (para `/users/{user_name}/animelist`): `list_score`, `list_updated_at`, `anime_title`, `anime_start_date`, `anime_id`

## Campos útiles del objeto anime (`fields` param)

Para pedir solo lo que la app necesita (poster + sinopsis + temporadas), pasar algo como:

```
fields=id,title,alternative_titles,main_picture,synopsis,mean,genres,num_episodes,start_season,status,studios,my_list_status
```

Campos disponibles relevantes:
- `main_picture.medium` / `main_picture.large` — poster
- `alternative_titles.en` / `.ja` / `.synonyms` — matching de títulos
- `synopsis` — sinopsis (en inglés, siempre requiere traducción para nuestro caso de uso)
- `mean`, `rank`, `popularity`, `genres[]`
- `num_episodes`, `start_season.year` / `.season`, `status` (`finished_airing` / `currently_airing` / `not_yet_aired`)
- `studios[].name`
- `my_list_status` — solo si hay usuario autenticado (requiere main_auth)

## Por qué no la usamos todavía

Requiere que el usuario registre una app en su cuenta MAL (Client ID) y complete el flujo OAuth con navegador. Jikan (`api.jikan.moe`, no-oficial, sin auth) cubre lo que necesitamos hoy: poster + sinopsis + búsqueda por título, sin fricción de setup. Si más adelante queremos escribir en la lista de MAL del usuario (marcar visto, puntuar) desde la app, ahí sí hace falta migrar a esta API oficial.
