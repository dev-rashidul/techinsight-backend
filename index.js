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
  blogs: [{ type: Schema.Types.ObjectId, ref: "Blog" }],
});

// Blog schema
const blogSchema = new Schema({
  title: String,
  content: String,
  thumbnail: String,
  author: {
    _id: { type: Schema.Types.ObjectId, ref: "User" },
    firstName: String,
    lastName: String,
    email: String,
  },
  tags: String,
  likes: [{ type: Schema.Types.ObjectId, ref: "User" }], // Array of User IDs who liked the blog
  comments: [
    {
      user: {
        _id: { type: Schema.Types.ObjectId, ref: "User" },
        firstName: String,
        lastName: String,
        email: String,
      },
      comment: String,
    },
  ],
  isFavourite: Boolean,
  favouritedBy: [{ type: Schema.Types.ObjectId, ref: "User" }], // Array of User IDs who favorited the blog
  createdAt: { type: Date, default: Date.now },
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
        return {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          bio: user.bio,
          email: user.email,
          blogs: blogs, // Assigning the blogs array
        };
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
    const blogs = await Blog.find({ "author._id": userId });

    // Return user profile object with only blog information
    const userProfile = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      email: user.email,
      blogs: blogs,
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
    const { title, content, thumbnail, tags, author, isFavourite } = req.body;

    const loggedInUserId = author;

    // Find the logged-in user
    const user = await User.findById(loggedInUserId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create a new blog with the logged-in user as author
    const newBlog = new Blog({
      title,
      content,
      thumbnail,
      author: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      tags,
      isFavourite,
      createdAt: new Date(), // Set createdAt to current date/time
      likes: [], // Initialize likes as an empty array
      comments: [], // Initialize comments as an empty array
    });

    // Save the blog
    await newBlog.save();

    res.status(201).json(newBlog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create blog" });
  }
});

// Like or Unlike blog route
app.post("/blogs/:id/like", async (req, res) => {
  try {
    const blogId = req.params.id;
    const { userId, like } = req.body;

    // Validate like parameter
    if (typeof like !== "boolean") {
      return res.status(400).json({ message: "Invalid 'like' parameter" });
    }

    // Find the blog by ID
    const blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Find the user who is liking/unliking
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update likes array based on like parameter
    if (like) {
      // Add user ID to likes array if not already present
      if (!blog.likes.includes(user._id)) {
        blog.likes.push(user._id);
      }
    } else {
      // Remove user ID from likes array
      blog.likes = blog.likes.filter(
        (id) => id.toString() !== user._id.toString()
      );
    }

    // Save the updated blog
    await blog.save();

    // Return a minimal response indicating success
    res.status(200).json({ likes: blog.likes.length }); // Or any other relevant data
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to like/unlike blog" });
  }
});

// Comment on a blog route
app.post("/blogs/:id/comment", async (req, res) => {
  try {
    const blogId = req.params.id;
    const { userId, comment } = req.body;

    // Find the blog by ID
    const blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Find the user who is commenting
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add comment to the blog
    blog.comments.push({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      comment,
    });

    // Save the updated blog
    await blog.save();

    res.status(200).json(blog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add comment" });
  }
});

// Patch route to update blog favourite status
app.patch("/blogs/:id/favourite", async (req, res) => {
  try {
    const blogId = req.params.id;
    const { isFavourite, userId } = req.body;

    // Check if the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    // Find the blog by ID
    const blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Update isFavourite field
    blog.isFavourite = isFavourite;

    // Update favouritedBy field
    if (isFavourite) {
      // Add user ID to favouritedBy array if not already present
      if (!blog.favouritedBy.includes(userId)) {
        blog.favouritedBy.push(userId);
      }
    } else {
      // Remove user ID from favouritedBy array
      blog.favouritedBy = blog.favouritedBy.filter(
        (id) => id.toString() !== userId.toString()
      );
    }

    // Save the updated blog
    await blog.save();

    res.status(200).json(blog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update favourite status" });
  }
});

// Get all blogs
app.get("/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
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

// Edit blog route
app.patch("/blogs/:id", async (req, res) => {
  try {
    const blogId = req.params.id;
    const { title, content, thumbnail, tags, isFavourite } = req.body;

    // Check if the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    // Find the blog by ID and update it
    const updatedBlog = await Blog.findByIdAndUpdate(
      blogId,
      {
        title,
        content,
        thumbnail,
        tags,
        isFavourite,
      },
      { new: true }
    ); // { new: true } ensures we get the updated document

    // If blog is not found
    if (!updatedBlog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.status(200).json(updatedBlog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update blog" });
  }
});

// Delete blog route
app.delete("/blogs/:id", async (req, res) => {
  try {
    const blogId = req.params.id;

    // Check if the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    // Find the blog by ID and delete it
    const deletedBlog = await Blog.findByIdAndDelete(blogId);

    // If blog is not found
    if (!deletedBlog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.status(200).json({ message: "Blog deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete blog" });
  }
});

// Search blogs route
app.get("/search", async (req, res) => {
  try {
    const { query } = req.query;

    // Find blogs that match the query in title or tags
    const blogs = await Blog.find({
      $or: [
        { title: { $regex: query, $options: "i" } }, // Case-insensitive regex search for title
        { tags: { $regex: query, $options: "i" } }, // Case-insensitive regex search for tags
      ],
    });

    res.status(200).json(blogs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to search blogs" });
  }
});

// Base Route
app.get("/", (req, res) => {
  res.send("Welcome to Techinsight Hub!");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
