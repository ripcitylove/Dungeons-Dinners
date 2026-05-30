// Returns a minimal 1-sample silent WAV (46 bytes) with no processing delay.
// Used by the campaign page to activate the narration <audio> element inside
// the "Begin Adventure" user gesture, so Xbox Edge grants it play permission.
export async function GET() {
  // RIFF/WAVE header + fmt chunk + 1 silent 16-bit sample at 44100 Hz mono
  const buf = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x26, 0x00, 0x00, 0x00, // ChunkSize = 38
    0x57, 0x41, 0x56, 0x45, // "WAVE"
    0x66, 0x6D, 0x74, 0x20, // "fmt "
    0x10, 0x00, 0x00, 0x00, // SubchunkSize = 16
    0x01, 0x00,             // AudioFormat = 1 (PCM)
    0x01, 0x00,             // NumChannels = 1 (mono)
    0x44, 0xAC, 0x00, 0x00, // SampleRate = 44100
    0x88, 0x58, 0x01, 0x00, // ByteRate = 88200
    0x02, 0x00,             // BlockAlign = 2
    0x10, 0x00,             // BitsPerSample = 16
    0x64, 0x61, 0x74, 0x61, // "data"
    0x02, 0x00, 0x00, 0x00, // SubchunkSize = 2
    0x00, 0x00,             // one silent 16-bit sample
  ]);
  return new Response(buf, {
    headers: {
      "Content-Type":   "audio/wav",
      "Content-Length": "46",
      "Cache-Control":  "public, max-age=31536000, immutable",
    },
  });
}
