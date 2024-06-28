const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection URL
const mongoURI = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@simple-node-mongo.gm35wt9.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;

// Connect to MongoDB
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Define mongoose schemas and models
const Schema = mongoose.Schema;

// User schema
const userSchema = new Schema({
  firstName: String,
  lastName: String,
  bio: String,
  email: { type: String, unique: true },
  password: String,
});

// Blog schema
const blogSchema = new Schema({
  title: String,
  content: String,
  thumbnail: String,
  author: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  tags: [String],
  likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
  comments: [{ type: Schema.Types.ObjectId, ref: "User" }],
  isFavourite: Boolean,
});

const User = mongoose.model("User", userSchema);
const Blog = mongoose.model("Blog", blogSchema);

// Register route
app.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, bio, email, password } = req.body;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      firstName,
      lastName,
      bio,
      email,
      password: hashedPassword,
    });

    // Save the user
    await newUser.save();

    res.status(201).json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to register user" });
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Find blogs of the logged in user
    const blogs = await Blog.find({ author: user._id });

    // Populate blogs array within the user object
    const userWithBlogs = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      email: user.email,
      blogs: blogs, // Assigning the blogs array
    };

    // Return user info with blogs
    res.status(200).json({ user: userWithBlogs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to login" });
  }
});

// Get all users with their posted blogs
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    const usersWithBlogs = await Promise.all(
      users.map(async (user) => {
        const blogs = await Blog.find({ author: user._id });
        return { ...user.toObject(), blogs };
      })
    );
    res.status(200).json(usersWithBlogs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Get single user with their own posted blogs
app.get("/profile/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find blogs of the user
    const blogs = await Blog.find({ author: userId });

    // Wrap user and blogs inside a single object
    const userProfile = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      email: user.email,
      blogs: blogs, // Assigning the blogs array
    };

    // Return user profile object
    res.status(200).json(userProfile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch user profile and blogs" });
  }
});

// Blog post route
app.post("/blog", async (req, res) => {
  try {
    const { title, content, thumbnail, author, tags, isFavourite } = req.body;

    // Create a new blog
    const newBlog = new Blog({
      title,
      content,
      thumbnail,
      author,
      tags,
      isFavourite,
    });

    // Save the blog
    await newBlog.save();

    res.status(201).json(newBlog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create blog" });
  }
});

// Get all blogs
app.get("/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find();
    res.status(200).json(blogs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch blogs" });
  }
});

// Get single blog
app.get("/blogs/:id", async (req, res) => {
  try {
    const blogId = req.params.id;
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }
    res.status(200).json(blog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch blog" });
  }
});

// Base Route
app.get("/", (req, res) => {
  res.send("Welcome to Techinsight Hub!");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
