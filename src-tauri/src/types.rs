use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Season {
    pub name: String,
    pub episodes: Vec<Episode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anime {
    pub name: String,
    pub path: String,
    pub seasons: Vec<Season>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryScanResult {
    pub animes: Vec<Anime>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimeMetadata {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "coverImage")]
    pub cover_image: Option<String>,
    #[serde(rename = "bannerImage")]
    pub banner_image: Option<String>,
    pub genres: Vec<String>,
    pub episodes: Option<i64>,
    pub score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlsConfig {
    pub keyboard: HashMap<String, String>,
    pub gamepad: HashMap<String, i64>,
}

pub fn default_controls() -> ControlsConfig {
    let mut keyboard = HashMap::new();
    keyboard.insert("up".into(), "ArrowUp".into());
    keyboard.insert("down".into(), "ArrowDown".into());
    keyboard.insert("left".into(), "ArrowLeft".into());
    keyboard.insert("right".into(), "ArrowRight".into());
    keyboard.insert("confirm".into(), "Enter".into());
    keyboard.insert("back".into(), "Escape".into());
    keyboard.insert("toggleFavorite".into(), "f".into());
    keyboard.insert("settings".into(), "F2".into());
    keyboard.insert("help".into(), "F1".into());
    keyboard.insert("quit".into(), "q".into());

    let mut gamepad = HashMap::new();
    gamepad.insert("up".into(), 12);
    gamepad.insert("down".into(), 13);
    gamepad.insert("left".into(), 14);
    gamepad.insert("right".into(), 15);
    gamepad.insert("confirm".into(), 0);
    gamepad.insert("back".into(), 1);
    gamepad.insert("toggleFavorite".into(), 3);
    gamepad.insert("settings".into(), 9);
    gamepad.insert("help".into(), 8);
    gamepad.insert("quit".into(), 2);

    ControlsConfig { keyboard, gamepad }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchProgress {
    #[serde(rename = "animeName")]
    pub anime_name: String,
    #[serde(rename = "episodePath")]
    pub episode_path: String,
    pub position: f64,
    pub duration: f64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub library_path: Option<String>,
    pub favorites: Vec<String>,
    pub mal_client_id: Option<String>,
    pub mal_client_secret: Option<String>,
    pub controls: ControlsConfig,
    pub watch_progress: HashMap<String, WatchProgress>,
    pub scan_on_start: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct JobResult {
    pub ok: bool,
    pub message: String,
}
