const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

// ----------------------------
// CORS (Required for Codespaces)
// ----------------------------
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Chunk-Id", "X-Chunk-Index"],
  })
);

app.options("*", cors());
app.use(express.json());

// ----------------------------
// Upload Directories
// ----------------------------
const UPLOAD_DIR = path.join(__dirname, "uploads");
const CHUNK_DIR = path.join(UPLOAD_DIR, "chunks");
const MERGED_DIR = path.join(UPLOAD_DIR, "merged");

// Create folders
fs.mkdirSync(CHUNK_DIR, { recursive: true });
fs.mkdirSync(MERGED_DIR, { recursive: true });

// ----------------------------
// Multer (Store chunks temp)
// ----------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CHUNK_DIR),
  filename: (req, file, cb) => cb(null, Date.now().toString()),
});

const upload = multer({ storage });

// ----------------------------
// 1. Receive a chunk
// ----------------------------
app.post("/api/upload-chunk", upload.single("file"), (req, res) => {
  const chunkId = req.headers["x-chunk-id"];
  const chunkIndex = req.headers["x-chunk-index"];

  if (!chunkId || chunkIndex === undefined) {
    return res.status(400).json({ error: "Missing chunk headers" });
  }

  const finalChunkName = `${chunkId}-${chunkIndex}`;
  const destPath = path.join(CHUNK_DIR, finalChunkName);

  fs.rename(req.file.path, destPath, (err) => {
    if (err) return res.status(500).json({ error: "Failed to write chunk" });

    console.log(`✔ Stored chunk ${finalChunkName}`);
    res.json({ success: true });
  });
});

// ----------------------------
// 2. Merge all chunks
// ----------------------------
app.post("/api/merge-chunks", async (req, res) => {
  const { fileName, totalChunks } = req.body;

  if (!fileName || totalChunks === undefined) {
    return res.status(400).json({ error: "Missing merge info" });
  }

  const outputFile = path.join(MERGED_DIR, fileName);
  const writeStream = fs.createWriteStream(outputFile);

  console.log(`🔧 Merging ${totalChunks} chunks into ${outputFile}`);

  for (let i = 0; i < totalChunks; i++) {
    const chunkName = `${fileName}-chunk-${i}`;
    const chunkPath = path.join(CHUNK_DIR, chunkName);

    if (fs.existsSync(chunkPath)) {
      console.log(`➡ Adding ${chunkName}`);
      writeStream.write(fs.readFileSync(chunkPath));
      fs.unlinkSync(chunkPath);
    } else {
      console.warn(`⚠ Missing chunk: ${chunkName}`);
    }
  }

  writeStream.end();

  writeStream.on("finish", () => {
    console.log(`🎉 Merge complete: ${fileName}`);
    res.json({
      success: true,
      fileUrl: `/uploads/merged/${fileName}`,
    });
  });
});

// ----------------------------
// Static access to final files
// ----------------------------
app.use("/uploads", express.static(UPLOAD_DIR));

// ----------------------------
// Start Server
// ----------------------------
app.listen(8080, () => {
  console.log("🚀 Upload server running at:");
  console.log("👉 http://localhost:8080");
});
