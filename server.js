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

// Configure Multer for Cloudinary
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "uploads",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const uploadCloudinary = multer({ storage: cloudinaryStorage });

// Define Mongoose Schema for Events
const EventImageSchema = new mongoose.Schema({
  imageUrl: String,
  date: Date,
});

const EventImageModel = mongoose.model("EventImage", EventImageSchema);

// API to Upload Image for Events
app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { date } = req.body;
    if (!date) return res.status(400).json({ message: "Date is required" });

    // Upload image to Cloudinary
    const stream = cloudinary.uploader.upload_stream(
      { folder: "events" },
      async (error, cloudinaryResult) => {
        if (error) return res.status(500).json({ message: "Upload failed" });

        // Save event image to MongoDB
        const newImage = new EventImageModel({
          imageUrl: cloudinaryResult.secure_url,
          date: new Date(date),
        });

        await newImage.save();
        res.status(201).json(newImage);
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(stream);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// API to Fetch All Event Images
app.get("/api/events", async (req, res) => {
  try {
    const images = await EventImageModel.find();
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: "Error fetching images" });
  }
});

// API to upload blog data
app.post("/api/blogs", uploadCloudinary.single("blog_image"), async (req, res) => {
  try {
    const { blog_title, blog_description } = req.body;
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });

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
    res.status(500).json({ error: "Error uploading blog" });
  }
});

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


// Export the app (required for Vercel)
module.exports = app;
