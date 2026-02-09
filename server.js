const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();

// ================= FOLDERS =================
const uploadDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "public", "output");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// ================= MIDDLEWARE =================
app.use(express.static("public"));
app.use("/output", express.static(outputDir));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ================= MULTER =================
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ================= ROUTES =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/video-to-mp3", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "video-to-mp3.html"));
});

app.get("/image-compress", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "image-compress.html"));
});

app.get("/remove-bg", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "remove-bg.html"));
});

// ===================================================
// 🎵 VIDEO TO MP3
// ===================================================
app.post("/video-to-mp3", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video uploaded" });
  }

  const inputPath = req.file.path;
  const outputName = Date.now() + ".mp3";
  const outputPath = path.join(outputDir, outputName);

  ffmpeg(inputPath)
    .outputOptions("-vn")
    .audioBitrate(192)
    .toFormat("mp3")
    .on("end", () => {
      fs.unlinkSync(inputPath);
      res.json({
        success: true,
        file: "/output/" + outputName,
      });
    })
    .on("error", (err) => {
      console.error(err);
      res.status(500).json({ error: "MP3 conversion failed" });
    })
    .save(outputPath);
});

// ===================================================
// 🖼 IMAGE COMPRESS (NO exec, PURE ffmpeg)
// ===================================================
app.post("/compress-image", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).send("No image");

  const quality = Number(req.body.quality || 60);
  const inputPath = req.file.path;
  const outputPath = path.join(
    outputDir,
    "compress-" + Date.now() + ".jpg"
  );

  ffmpeg(inputPath)
    .outputOptions([`-q:v ${Math.max(2, Math.floor(quality / 10))}`])
    .on("end", () => {
      fs.unlinkSync(inputPath);
      res.download(outputPath);
    })
    .on("error", () => {
      res.status(500).send("Image compress failed");
    })
    .save(outputPath);
});

// ===================================================
// ✂ REMOVE BACKGROUND
// ===================================================
app.post("/remove-bg", upload.single("image"), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append("image_file", fs.createReadStream(req.file.path));
    formData.append("size", "auto");

    const response = await axios.post(
      "https://api.remove.bg/v1.0/removebg",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "X-Api-Key": "eU3xHsEe9vJNpXAVaZuJPE32"
        },
        responseType: "arraybuffer"
      }
    );

    const outputPath = path.join(__dirname, "output", "no-background.png");

    fs.writeFileSync(outputPath, response.data);
    fs.unlinkSync(req.file.path);

    res.setHeader("Content-Type", "image/png");
    res.sendFile(outputPath);
  } catch (err) {
    console.error("REMOVE BG ERROR:", err.response?.data || err.message);
    res.status(500).send("Background remove failed");
  }
});

// ================= SERVER =================
app.listen(3000, "0.0.0.0", () => {
  console.log("Server running");
});