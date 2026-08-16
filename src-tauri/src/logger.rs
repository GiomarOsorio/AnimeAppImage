use chrono::Local;
use rand::Rng;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

const LOG_PREFIX: &str = "anime-appimage-";
const MAX_LOG_FILES: usize = 15;

pub struct Logger {
    file: Mutex<Option<File>>,
}

impl Logger {
    pub fn init(library_path: Option<&str>, fallback_dir: PathBuf) -> Self {
        let primary = library_path.map(|p| PathBuf::from(p).join("logs"));

        let (dir, fallback_note) = match &primary {
            Some(dir) if fs::create_dir_all(dir).is_ok() => (dir.clone(), None),
            _ => {
                let _ = fs::create_dir_all(&fallback_dir);
                (fallback_dir, primary)
            }
        };

        prune_old_logs(&dir);

        let now = Local::now();
        let stamp = now.format("%Y%m%d-%H%M%S");
        let unique: u32 = rand::thread_rng().gen_range(0x1000..0xffffff);
        let log_path = dir.join(format!("{LOG_PREFIX}{stamp}-{unique:06x}.log"));

        let file = OpenOptions::new().create(true).append(true).open(&log_path).ok();
        let logger = Logger { file: Mutex::new(file) };

        logger.log("info", &format!("=== Log iniciado: {} ===", log_path.display()));
        logger.log(
            "info",
            &format!("Plataforma: {}, Tauri, App: {}", std::env::consts::OS, env!("CARGO_PKG_VERSION")),
        );
        let args: Vec<String> = std::env::args().collect();
        logger.log("info", &format!("argv: {}", args.join(" ")));
        logger.log(
            "info",
            &format!(
                "Sesión — XDG_SESSION_TYPE={} WAYLAND_DISPLAY={} DISPLAY={} SteamDeck={} SteamGamepadUI={}",
                std::env::var("XDG_SESSION_TYPE").unwrap_or_default(),
                std::env::var("WAYLAND_DISPLAY").unwrap_or_default(),
                std::env::var("DISPLAY").unwrap_or_default(),
                std::env::var("SteamDeck").unwrap_or_default(),
                std::env::var("SteamGamepadUI").unwrap_or_default(),
            ),
        );
        if let Some(fallback_from) = fallback_note {
            logger.log(
                "warn",
                &format!("No se pudo escribir logs en {}, usando carpeta de datos de la app", fallback_from.display()),
            );
        }

        logger
    }

    pub fn log(&self, level: &str, message: &str) {
        let line = format!(
            "[{}] [{}] {}",
            Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
            level.to_uppercase(),
            message
        );
        match level {
            "error" => eprintln!("{line}"),
            "warn" => eprintln!("{line}"),
            _ => println!("{line}"),
        }
        if let Some(file) = self.file.lock().unwrap().as_mut() {
            let _ = writeln!(file, "{line}");
        }
    }
}

fn prune_old_logs(dir: &PathBuf) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    let mut files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with(LOG_PREFIX) && n.ends_with(".log"))
                .unwrap_or(false)
        })
        .collect();
    files.sort();
    if files.len() > MAX_LOG_FILES {
        for path in &files[..files.len() - MAX_LOG_FILES] {
            let _ = fs::remove_file(path);
        }
    }
}
