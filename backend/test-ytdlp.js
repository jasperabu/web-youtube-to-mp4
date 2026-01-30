import ytdlp from "yt-dlp-exec";

console.log("Testing yt-dlp...\n");

const testUrl = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

async function test() {
  try {
    console.log("1️⃣ Testing basic metadata fetch...");
    const info = await ytdlp(testUrl, {
      dumpSingleJson: true,
      noWarnings: true,
    });
    
    console.log("✅ SUCCESS!");
    console.log("Title:", info.title);
    console.log("Duration:", info.duration_string);
    console.log("Formats available:", info.formats.length);
    
  } catch (err) {
    console.error("❌ FAILED!");
    console.error("Error:", err.message);
    console.error("\nFull error:");
    console.error(err);
  }
}

test();