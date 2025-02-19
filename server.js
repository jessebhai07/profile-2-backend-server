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

// Define Mongoose Schema for Images
const ImageSchema = new mongoose.Schema({
  imageUrl: String,
  link: String,
});

const ImageModel = mongoose.model("Image", ImageSchema);

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
        if (error) return res.status(500).json({ message: "Upload failed" });

        // Save URLs to MongoDB
        const image = new ImageModel({
          imageUrl: cloudinaryResult.secure_url, // Cloudinary URL
          link: req.body.link, // Custom URL from the client
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

// --- Event Schema and Routes ---


// Define Mongoose Schema for Events
const eventSchema = new mongoose.Schema({
  event_date: { type: Date, required: true },
  event_image: { type: String, required: true }, // Image for the event
});

const Event = mongoose.model("Event", eventSchema);

// API to upload event data (only event_date and event_image)
app.post("/api/events", uploadCloudinary.single("event_image"), async (req, res) => {
  try {
    const { event_date } = req.body;

    if (!event_date) {
      return res.status(400).json({ message: "Event date is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Event image is required" });
    }

    const event = new Event({
      event_date: new Date(event_date), // Parse the date to ensure it's a valid Date object
      event_image: req.file.path,        // Store Cloudinary URL of the uploaded image
    });

    await event.save();
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: "Error uploading event" });
  }
});

// API to fetch all events
app.get("/api/events", async (req, res) => {
  try {
    const events = await Event.find();
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Error fetching events" });
  }
});

// API to fetch a single event by event ID
app.get("/api/events/:event_id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.event_id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});




// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
