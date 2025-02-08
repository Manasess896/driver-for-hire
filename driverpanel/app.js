const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser'); // Add this line
const multer = require('multer'); // Add this line
const fs = require('fs'); // Add this line
require('dotenv').config();

const app = express();
const port =  3001;
const uri = process.env.MONGODB_URI;
const secretKey = process.env.JWT_SECRET;

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
  origin: true, // Allow requests from any origin
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Allow credentials
}));
app.use(cookieParser()); 

app.use(express.static(path.join(__dirname, 'driverpanel')));

// Development configuration
const DEV_CONFIG = {
    // DEVELOPMENT ONLY: 10 minute session
    TOKEN_EXPIRATION: '10m',        // Changed from '1h' to '10m'
    COOKIE_MAX_AGE: 10 * 60 * 1000,  // 10 minutes in milliseconds
    CODE_EXPIRATION_MS: 5 * 60000     // 5 minutes for email verification code
};

// Use development or production settings
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';
console.log(`Running in ${IS_DEVELOPMENT ? 'development' : 'production'} mode`);

const CONFIG = {
    TOKEN_EXPIRATION: IS_DEVELOPMENT ? DEV_CONFIG.TOKEN_EXPIRATION : '10m', // Also set production to 10m
    COOKIE_MAX_AGE: IS_DEVELOPMENT ? DEV_CONFIG.COOKIE_MAX_AGE : 600000, // 10 minutes in production
    CODE_EXPIRATION_MS: IS_DEVELOPMENT ? DEV_CONFIG.CODE_EXPIRATION_MS : 300000 // 5 minutes in production
};

console.log('Current session configuration:', {
    tokenExpiration: CONFIG.TOKEN_EXPIRATION,
    cookieMaxAge: `${CONFIG.COOKIE_MAX_AGE / 6000000} minutes`,
    codeExpiration: `${CONFIG.CODE_EXPIRATION_MS / 6000000} minutes`
});

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
      if (err.name === 'TokenExpiredError') {
        console.log('Token expired, attempting refresh');
        return res.status(401).json({ 
          message: 'Token expired', 
          expired: true 
        });
      }
      console.log('Failed to authenticate token:', err);
      return res.status(401).json({ message: 'Failed to authenticate token.' });
    }
    console.log('Token validated successfully:', decoded);
    req.email = decoded.email;
    next();
  });
});

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const dir = './uploads';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { 
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        const mimetype = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            cb(null, true);
        } else {
            cb(new Error('Only .png, .jpg and .jpeg files are allowed'));
        }
    }
});

// Helper function to convert file to Base64
function fileToBase64(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) reject(err);
            resolve(data.toString('base64'));
        });
    });
}

// Add error handling middleware for Multer errors
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        return res.status(400).json({
            message: 'File upload error',
            error: err.message
        });
    } else if (err) {
        // An unknown error occurred
        return res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
    next();
});

// Add validation utility
function isValidKenyanPlate(plate) {
    const pattern = /^K[A-Za-z]{2}\s\d{3}[A-Za-z]$/;
    return pattern.test(plate);
}

async function main() {
    try {
        const client = await connectWithRetry();
        const db = client.db('test');
        const usersCollection = db.collection('users');
        const driverInfoCollection = db.collection('driverInfo');
        const carInfoCollection = db.collection('carInfo');
        // Add new collection for archived data
        const deletedInfoCollection = db.collection('deletedInfo');

        // Generic error handler for database operations
        const handleDatabaseOperation = async (operation) => {
            try {
                return await operation();
            } catch (error) {
                console.error('Database operation failed:', error);
                if (error.name === 'MongoServerSelectionError') {
                    await connectWithRetry(); // Try to reconnect
                    return await operation(); // Retry the operation
                }
                throw error;
            }
        };

        // Update the database endpoints to use handleDatabaseOperation
        app.get('/driver-info', async (req, res) => {
            try {
                const email = req.email;
                const user = await handleDatabaseOperation(() => 
                    driverInfoCollection.findOne({ email })
                );
                
                if (!user) {
                    return res.status(200).json({});
                }
                res.status(200).json(user);
            } catch (err) {
                console.error('Error fetching driver info:', err);
                res.status(500).json({ 
                    message: 'Error fetching driver information',
                    error: err.message
                });
            }
        });

        // Update other endpoints similarly...
        // ...existing endpoints with handleDatabaseOperation...

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
      
          // Update token expiration in verify-email-code endpoint
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
              const token = jwt.sign({ email }, secretKey, { 
                expiresIn: CONFIG.TOKEN_EXPIRATION 
              });
              res.cookie('token', token, { 
                httpOnly: true, 
                secure: !IS_DEVELOPMENT, 
                maxAge: CONFIG.COOKIE_MAX_AGE 
              });
              return res.status(200).json({ message: 'Email verified successfully.', token });
            } else {
              console.log('Invalid verification code for:', email);
              return res.status(400).json({ message: 'Invalid verification code.' });
            }
          });
      
          // Add refresh token endpoint
          app.post('/refresh-token', async (req, res) => {
            const { email } = req.body;
            try {
              const user = await usersCollection.findOne({ email });
              if (!user) {
                return res.status(400).json({ message: 'User not found.' });
              }
              const token = jwt.sign({ email }, secretKey, { 
                expiresIn: CONFIG.TOKEN_EXPIRATION 
              });
              res.status(200).json({ token });
            } catch (err) {
              console.error('Error refreshing token:', err);
              res.status(500).json({ message: 'Error refreshing token.' });
            }
          });
      
          app.get('/check-submission', async (req, res) => {
            const { email, type } = req.query;
            console.log('Checking submission for:', { email, type });
            
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
                const submitted = !!info;
                console.log(`${type} submission found:`, submitted);
                
                return res.status(200).json({ 
                    submitted,
                    info: submitted ? {
                        createdAt: info.createdAt,
                        hasImages: type === 'car' ? (info.carImages && info.carImages.length > 0) : (!!info.image)
                    } : null
                });
            } catch (err) {
                console.error('Error checking submission:', err);
                res.status(500).json({ message: 'Error checking submission.' });
            }
        });
      
          app.post('/submit-info', upload.array('images', 6), async (req, res) => {
            try {
                const { email, submissionType } = req.body;
                const files = req.files;
        
                // Process and store images
                let imageData = [];
                if (files && files.length > 0) {
                    for (const file of files) {
                        try {
                            // Convert file to Base64
                            const base64Data = await fileToBase64(file.path);
                            imageData.push({
                                contentType: file.mimetype,
                                data: base64Data
                            });
                            
                            // Clean up: remove temporary file
                            fs.unlink(file.path, (err) => {
                                if (err) console.error('Error deleting temp file:', err);
                            });
                        } catch (error) {
                            console.error('Error processing image:', error);
                        }
                    }
                }
        
                // Handle driver submission
                if (submissionType === 'driver') {
                    const driverData = {
                        ...req.body,
                        image: imageData[0] // Driver has single image
                    };
                    await driverInfoCollection.insertOne(driverData);
                }
                // Handle car submission
                else if (submissionType === 'car') {
                    const carData = {
                        ...req.body,
                        carImages: imageData // Car has multiple images
                    };
                    await carInfoCollection.insertOne(carData);
                }
        
                res.status(200).json({ message: 'Information submitted successfully' });
            } catch (error) {
                console.error('Error in submit-info:', error);
                res.status(500).json({ message: 'Error processing submission' });
            }
        });
      
          // Add endpoint to retrieve images
          app.get('/driver-images/:email', async (req, res) => {
            try {
                const { email } = req.params;
                const driverInfo = await driverInfoCollection.findOne({ email });
                
                if (!driverInfo || !driverInfo.image) {
                    return res.status(404).json({ message: 'Driver image not found' });
                }
        
                // Send Base64 image data
                res.json({ 
                    image: `data:${driverInfo.image.contentType};base64,${driverInfo.image.data}` 
                });
            } catch (err) {
                console.error('Error fetching driver image:', err);
                res.status(500).json({ message: 'Error fetching image' });
            }
        });
        
        app.get('/car-images/:email', async (req, res) => {
            try {
                const { email } = req.params;
                const carInfo = await carInfoCollection.findOne({ email });
                
                if (!carInfo || !carInfo.carImages || carInfo.carImages.length === 0) {
                    return res.status(404).json({ message: 'Car images not found' });
                }
        
                // Send Base64 image data
                const images = carInfo.carImages.map(img => 
                    `data:${img.contentType};base64,${img.data}`
                );
                res.json({ images });
            } catch (err) {
                console.error('Error fetching car images:', err);
                res.status(500).json({ message: 'Error fetching images' });
            }
        });

        app.get('/check-submission', async (req, res) => {
            try {
                const email = req.query.email || req.email; // Use query param or token email
                console.log('Checking submissions for:', email);
        
                if (!email) {
                    return res.status(400).json({ 
                        message: 'Email is required' 
                    });
                }
        
                // Check both collections simultaneously
                const [driverInfo, carInfo] = await Promise.all([
                    driverInfoCollection.findOne({ email }),
                    carInfoCollection.findOne({ email })
                ]);
        
                const result = {
                    driver: {
                        submitted: !!driverInfo,
                        info: driverInfo ? {
                            createdAt: driverInfo.createdAt,
                            hasImage: !!driverInfo.image
                        } : null
                    },
                    car: {
                        submitted: !!carInfo,
                        info: carInfo ? {
                            createdAt: carInfo.createdAt,
                            hasImages: carInfo.carImages && carInfo.carImages.length > 0
                        } : null
                    }
                };
        
                console.log('Submission check result:', result);
                return res.status(200).json(result);
            } catch (err) {
                console.error('Error checking submissions:', err);
                return res.status(500).json({ 
                    message: 'Error checking submissions',
                    error: err.message 
                });
            }
        });
        
        app.post('/submit-info', async (req, res) => {
            try {
                const { email, submissionType, image, carImages, ...data } = req.body;
                console.log('Processing submission:', { email, type: submissionType });
        
                if (submissionType === 'driver') {
                    // Validate and store driver info with image
                    const driverData = {
                        ...data,
                        email,
                        image: {  // Store image metadata with base64 data
                            contentType: image.contentType,
                            data: image.data
                        },
                        createdAt: new Date()
                    };
                    await driverInfoCollection.insertOne(driverData);
                } 
                else if (submissionType === 'car') {
                    // Validate and store car info with images
                    const processedImages = carImages.map(img => ({
                        contentType: img.contentType,
                        data: img.data
                    }));
        
                    const carData = {
                        ...data,
                        email,
                        carImages: processedImages,
                        createdAt: new Date()
                    };
                    await carInfoCollection.insertOne(carData);
                }
        
                res.status(200).json({ message: 'Information submitted successfully' });
            } catch (error) {
                console.error('Error processing submission:', error);
                res.status(500).json({ message: 'Error processing submission' });
            }
        });
        
        // Update image retrieval endpoints
        app.get('/driver-images/:email', async (req, res) => {
            try {
                const { email } = req.params;
                const driverInfo = await driverInfoCollection.findOne({ email });
                
                if (!driverInfo || !driverInfo.image) {
                    return res.status(404).json({ message: 'Driver image not found' });
                }
        
                res.json({ image: driverInfo.image });
            } catch (err) {
                console.error('Error fetching driver image:', err);
                res.status(500).json({ message: 'Error fetching image' });
            }
        });
        
        app.get('/car-images/:email', async (req, res) => {
            try {
                const { email } = req.params;
                const carInfo = await carInfoCollection.findOne({ email });
                
                if (!carInfo || !carInfo.carImages?.length === 0) {
                    return res.status(404).json({ message: 'Car images not found' });
                }
        
                res.json({ images: carInfo.carImages });
            } catch (err) {
                console.error('Error fetching car images:', err);
                res.status(500).json({ message: 'Error fetching images' });
            }
        });

        app.get('/car-info', async (req, res) => {
            try {
                const email = req.email;
                console.log('Fetching car info for:', email);
        
                const carInfo = await carInfoCollection.findOne({ email });
                if (!carInfo) {
                    console.log('Car info not found:', email);
                    return res.status(200).json({});
                }
        
                console.log('Car info fetched successfully:', email);
                res.status(200).json(carInfo);
            } catch (err) {
                console.error('Error fetching car info:', err);
                res.status(500).json({ 
                    message: 'Error fetching car information',
                    error: err.message
                });
            }
        });

        app.post('/submit-info', upload.array('images', 6), async (req, res) => {
            try {
                const { email, submissionType, ...data } = req.body;
                console.log('Car submission debug:', {
                    receivedData: data,
                    submissionType,
                    hasImages: req.files?.length || 0
                });
        
                // Validate email and authorization
                if (!email || email !== req.email) {
                    return res.status(403).json({ message: 'Invalid email or unauthorized' });
                }
        
                if (submissionType === 'car') {
                    // Validate car data
                    const { carNumberPlate, mileage, consumption, phone } = data;
                    if (!carNumberPlate || !mileage || !consumption || !phone) {
                        console.error('Missing car data:', data);
                        return res.status(400).json({ 
                            message: 'Missing required car information',
                            received: data
                        });
                    }

                    // Validate license plate
                    if (!carNumberPlate || !isValidKenyanPlate(carNumberPlate.toUpperCase())) {
                        return res.status(400).json({
                            message: 'Invalid Kenyan license plate format. Please use format: KAA 123A',
                            received: carNumberPlate
                        });
                    }

                    // Store plate in uppercase
                    data.carNumberPlate = carNumberPlate.toUpperCase();
        
                    // Process images from multer
                    const processedImages = [];
                    if (req.files && req.files.length > 0) {
                        for (const file of req.files) {
                            const base64Data = await fileToBase64(file.path);
                            processedImages.push({
                                contentType: file.mimetype,
                                data: base64Data
                            });
                            // Clean up temp file
                            fs.unlink(file.path, err => {
                                if (err) console.error('Error deleting temp file:', err);
                            });
                        }
                    }
        
                    const carData = {
                        email,
                        carNumberPlate,
                        mileage: Number(mileage),
                        consumption: Number(consumption),
                        phone,
                        carImages: processedImages,
                        createdAt: new Date()
                    };
        
                    console.log('Saving car data:', {
                        ...carData,
                        imageCount: processedImages.length
                    });
        
                    await carInfoCollection.insertOne(carData);
                    return res.status(200).json({ message: 'Car information saved successfully' });
                }
                // ... handle driver submission ...
            } catch (error) {
                console.error('Submission error:', error);
                res.status(500).json({ 
                    message: 'Error processing submission',
                    error: error.message
                });
            }
        });

        app.get('/car-info', async (req, res) => {
            try {
                const email = req.email;
                console.log('Fetching car info for:', email);
        
                const carInfo = await carInfoCollection.findOne({ email });
                console.log('Found car info:', carInfo); // Debug log
        
                if (!carInfo) {
                    console.log('Car info not found');
                    return res.status(200).json({});
                }
        
                // Return formatted car data
                const formattedCarInfo = {
                    carNumberPlate: carInfo.carNumberPlate,
                    mileage: carInfo.mileage,
                    consumption: carInfo.consumption,
                    phone: carInfo.phone,
                    carImages: carInfo.carImages || []
                };
        
                console.log('Sending car info:', formattedCarInfo);
                res.status(200).json(formattedCarInfo);
            } catch (err) {
                console.error('Error fetching car info:', err);
                res.status(500).json({ 
                    message: 'Error fetching car information',
                    error: err.message
                });
            }
        });

        // Add delete info endpoint
        app.post('/delete-info', async (req, res) => {
            try {
                const { type } = req.body;
                const email = req.email;
                const timestamp = new Date();

                // Create archive record
                const archiveRecord = {
                    email,
                    deletedAt: timestamp,
                    type,
                    data: {}
                };

                if (type === 'driver' || type === 'both') {
                    const driverInfo = await driverInfoCollection.findOne({ email });
                    if (driverInfo) {
                        archiveRecord.data.driver = driverInfo;
                        await driverInfoCollection.deleteOne({ email });
                    }
                }

                if (type === 'car' || type === 'both') {
                    const carInfo = await carInfoCollection.findOne({ email });
                    if (carInfo) {
                        archiveRecord.data.car = carInfo;
                        await carInfoCollection.deleteOne({ email });
                    }
                }

                if (type === 'both') {
                    // Mark user as deleted in users collection
                    await usersCollection.updateOne(
                        { email },
                        { $set: { deleted: true, deletedAt: timestamp } }
                    );
                }

                // Save to archived collection
                await deletedInfoCollection.insertOne(archiveRecord);

                res.status(200).json({
                    message: 'Information archived successfully',
                    archiveId: archiveRecord._id
                });
            } catch (error) {
                console.error('Error archiving information:', error);
                res.status(500).json({ message: 'Error processing deletion' });
            }
        });

        // Modify registration endpoint to check deleted users
        app.post('/register', async (req, res) => {
            try {
                const { email } = req.body;

                // Check if email exists in deleted records
                const deletedRecord = await deletedInfoCollection.findOne({
                    'data.driver.email': email
                });

                if (deletedRecord) {
                    return res.status(400).json({
                        message: 'This email is associated with a deleted account. Please contact support for account recovery.',
                        isDeleted: true
                    });
                }

                // ... rest of registration logic ...
            } catch (err) {
                // ... error handling ...
            }
        });

        // Add recovery request endpoint
        app.post('/request-recovery', async (req, res) => {
            try {
                const { email } = req.body;
                
                const deletedRecord = await deletedInfoCollection.findOne({
                    'data.driver.email': email
                });

                if (!deletedRecord) {
                    return res.status(404).json({
                        message: 'No deleted information found for this email'
                    });
                }

                // Send recovery email
                const mailOptions = {
                    from: emailUser,
                    to: email,
                    subject: 'Account Recovery Request',
                    text: `
                        We received a request to recover your deleted account information.
                        Please contact our support team to complete the recovery process.
                        
                        Your archive ID: ${deletedRecord._id}
                        Deletion Date: ${deletedRecord.deletedAt}
                        
                        This request will expire in 30 days from the deletion date.
                    `
                };

                await transporter.sendMail(mailOptions);

                res.status(200).json({
                    message: 'Recovery instructions sent to your email'
                });
            } catch (error) {
                console.error('Error processing recovery request:', error);
                res.status(500).json({ message: 'Error processing recovery request' });
            }
        });

        // Clean up old archived records (older than 30 days)
        setInterval(async () => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            try {
                await deletedInfoCollection.deleteMany({
                    deletedAt: { $lt: thirtyDaysAgo }
                });
            } catch (error) {
                console.error('Error cleaning up old archives:', error);
            }
        }, 24 * 60 * 60 * 1000); // Run daily

        app.put('/car-info', async (req, res) => {
            try {
                const { email, carNumberPlate, mileage, consumption, phone, carImages } = req.body;
                console.log('Car info update:', email);
        
                // Validate inputs
                if (!email || email !== req.email) {
                    return res.status(403).json({ message: 'Invalid email or unauthorized' });
                }
        
                if (!isValidKenyanPlate(carNumberPlate.toUpperCase())) {
                    return res.status(400).json({ message: 'Invalid license plate format' });
                }
        
                const updateData = {
                    carNumberPlate: carNumberPlate.toUpperCase(),
                    mileage: Number(mileage),
                    consumption: Number(consumption),
                    phone
                };
        
                // Only update images if new ones are provided
                if (carImages && carImages.length > 0) {
                    updateData.carImages = carImages;
                }
        
                await carInfoCollection.updateOne(
                    { email },
                    { $set: updateData }
                );
        
                console.log('Car info updated successfully:', email);
                res.status(200).json({ message: 'Car information updated successfully' });
            } catch (err) {
                console.error('Error updating car info:', err);
                res.status(500).json({ message: 'Error updating car information' });
            }
        });

        // Add this new endpoint inside your main function
        app.get('/user-data', async (req, res) => {
            try {
                const email = req.email; // From your JWT middleware
                
                const user = await usersCollection.findOne(
                    { email },
                    { projection: { password: 0 } } // Exclude password from the response
                );

                if (!user) {
                    return res.status(404).json({ message: 'User not found' });
                }

                res.status(200).json(user);
            } catch (err) {
                console.error('Error fetching user data:', err);
                res.status(500).json({ message: 'Error fetching user data' });
            }
        });

        app.listen(port, () => {
            console.log(`Server is running at http://localhost:${port}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        if (dbClient) {
            await dbClient.close();
            console.log('MongoDB connection closed');
        }
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
