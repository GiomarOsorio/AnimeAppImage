use crate::types::AnimeMetadata;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

// Successful lookups rarely change (poster/synopsis are static); cache them longer.
// Misses (anime not found) get a shorter TTL so a later rename/retry isn't stuck.
const TTL_HIT_MS: i64 = 30 * 24 * 60 * 60 * 1000;
const TTL_MISS_MS: i64 = 3 * 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CacheEntry {
    data: Option<AnimeMetadata>,
    #[serde(rename = "fetchedAt")]
    fetched_at: i64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct CacheSchema {
    entries: HashMap<String, CacheEntry>,
}

pub struct MetadataCacheState(pub Mutex<CacheSchema>);

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

fn cache_path(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_config_dir()
        .expect("no se pudo resolver el directorio de configuración");
    fs::create_dir_all(&dir).ok();
    dir.join("metadata-cache.json")
}

pub fn load(app: &AppHandle) -> CacheSchema {
    let path = cache_path(app);
    fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn persist(app: &AppHandle, cache: &CacheSchema) {
    let path = cache_path(app);
    if let Ok(json) = serde_json::to_string_pretty(cache) {
        let _ = fs::write(path, json);
    }
}

/// Some(data) = cache hit, None = cache miss/expired (caller should fetch).
pub fn get(state: &MetadataCacheState, key: &str) -> Option<Option<AnimeMetadata>> {
    let cache = state.0.lock().unwrap();
    let entry = cache.entries.get(key)?;
    let ttl = if entry.data.is_some() { TTL_HIT_MS } else { TTL_MISS_MS };
    if now_ms() - entry.fetched_at > ttl {
        return None;
    }
    Some(entry.data.clone())
}

pub fn set(app: &AppHandle, state: &MetadataCacheState, key: &str, data: Option<AnimeMetadata>) {
    let mut cache = state.0.lock().unwrap();
    cache.entries.insert(
        key.to_string(),
        CacheEntry { data, fetched_at: now_ms() },
    );
    persist(app, &cache);
}
