const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser'); // Add this line
const multer = require('multer'); // Add this line
require('dotenv').config();

const app = express();
const port =  3001;
const uri = process.env.MONGODB_URI;
const secretKey = process.env.JWT_SECRET;

if (!uri) {
  console.error('Environment variables are not defined properly.');
  process.exit(1);
}

const client = new MongoClient(uri);

app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors({
  origin: true, // Allow requests from any origin
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Allow credentials
}));
app.use(cookieParser()); 

app.use(express.static(path.join(__dirname, 'driverpanel')));

app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('No token provided.');
    return res.status(401).json({ message: 'No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  console.log('Received token:', token); // Log the token
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      console.log('Failed to authenticate token:', err);
      return res.status(401).json({ message: 'Failed to authenticate token.' });
    }
    console.log('Token validated successfully:', decoded);
    req.email = decoded.email;
    next();
  });
});

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

async function connectWithRetry() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    setTimeout(connectWithRetry, 5000);
  }
}

async function main() {
  try {
    await connectWithRetry();
    const db = client.db('test');
    const usersCollection = db.collection('users');
    const driverInfoCollection = db.collection('driverInfo');
    const carInfoCollection = db.collection('carInfo');

    app.post('/driver-info', async (req, res) => {
      try {
        const { name, lname, email, phone, dob, license, classes, experience, hasCar, image, location, age, rate } = req.body;
        console.log('Driver info submission:', email);

        // Validate and sanitize inputs
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          return res.status(400).json({ message: 'Invalid email format.' });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
          console.log('User not found:', email);
          return res.status(400).json({ message: 'User not found.' });
        }

        const driverInfo = await driverInfoCollection.findOne({ email });
        if (driverInfo) {
          console.log('Driver info already exists for:', email);
          return res.status(400).json({ message: 'Driver info already submitted.' });
        }

        await driverInfoCollection.insertOne({ name, lname, email, phone, dob, license, classes, experience, hasCar, image, location, age, rate });

        console.log('Driver info submitted successfully:', email);
        res.status(200).json({ message: 'Driver info submitted successfully.' });
      } catch (err) {
        console.error('Error submitting driver info:', err);
        res.status(500).send({ message: 'Error submitting driver info.' });
      }
    });

    app.put('/driver-info', async (req, res) => {
      try {
        const { name, email, phone, dob, license, experience, hasCar, location, age, rate } = req.body;
        console.log('Driver info update:', email);

        // Validate and sanitize inputs
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          return res.status(400).json({ message: 'Invalid email format.' });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
          console.log('User not found:', email);
          return res.status(400).json({ message: 'User not found.' });
        }

        await driverInfoCollection.updateOne(
          { email },
          { $set: { name, phone, dob, license, experience, hasCar, location, age, rate } }
        );

        console.log('Driver info updated successfully:', email);
        res.status(200).json({ message: 'Driver info updated successfully.' });
      } catch (err) {
        console.error('Error updating driver info:', err);
        res.status(500).send({ message: 'Error updating driver info.' });
      }
    });

    app.get('/driver-info', async (req, res) => { // Ensure this endpoint is set up
      try {
        const email = req.email;
        console.log('Fetching user info for:', email);

        const user = await driverInfoCollection.findOne({ email });
        if (!user) {
          console.log('User info not found:', email);
          return res.status(200).json({});
        }

        console.log('User info fetched successfully:', email);
        res.status(200).json(user);
      } catch (err) {
        console.error('Error fetching user info:', err);
        res.status(500).send({ message: 'Error fetching user info.' });
      }
    });

    app.get('/user-info', async (req, res) => {
      try {
        const email = req.email;
        console.log('Fetching user info for:', email);

        const user = await driverInfoCollection.findOne({ email });
        if (!user) {
          console.log('User info not found:', email);
          return res.status(200).json({});
        }

        console.log('User info fetched successfully:', email);
        res.status(200).json(user);
      } catch (err) {
        console.error('Error fetching user info:', err);
        res.status(500).send({ message: 'Error fetching user info.' });
      }
    });

    app.post('/verify-email-code', (req, res) => {
      const { email, code } = req.body;
      console.log('Verification attempt:', { email, code });

      const verificationData = verificationCodes[email];

      if (!verificationData) {
        console.log('No verification code found for:', email);
        return res.status(400).json({ message: 'No verification code found.' });
      }

      const { code: storedCode, timestamp } = verificationData;
      const currentTime = Date.now();

      if (currentTime - timestamp > CODE_EXPIRATION_MS) {
        delete verificationCodes[email];
        console.log('Verification code expired for:', email);
        return res.status(400).json({ message: 'Verification code has expired.' });
      }

      if (storedCode === code) {
        delete verificationCodes[email];
        console.log('Email verified successfully for:', email);
        const token = jwt.sign({ email }, secretKey, { expiresIn: '5m' }); // Token expires in 5 minutes
        res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 5 * 60 * 1000 }); // Set HttpOnly cookie with secure: false for local development
        return res.status(200).json({ message: 'Email verified successfully.', token });
      } else {
        console.log('Invalid verification code for:', email);
        return res.status(400).json({ message: 'Invalid verification code.' });
      }
    });

    app.get('/check-submission', async (req, res) => {
      const { email, type } = req.query;
      try {
          let collection;
          if (type === 'driver') {
              collection = driverInfoCollection;
          } else if (type === 'car') {
              collection = carInfoCollection;
          } else {
              return res.status(400).json({ message: 'Invalid submission type.' });
          }
  
          const info = await collection.findOne({ email });
          if (info) {
              return res.status(200).json({ submitted: true });
          } else {
              return res.status(200).json({ submitted: false });
          }
      } catch (err) {
          console.error('Error checking submission:', err);
          res.status(500).send({ message: 'Error checking submission.' });
      }
  });

    app.post('/submit-info', upload.array('carImages', 6), async (req, res) => {
      try {
          const { email, submissionType } = req.body;
          console.log(`${submissionType} info submission:`, email);
  
          // Validate and sanitize inputs
          if (!email || typeof email !== 'string' || !email.includes('@')) {
              return res.status(400).json({ message: 'Invalid email format.' });
          }
  
          const user = await usersCollection.findOne({ email });
          if (!user) {
              console.log('User not found:', email);
              return res.status(400).json({ message: 'User not found.' });
          }
  
          if (submissionType === 'driver') {
              const driverInfo = await driverInfoCollection.findOne({ email });
              if (driverInfo) {
                  console.log('Driver info already exists for:', email);
                  return res.status(400).json({ message: 'Driver info already submitted.' });
              }
  
              const { name, lname, phone, dob, license, classes, experience, hasCar, location, age, rate } = req.body;
              await driverInfoCollection.insertOne({ name, lname, email, phone, dob, license, classes, experience, hasCar, location, age, rate });
  
              console.log('Driver info submitted successfully:', email);
              res.status(200).json({ message: 'Driver info submitted successfully.' });
          } else if (submissionType === 'car') {
              const carInfo = await carInfoCollection.findOne({ email });
              if (carInfo) {
                  console.log('Car info already exists for:', email);
                  return res.status(400).json({ message: 'Car info already submitted.' });
              }
  
              const { carNumberPlate, mileage, consumption, phone } = req.body;
              const carImages = req.files.map(file => file.buffer.toString('base64'));
  
              await carInfoCollection.insertOne({ email, carNumberPlate, mileage, consumption, phone, carImages });
  
              console.log('Car info submitted successfully:', email);
              res.status(200).json({ message: 'Car info submitted successfully.' });
          }
      } catch (err) {
          console.error('Error submitting info:', err);
          res.status(500).send({ message: 'Error submitting info.' });
      }
  });

    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
  }
}

main().catch(console.error);

process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB client closed');
  process.exit(0);
});
