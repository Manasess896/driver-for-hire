const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
require('dotenv').config();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('Environment variables are not defined properly.');
  process.exit(1);
}

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
};

let dbClient = null;

async function connectWithRetry() {
  const MAX_RETRIES = 5;
  const RETRY_INTERVAL = 5000; // 5 seconds
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      if (!dbClient) {
        dbClient = await MongoClient.connect(uri, MONGO_OPTIONS);
        console.log('Connected to MongoDB successfully');
        return dbClient;
      }
      return dbClient;
    } catch (err) {
      retries++;
      console.error(`Failed to connect to MongoDB (Attempt ${retries}/${MAX_RETRIES}):`, err.message);
      if (retries === MAX_RETRIES) {
        throw new Error('Failed to connect to MongoDB after maximum retries');
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
    }
  }
}

// Middleware to ensure database connection
app.use(async (req, res, next) => {
  try {
    if (!dbClient || !dbClient.topology.isConnected()) {
      await connectWithRetry();
    }
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      message: 'Database connection error. Please try again later.',
      error: error.message
    });
  }
});

app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Endpoint to fetch all driver and car information
app.get('/all-info', async (req, res) => {
  try {
    const db = dbClient.db('test');
    const driverInfoCollection = db.collection('driverInfo');
    const carInfoCollection = db.collection('carInfo');

    // Fetch drivers and cars separately
    const [drivers, cars] = await Promise.all([
      driverInfoCollection.find().toArray(),
      carInfoCollection.find().toArray()
    ]);

    // Convert binary images back to base64 for drivers
    const formattedDrivers = drivers.map(driver => ({
      ...driver,
      image: driver.image ? `data:${driver.image.contentType};base64,${driver.image.data}` : null
    }));

    // Convert binary images back to base64 for cars
    const formattedCars = cars.map(car => ({
      ...car,
      carImages: car.carImages ? car.carImages.map(img => 
        `data:${img.contentType};base64,${img.data}`
      ) : []
    }));

    res.status(200).json({
      drivers: formattedDrivers,
      cars: formattedCars
    });

  } catch (err) {
    console.error('Error fetching information:', err);
    res.status(500).json({
      message: 'Internal Server Error',
      error: err.message
    });
  }
});

// Add new endpoint for ratings
app.post('/submit-rating', async (req, res) => {
  try {
    const db = dbClient.db('test');
    const driverInfoCollection = db.collection('driverInfo');
    const ratingsTrackingCollection = db.collection('ratingsTracking');
    const { driverEmail, rating, review } = req.body;
    const userIP = req.ip;

    console.log('Rating attempt:', { driverEmail, userIP });

    // Check if this IP has already rated this driver
    const existingRating = await ratingsTrackingCollection.findOne({
      driverEmail,
      userIP
    });

    if (existingRating) {
      console.log('Duplicate rating attempt:', { driverEmail, userIP });
      return res.status(400).json({ 
        status: 'error',
        message: 'You have already submitted a rating for this driver' 
      });
    }

    // First check if driver exists
    const driver = await driverInfoCollection.findOne({ email: driverEmail });
    if (!driver) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Driver not found' 
      });
    }

    // Save the rating tracking first
    await ratingsTrackingCollection.insertOne({
      driverEmail,
      userIP,
      ratedAt: new Date()
    });

    // Then update driver ratings
    const result = await driverInfoCollection.updateOne(
      { email: driverEmail },
      { 
        $push: { 
          ratings: {
            rating: parseInt(rating),
            review,
            date: new Date(),
            userIP
          }
        }
      }
    );

    console.log('Rating submitted:', { driverEmail, userIP, result });

    res.status(200).json({ 
      status: 'success',
      message: 'Rating submitted successfully' 
    });
  } catch (err) {
    console.error('Error submitting rating:', err);
    res.status(500).json({ 
      status: 'error',
      message: 'Error submitting rating' 
    });
  }
});

// Optional: Add cleanup job for old tracking records (e.g., after 6 months)
setInterval(async () => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    await ratingsTrackingCollection.deleteMany({
      ratedAt: { $lt: sixMonthsAgo }
    });
  } catch (error) {
    console.error('Error cleaning up old rating records:', error);
  }
}, 24 * 60 * 60 * 1000); // Run daily

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
