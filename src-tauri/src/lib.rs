mod media_frame;
use media_frame::read_media_frame;
use std::{
    net::TcpStream,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tauri::{AppHandle, Emitter, State};

const LUMASTUDIO_MEDIA_ADDR: &str = "127.0.0.1:9462";

#[derive(Default)]
struct StudioMediaListenerState {
    started: AtomicBool,
}

#[tauri::command]
fn start_lumastudio_media_listener(
    app: AppHandle,
    state: State<'_, StudioMediaListenerState>,
) -> Result<(), String> {
    if state.started.swap(true, Ordering::AcqRel) {
        return Ok(());
    }

    std::thread::spawn(move || loop {
        match TcpStream::connect(LUMASTUDIO_MEDIA_ADDR) {
            Ok(mut stream) => {
                // A silent or partial frame must not pin this reader forever.
                if stream.set_read_timeout(Some(Duration::from_millis(250))).is_err() {
                    std::thread::sleep(Duration::from_millis(750));
                    continue;
                }
                let _ = app.emit("lumastudio-media-status", "connected");

                loop {
                    match read_media_frame(&mut stream) {
                        Ok(Some(frame)) => {
                            let _ = app.emit("lumastudio-media", frame);
                        }
                        Ok(None) | Err(_) => break,
                    }
                }

                let _ = app.emit("lumastudio-media-status", "offline");
            }
            Err(_) => {
                let _ = app.emit("lumastudio-media-status", "offline");
            }
        }

        std::thread::sleep(Duration::from_millis(750));
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(StudioMediaListenerState::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![start_lumastudio_media_listener])
        .run(tauri::generate_context!())
        .expect("error while running LumaStage");
}

