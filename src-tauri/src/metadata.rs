use crate::types::{AnimeMetadata, JobResult};
use serde_json::Value;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::sync::Mutex as AsyncMutex;

const JIKAN_URL: &str = "https://api.jikan.moe/v4/anime";
const MAL_URL: &str = "https://api.myanimelist.net/v2/anime";
const MYMEMORY_URL: &str = "https://api.mymemory.translated.net/get";
const MAL_FIELDS: &str = "id,title,alternative_titles,main_picture,synopsis,mean,genres,num_episodes,status";

// Jikan's sustained limit is 60 req/min (not just the 3 req/s burst cap), so the
// floor delay must average out to >=1s/call. Same lock also throttles MAL calls.
const MIN_INTERVAL: Duration = Duration::from_millis(1000);

pub struct ThrottleState {
    // Serializes calls so only one request is in flight/waiting at a time.
    pub gate: AsyncMutex<()>,
    pub last_call_at: Mutex<Option<Instant>>,
}

impl Default for ThrottleState {
    fn default() -> Self {
        Self { gate: AsyncMutex::new(()), last_call_at: Mutex::new(None) }
    }
}

async fn throttle(state: &ThrottleState) {
    let _permit = state.gate.lock().await;
    let wait = {
        let last = state.last_call_at.lock().unwrap();
        match *last {
            Some(t) => {
                let elapsed = t.elapsed();
                if elapsed < MIN_INTERVAL { Some(MIN_INTERVAL - elapsed) } else { None }
            }
            None => None,
        }
    };
    if let Some(wait) = wait {
        tokio::time::sleep(wait).await;
    }
    *state.last_call_at.lock().unwrap() = Some(Instant::now());
}

async fn translate_to_spanish(client: &reqwest::Client, text: &str) -> String {
    let truncated: String = text.chars().take(490).collect();
    let url = format!(
        "{MYMEMORY_URL}?q={}&langpair=en|es",
        percent_encoding::utf8_percent_encode(&truncated, percent_encoding::NON_ALPHANUMERIC)
    );
    let result: Option<String> = async {
        let res = client.get(&url).send().await.ok()?;
        if !res.status().is_success() {
            return None;
        }
        let json: Value = res.json().await.ok()?;
        json.get("responseData")?.get("translatedText")?.as_str().map(String::from)
    }
    .await;
    match result {
        Some(t) if !t.is_empty() => t,
        _ => text.to_string(),
    }
}

async fn fetch_from_mal(
    client: &reqwest::Client,
    search_title: &str,
    client_id: &str,
) -> Option<AnimeMetadata> {
    let url = format!(
        "{MAL_URL}?q={}&limit=1&fields={MAL_FIELDS}",
        percent_encoding::utf8_percent_encode(search_title, percent_encoding::NON_ALPHANUMERIC)
    );
    let res = client.get(&url).header("X-MAL-CLIENT-ID", client_id).send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let json: Value = res.json().await.ok()?;
    let node = json.get("data")?.get(0)?.get("node")?;

    let synopsis_en = node.get("synopsis").and_then(|v| v.as_str()).map(String::from);
    let synopsis_es = match &synopsis_en {
        Some(s) => Some(translate_to_spanish(client, s).await),
        None => None,
    };

    Some(AnimeMetadata {
        id: node.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
        title: node
            .get("alternative_titles")
            .and_then(|v| v.get("en"))
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(String::from)
            .or_else(|| node.get("title").and_then(|v| v.as_str()).map(String::from))
            .unwrap_or_default(),
        description: synopsis_es,
        cover_image: node
            .get("main_picture")
            .and_then(|p| p.get("large").or_else(|| p.get("medium")))
            .and_then(|v| v.as_str())
            .map(String::from),
        banner_image: None,
        genres: node
            .get("genres")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|g| g.get("name")?.as_str().map(String::from)).collect())
            .unwrap_or_default(),
        episodes: node.get("num_episodes").and_then(|v| v.as_i64()),
        score: node.get("mean").and_then(|v| v.as_f64()),
    })
}

async fn fetch_from_jikan(client: &reqwest::Client, search_title: &str) -> Option<AnimeMetadata> {
    let url = format!(
        "{JIKAN_URL}?q={}&limit=1",
        percent_encoding::utf8_percent_encode(search_title, percent_encoding::NON_ALPHANUMERIC)
    );
    let res = client.get(&url).send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let json: Value = res.json().await.ok()?;
    let anime = json.get("data")?.get(0)?;

    let synopsis_en = anime.get("synopsis").and_then(|v| v.as_str()).map(String::from);
    let synopsis_es = match &synopsis_en {
        Some(s) => Some(translate_to_spanish(client, s).await),
        None => None,
    };

    Some(AnimeMetadata {
        id: anime.get("mal_id").and_then(|v| v.as_i64()).unwrap_or(0),
        title: anime
            .get("title_english")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(String::from)
            .or_else(|| anime.get("title").and_then(|v| v.as_str()).map(String::from))
            .unwrap_or_default(),
        description: synopsis_es,
        cover_image: anime
            .get("images")
            .and_then(|i| i.get("jpg"))
            .and_then(|j| j.get("large_image_url").or_else(|| j.get("image_url")))
            .and_then(|v| v.as_str())
            .map(String::from),
        banner_image: None,
        genres: anime
            .get("genres")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|g| g.get("name")?.as_str().map(String::from)).collect())
            .unwrap_or_default(),
        episodes: anime.get("episodes").and_then(|v| v.as_i64()),
        score: anime.get("score").and_then(|v| v.as_f64()),
    })
}

pub async fn fetch_metadata(
    client: &reqwest::Client,
    throttle_state: &ThrottleState,
    search_title: &str,
    mal_client_id: Option<&str>,
) -> Option<AnimeMetadata> {
    throttle(throttle_state).await;
    if let Some(client_id) = mal_client_id {
        if let Some(result) = fetch_from_mal(client, search_title, client_id).await {
            return Some(result);
        }
    }
    fetch_from_jikan(client, search_title).await
}

pub async fn test_mal_client_id(client: &reqwest::Client, client_id: &str) -> JobResult {
    let url = format!("{MAL_URL}?q=one&limit=1");
    match client.get(&url).header("X-MAL-CLIENT-ID", client_id).send().await {
        Ok(res) if res.status().is_success() => {
            JobResult { ok: true, message: "Client ID válido".into() }
        }
        Ok(res) if res.status() == 401 || res.status() == 403 => {
            JobResult { ok: false, message: "Client ID inválido o no autorizado".into() }
        }
        Ok(res) => JobResult {
            ok: false,
            message: format!("MyAnimeList respondió con error {}", res.status().as_u16()),
        },
        Err(_) => JobResult { ok: false, message: "No se pudo conectar con MyAnimeList".into() },
    }
}
