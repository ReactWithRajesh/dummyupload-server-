const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

// -------------------------------------------
// Allow ANY domain (all localhost + all URLs)
// -------------------------------------------
app.use(
  cors({
    origin: "*",
    methods: "GET,POST,OPTIONS",
    allowedHeaders: [
      "Content-Type",
      "X-Upload-Id",
      "X-Chunk-Index",
      "X-Total-Chunks"
    ],
  })
);

app.options("*", cors());
app.use(express.json());

// Upload directory setup
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + ".chunk"),
});
const upload = multer({ storage });

// ========================================
// Receive chunk upload
// ========================================
app.post("/api/upload-video", upload.single("file"), (req, res) => {
  const uploadId = req.headers["x-upload-id"];
  const chunkIndex = req.headers["x-chunk-index"];
  const totalChunks = req.headers["x-total-chunks"];

  if (!uploadId || chunkIndex === undefined) {
    return res.status(400).json({ error: "Missing headers" });
  }

  const chunkFilename = `${uploadId}-chunk-${chunkIndex}`;
  const finalPath = path.join(UPLOAD_DIR, chunkFilename);

  fs.rename(req.file.path, finalPath, (err) => {
    if (err) return res.status(500).json({ error: "Failed to store chunk" });

    console.log("✔ Stored chunk:", chunkFilename);

    res.json({
      success: true,
      chunkIndex: Number(chunkIndex),
      totalChunks: Number(totalChunks),
      storedAs: chunkFilename,
    });
  });
});

// Static file serving
app.use("/uploads", express.static(UPLOAD_DIR));

// Root endpoint
app.get("/", (req, res) => {
  res.send("Chunk upload server with OPEN CORS is running.");
});

// Start server
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Backend active at http://localhost:${PORT}`);
});
