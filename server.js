require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
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
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define Mongoose Schema for Carousel Images
const CarouselImageSchema = new mongoose.Schema({
  imageUrl: String,
  link: String,
});

const CarouselImage = mongoose.model("CarouselImage", CarouselImageSchema);

// Multer Storage (Memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload API (Carousel)
app.post("/api/carousel", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Upload image to Cloudinary
    const stream = cloudinary.uploader.upload_stream(
      { folder: "carousel" },
      async (error, cloudinaryResult) => {
        if (error)
          return res.status(500).json({ message: "Upload failed", error });

        // Save URLs to MongoDB
        const image = new CarouselImage({
          imageUrl: cloudinaryResult.secure_url,
          link: req.body.link,
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

// Fetch all carousel images
app.get("/api/carousel", async (req, res) => {
  try {
    const images = await CarouselImage.find();
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: "Error fetching images" });
  }
});

// Blog Schema
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence_value: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

const blogSchema = new mongoose.Schema({
  blog_id: { type: Number, unique: true, index: true },
  blog_title: String,
  blog_description: String,
  blog_image: String,
});

const Blog = mongoose.model("Blog", blogSchema);

// Function to get the next sequence value
const getNextSequenceValue = async (sequenceName) => {
  const sequenceDocument = await Counter.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.sequence_value;
};

// Configure Multer for Cloudinary (Blog Uploads)
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "uploads",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const uploadCloudinary = multer({ storage: cloudinaryStorage });

// API to upload blog data
app.post(
  "/api/blogs",
  uploadCloudinary.single("blog_image"),
  async (req, res) => {
    try {
      const { blog_title, blog_description } = req.body;
      if (!req.file)
        return res.status(400).json({ message: "No image uploaded" });

      // Generate the next blog_id
      const blog_id = await getNextSequenceValue("blog_id");

      const blog = new Blog({
        blog_id,
        blog_title,
        blog_description,
        blog_image: req.file.path,
      });

      await blog.save();
      res.status(201).json(blog);
    } catch (error) {
      res.status(500).json({ error: "Error uploading blog", details: error });
    }
  }
);

// API to fetch all blogs
app.get("/api/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find();
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ error: "Error fetching blogs" });
  }
});

// API to fetch a single blog by blog_id
app.get("/api/blogs/:blog_id", async (req, res) => {
  try {
    const blog = await Blog.findOne({ blog_id: req.params.blog_id });
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }
    res.json(blog);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Define Mongoose Schema for Songs
const SongSchema = new mongoose.Schema({
  image: { type: String, required: true },
  title: { type: String, required: true },
  purchaseLink: { type: String, required: true },
  streamLink: { type: String, required: true },
});

const Song = mongoose.model("Song", SongSchema);

// Configure Multer for Cloudinary (Music Uploads)
const musicStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "music",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const musicUpload = multer({ storage: musicStorage });

// POST: Upload Image & Save Song Data
app.post("/api/music", musicUpload.single("image"), async (req, res) => {
  try {
    const { title, purchaseLink, streamLink } = req.body;
    if (!req.file)
      return res.status(400).json({ message: "No image uploaded" });

    const newSong = new Song({
      image: req.file.path,
      title,
      purchaseLink,
      streamLink,
    });

    await newSong.save();
    res.status(201).json({ message: "Song added successfully", song: newSong });
  } catch (error) {
    res.status(500).json({ error: "Error uploading song" });
  }
});

// GET: Fetch All Songs
app.get("/api/music", async (req, res) => {
  try {
    const songs = await Song.find();
    res.status(200).json(songs);
  } catch (error) {
    res.status(500).json({ error: "Error fetching songs" });
  }
});

// Define Mongoose Schema for Album
const AlbumSchema = new mongoose.Schema({
  image: { type: String, required: true },
  title: { type: String, required: true },
  purchaseLink: { type: String, required: true },
  streamLink: { type: String, required: true },
});

const Album = mongoose.model("Album", AlbumSchema);

// Configure Multer for Cloudinary (Album Uploads)
const AlbumStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "album",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const AlbumUpload = multer({ storage: AlbumStorage });

// POST: Upload Image & Save Song Data
app.post("/api/album", AlbumUpload.single("image"), async (req, res) => {
  try {
    const { title, purchaseLink, streamLink } = req.body;
    if (!req.file)
      return res.status(400).json({ message: "No image uploaded" });

    const newAlbum = new Album({
      image: req.file.path,
      title,
      purchaseLink,
      streamLink,
    });

    await newAlbum.save();
    res.status(201).json({ message: "Album added successfully", song: newAlbum });
  } catch (error) {
    res.status(500).json({ error: "Error uploading song" });
  }
});

// GET: Fetch All Album
app.get("/api/album", async (req, res) => {
  try {
    const Albums = await Album.find();
    res.status(200).json(Albums);
  } catch (error) {
    res.status(500).json({ error: "Error fetching songs" });
  }
});

// Define Mongoose Schema for Feature
const FeatureSchema = new mongoose.Schema({
  image: { type: String, required: true },
  title: { type: String, required: true },
  purchaseLink: { type: String, required: true },
  streamLink: { type: String, required: true },
});

const Feature = mongoose.model("Feature", FeatureSchema);

// Configure Multer for Cloudinary (Feature Uploads)
const FeatureStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "feature",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const FeatureUpload = multer({ storage: FeatureStorage });

// POST: Upload Image & Save Feature Data
app.post("/api/feature", FeatureUpload.single("image"), async (req, res) => {
  try {
    const { title, purchaseLink, streamLink } = req.body;
    if (!req.file)
      return res.status(400).json({ message: "No image uploaded" });

    const newFeature = new Feature({
      image: req.file.path,
      title,
      purchaseLink,
      streamLink,
    });

    await newFeature.save();
    res.status(201).json({ message: "Features added successfully", song: newFeature });
  } catch (error) {
    res.status(500).json({ error: "Error uploading Features" });
  }
});

// GET: Fetch All Album
app.get("/api/feature", async (req, res) => {
  try {
    const Features = await Feature.find();
    res.status(200).json(Features);
  } catch (error) {
    res.status(500).json({ error: "Error fetching songs" });
  }
});





// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
