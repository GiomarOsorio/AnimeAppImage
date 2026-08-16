use crate::types::{default_controls, Settings};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct SettingsState(pub Mutex<Settings>);

fn settings_path(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_config_dir()
        .expect("no se pudo resolver el directorio de configuración");
    fs::create_dir_all(&dir).ok();
    dir.join("settings.json")
}

fn default_settings() -> Settings {
    let library_path = dirs::video_dir()
        .or_else(dirs::home_dir)
        .map(|p| p.to_string_lossy().to_string());
    Settings {
        library_path,
        favorites: Vec::new(),
        mal_client_id: None,
        mal_client_secret: None,
        controls: default_controls(),
        watch_progress: std::collections::HashMap::new(),
        scan_on_start: true,
    }
}

pub fn load(app: &AppHandle) -> Settings {
    let path = settings_path(app);
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_else(|_| default_settings()),
        Err(_) => default_settings(),
    }
}

pub fn save(app: &AppHandle, settings: &Settings) {
    let path = settings_path(app);
    if let Ok(json) = serde_json::to_string_pretty(settings) {
        let _ = fs::write(path, json);
    }
}
