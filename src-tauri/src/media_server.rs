use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::net::TcpListener;
use std::path::Path;
use tiny_http::{Header, Response, Server, StatusCode};

const ALLOWED_EXTENSIONS: &[&str] = &[".mp4", ".mkv", ".avi", ".webm", ".mov", ".vtt"];

fn mime_for(ext: &str) -> &'static str {
    match ext {
        ".mp4" => "video/mp4",
        ".mkv" => "video/x-matroska",
        ".avi" => "video/x-msvideo",
        ".webm" => "video/webm",
        ".mov" => "video/quicktime",
        ".vtt" => "text/vtt",
        _ => "application/octet-stream",
    }
}

fn extension_of(path: &str) -> String {
    Path::new(path)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
        .unwrap_or_default()
}

fn parse_range(header: &str, file_size: u64) -> Option<(u64, u64)> {
    let spec = header.strip_prefix("bytes=")?;
    let (start_str, end_str) = spec.split_once('-')?;
    let start: u64 = if start_str.is_empty() { 0 } else { start_str.parse().ok()? };
    let mut end: u64 = if end_str.is_empty() { file_size.saturating_sub(1) } else { end_str.parse().ok()? };
    if end >= file_size {
        end = file_size.saturating_sub(1);
    }
    if start > end || start >= file_size {
        return None;
    }
    Some((start, end))
}

/// Local-only HTTP server serving video/subtitle files by absolute path, with real
/// Range/206 support — <video> depends on real 206 responses for seeking. Bound to
/// 127.0.0.1 on an OS-assigned port so it's not reachable from the network. This
/// replaces the app-media:// custom scheme the Electron build used: WebKitGTK's
/// handling of custom URI schemes + Range requests is a rockier, less-tested path
/// than a plain loopback HTTP server, which is indistinguishable from any normal
/// video URL to the WebView.
pub fn start() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("no se pudo abrir el servidor de medios");
    let port = listener.local_addr().unwrap().port();
    let server = Server::from_listener(listener, None).expect("no se pudo iniciar el servidor de medios");

    std::thread::spawn(move || {
        for request in server.incoming_requests() {
            handle(request);
        }
    });

    port
}

fn handle(request: tiny_http::Request) {
    let url = request.url().to_string();
    // URL shape: /<percent-encoded absolute path>
    let encoded = url.trim_start_matches('/');
    let decoded = percent_encoding::percent_decode_str(encoded).decode_utf8_lossy().to_string();

    let ext = extension_of(&decoded);
    if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        let _ = request.respond(Response::empty(StatusCode(403)));
        return;
    }

    let file_size = match std::fs::metadata(&decoded) {
        Ok(meta) => meta.len(),
        Err(_) => {
            let _ = request.respond(Response::empty(StatusCode(404)));
            return;
        }
    };

    let range_header = request
        .headers()
        .iter()
        .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case("range"))
        .map(|h| h.value.as_str().to_string());

    let content_type = Header::from_bytes(&b"Content-Type"[..], mime_for(&ext).as_bytes()).unwrap();
    let accept_ranges = Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap();

    let Some(range_header) = range_header else {
        let file = match File::open(&decoded) {
            Ok(f) => f,
            Err(_) => {
                let _ = request.respond(Response::empty(StatusCode(404)));
                return;
            }
        };
        let response = Response::from_file(file)
            .with_status_code(200)
            .with_header(content_type)
            .with_header(accept_ranges);
        let _ = request.respond(response);
        return;
    };

    let Some((start, end)) = parse_range(&range_header, file_size) else {
        let content_range =
            Header::from_bytes(&b"Content-Range"[..], format!("bytes */{file_size}").as_bytes()).unwrap();
        let response = Response::empty(StatusCode(416)).with_header(content_range);
        let _ = request.respond(response);
        return;
    };

    let mut file = match File::open(&decoded) {
        Ok(f) => f,
        Err(_) => {
            let _ = request.respond(Response::empty(StatusCode(404)));
            return;
        }
    };
    if file.seek(SeekFrom::Start(start)).is_err() {
        let _ = request.respond(Response::empty(StatusCode(500)));
        return;
    }
    let length = end - start + 1;
    let body = file.take(length);

    let content_range =
        Header::from_bytes(&b"Content-Range"[..], format!("bytes {start}-{end}/{file_size}").as_bytes()).unwrap();
    let response = Response::new(StatusCode(206), vec![content_type, accept_ranges, content_range], body, Some(length as usize), None);
    let _ = request.respond(response);
}
