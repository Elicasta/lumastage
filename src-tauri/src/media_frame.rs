use serde_json::Value;
use std::io::{ErrorKind, Read};
use std::time::{Duration, Instant};

const MAX_MEDIA_FRAME_BYTES: usize = 4_000_000;

// The socket must have a short read timeout. One absolute deadline covers both
// header and body, including slow senders that make partial progress.
pub fn read_media_frame<R: Read>(reader: &mut R) -> Result<Option<Value>, String> {
    read_with_budget(reader, Duration::from_secs(5))
}

fn read_with_budget<R: Read>(reader: &mut R, budget: Duration) -> Result<Option<Value>, String> {
    let deadline = Instant::now() + budget;
    let mut header = [0; 4];
    if !fill(reader, &mut header, deadline, true)? { return Ok(None); }
    let size = u32::from_be_bytes(header) as usize;
    if size == 0 || size > MAX_MEDIA_FRAME_BYTES {
        return Err(format!("Studio media frame size {size} is outside the safe range."));
    }
    let mut payload = vec![0; size];
    fill(reader, &mut payload, deadline, false)?;
    serde_json::from_slice(&payload).map(Some).map_err(|error| error.to_string())
}

fn fill<R: Read>(reader: &mut R, bytes: &mut [u8], deadline: Instant, clean_eof: bool) -> Result<bool, String> {
    let mut offset = 0;
    while offset < bytes.len() {
        if Instant::now() >= deadline { return Err("Studio media frame deadline exceeded.".into()); }
        match reader.read(&mut bytes[offset..]) {
            Ok(0) if offset == 0 && clean_eof => return Ok(false),
            Ok(0) => return Err("Studio disconnected during a media frame.".into()),
            Ok(count) => offset += count,
            Err(error) if matches!(error.kind(), ErrorKind::Interrupted | ErrorKind::TimedOut | ErrorKind::WouldBlock) => continue,
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{io::{Cursor, Write}, net::{TcpListener, TcpStream}};

    #[test]
    fn parses_fragmented_frames_without_losing_alignment() {
        struct Fragmented(Cursor<Vec<u8>>);
        impl Read for Fragmented {
            fn read(&mut self, bytes: &mut [u8]) -> std::io::Result<usize> { self.0.read(&mut bytes[..1]) }
        }
        let payload = br#"{"type":"lumastudio.media","version":1}"#;
        let mut bytes = (payload.len() as u32).to_be_bytes().to_vec();
        bytes.extend_from_slice(payload);
        let mut reader = Fragmented(Cursor::new(bytes.repeat(2)));
        for _ in 0..2 { assert_eq!(read_media_frame(&mut reader).unwrap().unwrap()["version"], 1); }
        assert!(read_media_frame(&mut reader).unwrap().is_none());
    }

    #[test]
    fn rejects_oversized_and_truncated_frames() {
        assert!(read_media_frame(&mut Cursor::new((MAX_MEDIA_FRAME_BYTES as u32 + 1).to_be_bytes())).is_err());
        assert!(read_media_frame(&mut Cursor::new(vec![0, 0])).is_err());
        assert!(read_media_frame(&mut Cursor::new(vec![0, 0, 0, 4, b'{'])).is_err());
    }

    #[test]
    fn stalled_peer_cannot_hold_a_partial_frame_forever() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let mut client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (mut server, _) = listener.accept().unwrap();
        client.set_read_timeout(Some(Duration::from_millis(10))).unwrap();
        server.write_all(&[0, 0, 0, 4, b'{']).unwrap();
        let start = Instant::now();
        assert!(read_with_budget(&mut client, Duration::from_millis(60)).unwrap_err().contains("deadline"));
        assert!(start.elapsed() < Duration::from_secs(2));
    }
}
