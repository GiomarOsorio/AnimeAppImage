mod jkanime_dl;
mod library;
mod local_metadata;
mod logger;
mod media_server;
mod metadata;
mod metadata_cache;
mod settings;
mod types;

use jkanime_dl::{Job, JkanimeDlState};
use logger::Logger;
use metadata::ThrottleState;
use metadata_cache::MetadataCacheState;
use settings::SettingsState;
use std::collections::HashMap;
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
use types::{AnimeMetadata, ControlsConfig, JobResult, LibraryScanResult, Settings, WatchProgress};

struct MediaPort(u16);
struct HttpClient(reqwest::Client);

#[tauri::command]
fn log_message(logger: State<Logger>, level: String, message: String) {
    logger.log(&level, &format!("[renderer] {message}"));
}

#[tauri::command]
fn get_media_port(port: State<MediaPort>) -> u16 {
    port.0
}

#[tauri::command]
fn get_settings(settings: State<SettingsState>) -> Settings {
    settings.0.lock().unwrap().clone()
}

#[tauri::command]
async fn select_library_folder(
    app: tauri::AppHandle,
    settings: State<'_, SettingsState>,
) -> Result<Option<String>, ()> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path.map(|p| p.to_string()));
    });
    let chosen = rx.await.unwrap_or(None);
    if let Some(path) = &chosen {
        let mut s = settings.0.lock().unwrap();
        s.library_path = Some(path.clone());
        self::settings::save(&app, &s);
    }
    Ok(chosen.or_else(|| settings.0.lock().unwrap().library_path.clone()))
}

#[tauri::command]
fn set_library_path(app: tauri::AppHandle, settings: State<SettingsState>, path: String) -> String {
    let mut s = settings.0.lock().unwrap();
    s.library_path = Some(path.clone());
    self::settings::save(&app, &s);
    path
}

#[tauri::command]
async fn get_library(settings: State<'_, SettingsState>) -> Result<LibraryScanResult, ()> {
    let library_path = settings.0.lock().unwrap().library_path.clone();
    match library_path {
        None => Ok(LibraryScanResult { animes: vec![], error: None }),
        Some(path) => Ok(library::scan_library(&path).await),
    }
}

#[tauri::command]
fn set_scan_on_start(app: tauri::AppHandle, settings: State<SettingsState>, value: bool) {
    let mut s = settings.0.lock().unwrap();
    s.scan_on_start = value;
    self::settings::save(&app, &s);
}

#[tauri::command]
fn toggle_favorite(app: tauri::AppHandle, settings: State<SettingsState>, name: String) -> Vec<String> {
    let mut s = settings.0.lock().unwrap();
    if let Some(pos) = s.favorites.iter().position(|f| f == &name) {
        s.favorites.remove(pos);
    } else {
        s.favorites.push(name);
    }
    self::settings::save(&app, &s);
    s.favorites.clone()
}

#[tauri::command]
fn get_watch_progress(settings: State<SettingsState>) -> HashMap<String, WatchProgress> {
    settings.0.lock().unwrap().watch_progress.clone()
}

#[tauri::command]
fn set_watch_progress(
    app: tauri::AppHandle,
    settings: State<SettingsState>,
    episode_path: String,
    anime_name: String,
    position: f64,
    duration: f64,
) {
    let mut s = settings.0.lock().unwrap();
    s.watch_progress.insert(
        episode_path.clone(),
        WatchProgress {
            anime_name,
            episode_path,
            position,
            duration,
            updated_at: chrono::Local::now().timestamp_millis(),
        },
    );
    self::settings::save(&app, &s);
}

#[tauri::command]
fn reset_controls(app: tauri::AppHandle, settings: State<SettingsState>) -> ControlsConfig {
    let mut s = settings.0.lock().unwrap();
    s.controls = types::default_controls();
    self::settings::save(&app, &s);
    s.controls.clone()
}

#[tauri::command]
fn set_controls(app: tauri::AppHandle, settings: State<SettingsState>, next: ControlsConfig) {
    let mut s = settings.0.lock().unwrap();
    s.controls = next;
    self::settings::save(&app, &s);
}

#[tauri::command]
fn set_mal_credentials(
    app: tauri::AppHandle,
    settings: State<SettingsState>,
    client_id: String,
    client_secret: String,
) {
    let mut s = settings.0.lock().unwrap();
    s.mal_client_id = if client_id.is_empty() { None } else { Some(client_id) };
    s.mal_client_secret = if client_secret.is_empty() { None } else { Some(client_secret) };
    self::settings::save(&app, &s);
}

#[tauri::command]
async fn test_mal_client_id(client: State<'_, HttpClient>, client_id: String) -> Result<JobResult, ()> {
    Ok(metadata::test_mal_client_id(&client.0, &client_id).await)
}

#[tauri::command]
async fn find_subtitle(episode_path: String) -> Option<String> {
    let vtt_path = {
        let path = std::path::Path::new(&episode_path);
        let stem = path.file_stem()?.to_string_lossy().to_string();
        path.with_file_name(format!("{stem}.vtt"))
    };
    if tokio::fs::metadata(&vtt_path).await.is_ok() {
        Some(vtt_path.to_string_lossy().to_string())
    } else {
        None
    }
}

#[tauri::command]
async fn fetch_metadata(
    app: tauri::AppHandle,
    client: State<'_, HttpClient>,
    throttle: State<'_, ThrottleState>,
    cache: State<'_, MetadataCacheState>,
    settings: State<'_, SettingsState>,
    title: String,
    anime_path: String,
    force: Option<bool>,
) -> Result<Option<AnimeMetadata>, ()> {
    if let Some(local) = local_metadata::read_local_metadata(&anime_path).await {
        return Ok(Some(local));
    }

    let force = force.unwrap_or(false);
    let cached = if force { None } else { metadata_cache::get(&cache, &title) };

    let data = match cached {
        Some(cached_data) => cached_data,
        None => {
            let mal_client_id = settings.0.lock().unwrap().mal_client_id.clone();
            let fetched = metadata::fetch_metadata(&client.0, &throttle, &title, mal_client_id.as_deref()).await;
            metadata_cache::set(&app, &cache, &title, fetched.clone());
            fetched
        }
    };

    if let Some(meta) = &data {
        let _ = local_metadata::write_local_metadata(&anime_path, meta).await;
    }

    Ok(data)
}

#[tauri::command]
fn run_library_update(
    app: tauri::AppHandle,
    settings: State<SettingsState>,
    jkanime: State<JkanimeDlState>,
) -> JobResult {
    let library_path = settings.0.lock().unwrap().library_path.clone();
    let Some(library_path) = library_path else {
        return JobResult { ok: false, message: "No hay carpeta configurada.".into() };
    };
    if jkanime_dl::is_running(&jkanime) {
        return JobResult { ok: false, message: "Ya hay una operación en curso.".into() };
    }
    jkanime_dl::run_jkanime_dl(app, jkanime, vec![library_path, "-y".into()], Job::Update);
    JobResult { ok: true, message: "Iniciado".into() }
}

#[tauri::command]
fn run_library_download(
    app: tauri::AppHandle,
    settings: State<SettingsState>,
    jkanime: State<JkanimeDlState>,
) -> JobResult {
    let library_path = settings.0.lock().unwrap().library_path.clone();
    let Some(library_path) = library_path else {
        return JobResult { ok: false, message: "No hay carpeta configurada.".into() };
    };
    if jkanime_dl::is_running(&jkanime) {
        return JobResult { ok: false, message: "Ya hay una operación en curso.".into() };
    }

    let list_path = dirs::home_dir().unwrap_or_default().join("animes.txt");
    if !list_path.exists() {
        return JobResult {
            ok: false,
            message: format!(
                "No se encontró {}. Creá ese archivo con la lista de animes a descargar.",
                list_path.display()
            ),
        };
    }

    jkanime_dl::run_jkanime_dl(
        app,
        jkanime,
        vec![list_path.to_string_lossy().to_string(), "-o".into(), library_path, "-y".into()],
        Job::Download,
    );
    JobResult { ok: true, message: "Iniciado".into() }
}

fn quit_app(app: &tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn quit(app: tauri::AppHandle) {
    quit_app(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            log_message,
            get_media_port,
            get_settings,
            select_library_folder,
            set_library_path,
            get_library,
            set_scan_on_start,
            toggle_favorite,
            get_watch_progress,
            set_watch_progress,
            reset_controls,
            set_controls,
            set_mal_credentials,
            test_mal_client_id,
            find_subtitle,
            fetch_metadata,
            run_library_update,
            run_library_download,
            quit,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            let loaded_settings = self::settings::load(&handle);
            let library_path_for_log = loaded_settings.library_path.clone();
            app.manage(SettingsState(std::sync::Mutex::new(loaded_settings)));

            let cache = metadata_cache::load(&handle);
            app.manage(MetadataCacheState(std::sync::Mutex::new(cache)));

            app.manage(JkanimeDlState::default());
            app.manage(ThrottleState::default());
            app.manage(HttpClient(reqwest::Client::new()));

            let fallback_dir = handle.path().app_config_dir().unwrap_or_default();
            let logger = Logger::init(library_path_for_log.as_deref(), fallback_dir);
            logger.log("info", "app: setup");
            app.manage(logger);

            let port = media_server::start();
            if let Some(logger) = app.try_state::<Logger>() {
                logger.log("info", &format!("media server: escuchando en 127.0.0.1:{port}"));
            }
            app.manage(MediaPort(port));

            if let Some(window) = app.get_webview_window("main") {
                if !cfg!(debug_assertions) {
                    let _ = window.set_fullscreen(true);
                }
                let logger_handle = handle.clone();
                window.on_window_event(move |event| {
                    if let Some(logger) = logger_handle.try_state::<Logger>() {
                        match event {
                            tauri::WindowEvent::CloseRequested { .. } => {
                                logger.log("info", "window: close event recibido")
                            }
                            tauri::WindowEvent::Destroyed => logger.log("info", "window: closed"),
                            _ => {}
                        }
                    }
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(logger) = app_handle.try_state::<Logger>() {
                    logger.log("info", "app: before-quit / will-quit");
                }
            }
        });
}
