use crate::types::AnimeMetadata;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::fs;

// Written by jkanime_dl next to the video files: <libraryPath>/<anime>/metadata.json,
// one file per anime (not per season). Already in Spanish — no translation needed.
#[derive(Debug, Default, Serialize, Deserialize)]
struct JkanimeMetadataFile {
    #[serde(skip_serializing_if = "Option::is_none")]
    titulo: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    titulo_alternativo: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sinopsis: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    imagen: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    generos: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    episodios: Option<i64>,
    #[serde(flatten)]
    rest: serde_json::Map<String, serde_json::Value>,
}

/// Only trusted for the fields the UI actually leans on. If any of those are
/// missing, the caller should fall through to MyAnimeList/Jikan instead of
/// showing a half-empty card — this is a local-first shortcut, not a
/// replacement for that lookup.
pub async fn read_local_metadata(anime_path: &str) -> Option<AnimeMetadata> {
    let raw = fs::read_to_string(Path::new(anime_path).join("metadata.json"))
        .await
        .ok()?;
    let data: JkanimeMetadataFile = serde_json::from_str(&raw).ok()?;

    let title = data.titulo.as_deref().map(str::trim).filter(|s| !s.is_empty())?.to_string();
    let description = data.sinopsis.as_deref().map(str::trim).filter(|s| !s.is_empty())?.to_string();
    let cover_image = data.imagen.as_deref().map(str::trim).filter(|s| !s.is_empty())?.to_string();

    Some(AnimeMetadata {
        id: 0,
        title,
        description: Some(description),
        cover_image: Some(cover_image),
        banner_image: None,
        genres: data.generos.unwrap_or_default(),
        episodes: data.episodios,
        score: None,
    })
}

/// Called after a MyAnimeList/Jikan fallback fetch succeeds, so the next
/// launch finds a usable metadata.json and never has to hit the API again for
/// that anime. Merges into whatever's already there instead of overwriting —
/// an existing (even partial) file was written by jkanime_dl and its fields
/// take priority; this only fills in what's missing. Best-effort: a read-only
/// mount (NAS) shouldn't break metadata fetching, so failures are swallowed
/// by the caller, not propagated here.
pub async fn write_local_metadata(anime_path: &str, metadata: &AnimeMetadata) -> std::io::Result<()> {
    let file_path = Path::new(anime_path).join("metadata.json");

    let mut existing: JkanimeMetadataFile = fs::read_to_string(&file_path)
        .await
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default();

    if existing.titulo.is_none() {
        existing.titulo = Some(metadata.title.clone());
    }
    if existing.sinopsis.is_none() {
        existing.sinopsis = metadata.description.clone();
    }
    if existing.imagen.is_none() {
        existing.imagen = metadata.cover_image.clone();
    }
    if existing.generos.is_none() && !metadata.genres.is_empty() {
        existing.generos = Some(metadata.genres.clone());
    }
    if existing.episodios.is_none() {
        existing.episodios = metadata.episodes;
    }

    let json = serde_json::to_string_pretty(&existing).unwrap_or_default();
    fs::write(file_path, json).await
}
