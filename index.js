// Import necessary modules
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Initialize Express app
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection
const mongoURI = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@simple-node-mongo.gm35wt9.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define Mongoose schemas and models
const BlogSchema = new mongoose.Schema({
  title: String,
  content: String,
  thumbnail: String,
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'  // Referencing the User model
  },
  tags: [String],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'  // Referencing the User model
  }],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'  // Referencing the User model
  }],
  isFavourite: Boolean
});
const Blog = mongoose.model('Blog', BlogSchema);

const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  bio: String,
  email: { type: String, unique: true },
  password: String,
  blogs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Blog' }]  // Reference to Blog model
});
const User = mongoose.model('User', UserSchema);

// Routes
// Register route
app.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, bio, email, password } = req.body;
    const newUser = new User({ firstName, lastName, bio, email, password });
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login route (without JWT)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the email and password are provided
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find the user by email and check if the password matches
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate the password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Populate the user's blogs
    const populatedUser = await User.findById(user._id).populate('blogs');
    if (!populatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return the logged-in user information with blogs
    res.status(200).json(populatedUser);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users
app.get('/users', async (req, res) => {
  try {
    const users = await User.find().populate('blogs');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single user with their own blogs
app.get('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate('blogs');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Blog post route
app.post('/blog', async (req, res) => {
  try {
    const { title, content, thumbnail, author, tags, isFavourite } = req.body;
    const newBlog = new Blog({ title, content, thumbnail, author, tags, isFavourite });
    await newBlog.save();
    res.status(201).json(newBlog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all blogs
app.get('/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().populate('author').populate('likes').populate('comments');
    res.status(200).json(blogs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single blog
app.get('/blogs/:blogId', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.blogId).populate('author').populate('likes').populate('comments');
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }
    res.status(200).json(blog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Base Route
app.get("/", (req, res) => {
  res.send("Welcome to Techinsight Hub!");
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
