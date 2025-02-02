const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit'); // Add rate limiting library

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;
const secretKey = process.env.JWT_SECRET;

if (!uri || !secretKey) {
  console.error('MONGODB_URI or JWT_SECRET is not defined in the environment variables.');
  process.exit(1);
}

// Increase the body size limit
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors({
  origin: true, // Ensure this is set to true to allow requests from any origin
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting middleware for rating submission
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// MongoDB connection
mongoose.connect(uri).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Error connecting to MongoDB', err);
});

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('test');
    const driverInfoCollection = db.collection('driverInfo');
    const usersCollection = db.collection('users'); // Assuming there's a users collection
    const contactCollection = db.collection('contacts'); // Add a contacts collection

    // Endpoint to handle fetching all user information
    app.get('/driver-info', async (req, res) => {
      try {
        console.log('Fetching all user info');
        const users = await driverInfoCollection.find().toArray();
        res.status(200).json(users);
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
    });

    // Endpoint to handle rating submission with rate limiting
    app.post('/driver-info', rateLimiter, async (req, res) => {
      try {
        const { email, rating, review } = req.body;
        console.log('Rating successfully submitted for:', email);

        // Check if driver exists
        const driver = await driverInfoCollection.findOne({ email });
        if (!driver) {
          console.log('Driver not found:', email); // Log if driver is not found
          return res.status(400).json({ message: 'Driver not found.' });
        }

        // Update the driver's ratings and reviews
        await driverInfoCollection.updateOne(
          { email },
          { $push: { ratings: { rating, review, user: email } } }
        );

        res.status(200).json({ message: 'Rating submitted successfully.' });
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
    });

    // Endpoint to handle contact form submission
    app.post('/contact', async (req, res) => {
      try {
        const { name, email, message } = req.body;
        console.log('Contact form submitted:', name, email, message);

        // Save contact form data to the database
        await contactCollection.insertOne({ name, email, message });

        res.status(200).json({ message: 'Contact form submitted successfully.' });
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
    });

    // Serve static files from the current directory
    app.use(express.static(path.join(__dirname)));

  } catch (err) {
    console.error('Error connecting to MongoDB', err);
  }
}

main().catch(console.error);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
