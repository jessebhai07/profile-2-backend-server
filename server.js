require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const cors = require("cors");
const streamifier = require("streamifier");

// Initialize app
const app = express();
app.use(express.json());
app.use(cors());

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Define Mongoose Schema
const ImageSchema = new mongoose.Schema({
  imageUrl: String,
  link: String,
});

const ImageModel = mongoose.model("Image", ImageSchema);

// Multer Storage (Memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

// Upload API (Carousel)
app.post("/api/carousel", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Ensure link is provided
    const { link } = req.body;
    if (!link) return res.status(400).json({ message: "No link provided" });

    // Upload image to Cloudinary
    const stream = cloudinary.uploader.upload_stream(
      { folder: "carousel" },
      async (error, cloudinaryResult) => {
        if (error) return res.status(500).json({ message: "Upload failed" });

        // Save URLs to MongoDB with the user-provided link
        const image = new ImageModel({
          imageUrl: cloudinaryResult.secure_url, // Cloudinary image URL
          link: link, // Use the link from the frontend
        });

        await image.save();
        res.json(image);
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(stream);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Fetch all images (Carousel)
app.get("/api/carousel", async (req, res) => {
  try {
    const images = await ImageModel.find();
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: "Error fetching images" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

// Export the app (required for Vercel)
module.exports = app;