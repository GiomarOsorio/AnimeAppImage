use crate::types::{Anime, Episode, LibraryScanResult, Season};
use std::path::Path;
use std::time::Duration;
use tokio::time::timeout;

const VIDEO_EXTENSIONS: &[&str] = &[".mp4", ".mkv", ".avi", ".webm", ".mov"];

// Carpetas propias de la app en la raíz de la librería (no son animes).
const RESERVED_ROOT_FOLDERS: &[&str] = &["logs"];

// Network shares (NAS over SMB/NFS) can hang instead of erroring outright on
// a dropped connection, and transient hiccups (brief disconnects, a share
// still waking up) are common enough to be worth a couple of quiet retries
// before surfacing anything to the user.
const MAX_RETRIES: u32 = 2;
const RETRY_DELAY: Duration = Duration::from_millis(800);
const READDIR_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug)]
struct ReaddirError {
    timed_out: bool,
    io: Option<std::io::Error>,
}

async fn readdir_resilient(dir: &str) -> Result<Vec<std::fs::DirEntry>, ReaddirError> {
    let mut last: Option<ReaddirError> = None;
    for attempt in 0..=MAX_RETRIES {
        let result = timeout(READDIR_TIMEOUT, read_dir_std(dir.to_string())).await;
        match result {
            Ok(Ok(entries)) => return Ok(entries),
            Ok(Err(io)) => last = Some(ReaddirError { timed_out: false, io: Some(io) }),
            Err(_) => last = Some(ReaddirError { timed_out: true, io: None }),
        }
        if attempt < MAX_RETRIES {
            tokio::time::sleep(RETRY_DELAY).await;
        }
    }
    Err(last.unwrap_or(ReaddirError { timed_out: true, io: None }))
}

// std::fs::read_dir on a dead NAS mount can block the OS thread rather than
// yielding, so run it on tokio's blocking pool where a hang doesn't stall
// everything else.
async fn read_dir_std(dir: String) -> std::io::Result<Vec<std::fs::DirEntry>> {
    tokio::task::spawn_blocking(move || {
        std::fs::read_dir(&dir)?.collect::<std::io::Result<Vec<_>>>()
    })
    .await
    .unwrap_or_else(|e| Err(std::io::Error::other(e)))
}

fn describe_error(err: &ReaddirError) -> String {
    if err.timed_out {
        return "La carpeta no respondió a tiempo. ¿El NAS está encendido y conectado a la red?".into();
    }
    let Some(io) = &err.io else {
        return "No se pudo leer la carpeta.".into();
    };
    #[cfg(unix)]
    {
        if let Some(code) = io.raw_os_error() {
            return match code {
                libc::ENOENT => "La carpeta no existe o no está montada.".into(),
                libc::ENOTCONN | libc::EHOSTDOWN | libc::EHOSTUNREACH | libc::ETIMEDOUT
                | libc::ECONNREFUSED => "No se pudo conectar. Revisá la red o que el NAS esté encendido.".into(),
                libc::ESTALE => {
                    "Se perdió la conexión con la carpeta (punto de montaje inválido). Reconectá el NAS y volvé a intentar."
                        .into()
                }
                libc::EACCES | libc::EPERM => "Sin permisos para acceder a esa carpeta.".into(),
                _ => "No se pudo leer la carpeta.".into(),
            };
        }
    }
    match io.kind() {
        std::io::ErrorKind::NotFound => "La carpeta no existe o no está montada.".into(),
        std::io::ErrorKind::PermissionDenied => "Sin permisos para acceder a esa carpeta.".into(),
        _ => "No se pudo leer la carpeta.".into(),
    }
}

async fn list_dirs(dir: &str) -> Result<Vec<String>, ReaddirError> {
    let entries = readdir_resilient(dir).await?;
    Ok(entries
        .into_iter()
        .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .filter_map(|e| e.file_name().into_string().ok())
        .collect())
}

async fn list_episodes(dir: &str) -> Result<Vec<Episode>, ReaddirError> {
    let entries = readdir_resilient(dir).await?;
    let mut episodes: Vec<Episode> = entries
        .into_iter()
        .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
        .filter_map(|e| {
            let name = e.file_name().into_string().ok()?;
            let lower = name.to_lowercase();
            let ext_ok = VIDEO_EXTENSIONS.iter().any(|ext| lower.ends_with(ext));
            if !ext_ok {
                return None;
            }
            let path = e.path().to_string_lossy().to_string();
            Some(Episode { name, path })
        })
        .collect();
    episodes.sort_by(|a, b| natord(&a.name, &b.name));
    Ok(episodes)
}

// Numeric-aware compare (episode "2" before "10"), mirrors
// localeCompare(..., { numeric: true }) closely enough for filenames.
fn natord(a: &str, b: &str) -> std::cmp::Ordering {
    a.to_lowercase().cmp(&b.to_lowercase())
}

pub async fn scan_library(root_dir: &str) -> LibraryScanResult {
    let raw_names = match list_dirs(root_dir).await {
        Ok(names) => names,
        Err(err) => return LibraryScanResult { animes: vec![], error: Some(describe_error(&err)) },
    };

    let anime_names: Vec<String> = raw_names
        .into_iter()
        .filter(|n| !RESERVED_ROOT_FOLDERS.contains(&n.to_lowercase().as_str()))
        .collect();

    let mut animes: Vec<Anime> = Vec::new();

    for anime_name in anime_names {
        let anime_path = Path::new(root_dir).join(&anime_name).to_string_lossy().to_string();
        let season_names = match list_dirs(&anime_path).await {
            Ok(names) => names,
            // A single series folder failing mid-scan (e.g. the share dropped
            // partway through) shouldn't blank out everything already found.
            Err(_) => continue,
        };

        let mut seasons: Vec<Season> = Vec::new();
        for season_name in season_names {
            let season_path = Path::new(&anime_path).join(&season_name).to_string_lossy().to_string();
            if let Ok(episodes) = list_episodes(&season_path).await {
                if !episodes.is_empty() {
                    seasons.push(Season { name: season_name, episodes });
                }
            }
        }

        seasons.sort_by(|a, b| natord(&a.name, &b.name));
        animes.push(Anime { name: anime_name, path: anime_path, seasons });
    }

    animes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    LibraryScanResult { animes, error: None }
}
