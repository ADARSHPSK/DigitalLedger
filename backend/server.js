require('dotenv').config();
console.log("MONGO_URI:", process.env.MONGO_URI);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const landRoutes = require('./routes/land');

const app = express();

// Middleware — runs on every request
app.use(cors());           // allows React Native app to call this server
app.use(express.json());   // parses JSON body from requests

// Routes
app.use('/auth', authRoutes);   // /auth/login, /auth/register
app.use('/land', landRoutes);   // /land/search, /land/:id, etc.

// Health check — open http://localhost:3000 to confirm server is running
app.get('/', (req, res) => res.json({ status: 'BhoomiLedger API running' }));

// Connect to MongoDB, then start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });