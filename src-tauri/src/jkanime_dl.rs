use crate::types::JobResult;
use regex::Regex;
use std::process::Stdio;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Clone, Copy, PartialEq)]
pub enum Job {
    Update,
    Download,
}

impl Job {
    fn name(self) -> &'static str {
        match self {
            Job::Update => "update",
            Job::Download => "download",
        }
    }
}

#[derive(Default)]
pub struct JkanimeDlState(pub Mutex<bool>);

pub fn is_running(state: &JkanimeDlState) -> bool {
    *state.0.lock().unwrap()
}

fn strip_ansi(text: &str) -> String {
    // eslint-disable-next-line no-control-regex (same rationale as the old Node version)
    let re = Regex::new(r"\x1b\[[0-9;]*[a-zA-Z]").unwrap();
    re.replace_all(text, "").to_string()
}

/// Spawns `jkanime-dl` with the given args and streams stdout/stderr to the
/// frontend as `library:<job>:output` events, matching the started/output/done
/// event trio the renderer already listens for. Unlike the old Node version,
/// Command::spawn() failing (binary missing) returns an Err synchronously here
/// — no need to guard against 'error' and 'close' firing twice for the same
/// failure like Node's ChildProcess did.
pub fn run_jkanime_dl(app: AppHandle, state: tauri::State<'_, JkanimeDlState>, args: Vec<String>, job: Job) {
    {
        let mut running = state.0.lock().unwrap();
        if *running {
            return;
        }
        *running = true;
    }

    let job_name = job.name();
    let _ = app.emit(&format!("library:{job_name}:started"), ());

    tauri::async_runtime::spawn(async move {
        let spawned = Command::new("jkanime-dl")
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();

        let mut child = match spawned {
            Ok(child) => child,
            Err(err) => {
                let message = if err.kind() == std::io::ErrorKind::NotFound {
                    "jkanime-dl no está instalado o no está en el PATH.".to_string()
                } else {
                    format!("No se pudo ejecutar jkanime-dl: {err}")
                };
                let _ = app.emit(&format!("library:{job_name}:done"), JobResult { ok: false, message });
                *app.state::<JkanimeDlState>().0.lock().unwrap() = false;
                return;
            }
        };

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let app_out = app.clone();
        let app_err = app.clone();

        let out_task = tokio::spawn(async move {
            if let Some(stdout) = stdout {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let clean = strip_ansi(&line);
                    if !clean.trim().is_empty() {
                        let _ = app_out.emit(&format!("library:{job_name}:output"), clean);
                    }
                }
            }
        });
        let err_task = tokio::spawn(async move {
            if let Some(stderr) = stderr {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let clean = strip_ansi(&line);
                    if !clean.trim().is_empty() {
                        let _ = app_err.emit(&format!("library:{job_name}:output"), clean);
                    }
                }
            }
        });

        let status = child.wait().await;
        let _ = out_task.await;
        let _ = err_task.await;

        let result = match status {
            Ok(status) if status.success() => JobResult { ok: true, message: "Completado.".into() },
            Ok(status) => JobResult {
                ok: false,
                message: format!("jkanime-dl terminó con código {}", status.code().unwrap_or(-1)),
            },
            Err(err) => JobResult { ok: false, message: format!("No se pudo ejecutar jkanime-dl: {err}") },
        };

        let _ = app.emit(&format!("library:{job_name}:done"), result);
        *app.state::<JkanimeDlState>().0.lock().unwrap() = false;
    });
}
