require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Logger utility
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`)
};

// Environment variables
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/aqiDB";

// MongoDB Connection with error handling
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    logger.info("✅ Using existing MongoDB connection");
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      retryWrites: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    logger.info("✅ MongoDB Connected");
  } catch (err) {
    logger.error(`MongoDB Connection Failed: ${err.message}`);
    throw err;
  }
};

// Schema with validation
const AQISchema = new mongoose.Schema({
  city: {
    type: String,
    required: [true, "City name is required"],
    trim: true,
    minlength: [2, "City name too short"]
  },
  aqi: {
    type: Number,
    required: [true, "AQI is required"],
    min: [0, "AQI cannot be negative"],
    max: [500, "AQI cannot exceed 500"]
  },
  pm25: {
    type: Number,
    required: [true, "PM2.5 is required"],
    min: [0, "PM2.5 cannot be negative"]
  },
  pm10: {
    type: Number,
    default: 0
  },
  o3: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for better query performance
AQISchema.index({ city: 1, date: -1 });

const AQI = mongoose.model("AQI", AQISchema);

// Input Validation Middleware
const validateAQIInput = (req, res, next) => {
  const { city, aqi, pm25 } = req.body;

  if (!city || typeof city !== "string" || city.trim().length < 2) {
    return res.status(400).json({
      error: "Invalid city name. Must be at least 2 characters."
    });
  }

  if (aqi === undefined || typeof aqi !== "number" || aqi < 0 || aqi > 500) {
    return res.status(400).json({
      error: "Invalid AQI. Must be a number between 0 and 500."
    });
  }

  if (pm25 === undefined || typeof pm25 !== "number" || pm25 < 0) {
    return res.status(400).json({
      error: "Invalid PM2.5. Must be a non-negative number."
    });
  }

  next();
};

// ✅ FIXED: Single /save endpoint
app.post("/save", validateAQIInput, async (req, res) => {
  await connectDB();
  try {
    const { city, aqi, pm25, pm10 = 0, o3 = 0 } = req.body;

    const newData = new AQI({
      city: city.trim(),
      aqi,
      pm25,
      pm10,
      o3
    });

    const savedData = await newData.save();

    logger.info(`Data saved for ${city}: AQI=${aqi}`);

    res.status(201).json({
      message: "Data saved successfully",
      data: savedData
    });
  } catch (err) {
    logger.error(`Save error: ${err.message}`);
    res.status(500).json({
      error: "Failed to save data. Please try again."
    });
  }
});

// ✅ GET historical data
app.get("/history", async (req, res) => {
  await connectDB();
  try {
    const { city, limit = 50 } = req.query;

    let query = {};
    if (city) {
      query.city = new RegExp(city, "i"); // Case-insensitive search
    }

    const data = await AQI.find(query)
      .sort({ date: -1 })
      .limit(Math.min(parseInt(limit), 500))
      .select("city aqi pm25 pm10 o3 date");

    logger.info(`Retrieved ${data.length} history records`);

    res.json({
      count: data.length,
      data
    });
  } catch (err) {
    logger.error(`History retrieval error: ${err.message}`);
    res.status(500).json({
      error: "Failed to retrieve history"
    });
  }
});

// ✅ GET latest AQI data
app.get("/latest/:city", async (req, res) => {
  await connectDB();
  try {
    const { city } = req.params;

    if (!city || city.trim().length < 2) {
      return res.status(400).json({ error: "City name is required" });
    }

    const data = await AQI.findOne({
      city: new RegExp(`^${city}$`, "i")
    }).sort({ date: -1 });

    if (!data) {
      return res.status(404).json({
        error: `No data found for city: ${city}`
      });
    }

    res.json(data);
  } catch (err) {
    logger.error(`Latest data error: ${err.message}`);
    res.status(500).json({
      error: "Failed to retrieve latest data"
    });
  }
});

// Health check endpoint
app.get("/health", async (req, res) => {
  await connectDB();
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`Not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Route not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({
    error: "Internal server error"
  });
});

// Export for Vercel serverless
module.exports = app;
