import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import multer from "multer";
import cloudinary from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Define Mongoose Schemas
const ImageSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

const Image = mongoose.model("Image", ImageSchema);

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
const storage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: "uploads",
    allowedFormats: ["jpg", "png", "jpeg"],
  },
});
const upload = multer({ storage });

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

// API to Upload Image for Events
app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }
    const newImage = new Image({
      imageUrl: req.file.path,
      date: new Date(date),
    });
    await newImage.save();
    res.status(201).json(newImage);
  } catch (error) {
    res.status(500).json({ error: "Error uploading image" });
  }
});

// API to Fetch All Event Images
app.get("/api/events", async (req, res) => {
  try {
    const images = await Image.find();
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: "Error fetching images" });
  }
});

// API to upload blog data
app.post("/api/blogs", upload.single("blog_image"), async (req, res) => {
  const { blog_title, blog_description } = req.body;
  const blog_image = req.file.path;

  // Generate the next blog_id
  const blog_id = await getNextSequenceValue("blog_id");

  const blog = new Blog({
    blog_id,
    blog_title,
    blog_description,
    blog_image,
  });

  await blog.save();
  res.status(201).send(blog);
});

// API to fetch all blogs
app.get("/api/blogs", async (req, res) => {
  const blogs = await Blog.find();
  res.send(blogs);
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

// Vercel requires an export of the handler
export default app;

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
