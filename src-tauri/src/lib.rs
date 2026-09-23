use serde_json::Value;
use std::{
    io::{ErrorKind, Read},
    net::TcpStream,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tauri::{AppHandle, Emitter, State};

const LUMASTUDIO_MEDIA_ADDR: &str = "127.0.0.1:9462";
const MAX_MEDIA_FRAME_BYTES: usize = 4_000_000;

#[derive(Default)]
struct StudioMediaListenerState {
    started: AtomicBool,
}

fn read_media_frame<R: Read>(reader: &mut R) -> Result<Option<Value>, String> {
    let mut len = [0_u8; 4];
    match reader.read_exact(&mut len) {
        Ok(()) => {}
        Err(error)
            if matches!(
                error.kind(),
                ErrorKind::UnexpectedEof
                    | ErrorKind::ConnectionReset
                    | ErrorKind::BrokenPipe
                    | ErrorKind::TimedOut
                    | ErrorKind::WouldBlock
            ) =>
        {
            return Ok(None);
        }
        Err(error) => return Err(error.to_string()),
    }

    let size = u32::from_be_bytes(len) as usize;
    if size == 0 || size > MAX_MEDIA_FRAME_BYTES {
        return Err(format!("Studio media frame size {size} is outside the safe range."));
    }

    let mut payload = vec![0_u8; size];
    reader
        .read_exact(&mut payload)
        .map_err(|error| error.to_string())?;
    serde_json::from_slice(&payload).map(Some).map_err(|error| error.to_string())
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn framed(value: &Value) -> Vec<u8> {
        let payload = serde_json::to_vec(value).unwrap();
        let mut bytes = Vec::with_capacity(payload.len() + 4);
        bytes.extend_from_slice(&(payload.len() as u32).to_be_bytes());
        bytes.extend_from_slice(&payload);
        bytes
    }

    #[test]
    fn parses_studio_media_frames() {
        let value = serde_json::json!({
            "type": "lumastudio.media",
            "version": 1,
            "outputId": "main",
            "timestamp": 10,
            "positionSeconds": 2.5,
            "playing": true
        });
        let mut cursor = Cursor::new(framed(&value));
        assert_eq!(read_media_frame(&mut cursor).unwrap(), Some(value));
    }

    #[test]
    fn rejects_oversized_media_frames() {
        let mut cursor = Cursor::new(((MAX_MEDIA_FRAME_BYTES as u32) + 1).to_be_bytes().to_vec());
        assert!(read_media_frame(&mut cursor).unwrap_err().contains("outside the safe range"));
    }

    #[test]
    fn treats_disconnect_before_a_header_as_no_frame() {
        let mut cursor = Cursor::new(Vec::<u8>::new());
        assert_eq!(read_media_frame(&mut cursor).unwrap(), None);
    }
}
