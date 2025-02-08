const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;
const secretKey = process.env.JWT_SECRET;
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

if (!uri || !secretKey || !emailUser || !emailPass) {
  console.error('Environment variables are not defined properly.');
  process.exit(1);
}

const client = new MongoClient(uri);

app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.static(path.join(__dirname, 'driverpanel'), {
  setHeaders: (res, path, stat) => {
    if (path.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
    }
  }
}));
app.get('/reset-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'reset-password.html'));
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts from this IP, please try again after 15 minutes'
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many verification requests from this IP, please try again after 15 minutes'
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 3, // limit each IP to 3 requests per windowMs
  message: 'Too many password reset requests. Please try again after an hour.'
});

const resetRequests = new Map(); // Track reset requests per email

app.use('/register', registerLimiter);
app.use('/login', loginLimiter);
app.use('/verify-email-code', verificationLimiter);
app.use('/forgot-password', forgotPasswordLimiter);

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
    const deletedUsersCollection = db.collection('deletedUsers');
    const deletedDriverInfoCollection = db.collection('deletedDriverInfo');
    const deletedCarInfoCollection = db.collection('deletedCarInfo');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    function generateVerificationCode() {
      return Math.floor(100000 + Math.random() * 900000).toString();
    }

    const verificationCodes = {};
    const verificationRequests = {};
    const lastRequestTimestamps = {};

    const MAX_REQUESTS = 20;
    const REQUEST_WINDOW_MS = 10 * 60 * 60 * 1000;
    const CODE_EXPIRATION_MS = 5 * 60 * 1000;
    const REQUEST_COOLDOWN_MS = 30 * 60 * 1000;

    app.post('/register', async (req, res) => {
      try {
        const { name, email, password } = req.body;
        console.log('Registration attempt:', email);

        // Check if email exists in deleted users
        const deletedUser = await deletedUsersCollection.findOne({ email });
        if (deletedUser) {
          const daysLeft = Math.ceil((deletedUser.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
          return res.status(400).json({ 
            message: `This email cannot be used for registration for ${daysLeft} more days. Please contact support for account recovery.`
          });
        }

        // Validate and sanitize inputs
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          return res.status(400).json({ message: 'Invalid email format.' });
        }

        const user = await usersCollection.findOne({ email, name });
        if (user) {
          console.log('User already exists:', email);
          return res.status(400).json({ message: 'User already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({ name, email, password: hashedPassword });

        console.log('User registered successfully:', email);

        const verificationCode = generateVerificationCode();
        const timestamp = Date.now();
        verificationCodes[email] = { code: verificationCode, timestamp };

        if (!verificationRequests[email]) {
          verificationRequests[email] = [];
        }
        verificationRequests[email].push(timestamp);

        const token = jwt.sign({ email }, secretKey, { expiresIn: '5m' }); // Token expires in 5 minutes

        const mailOptions = {
          from: emailUser,
          to: email,
          subject: 'Email Verification',
          text: `
Thank you for signing up at hire a driver! To complete the verification process, please use the code below:

Hire a driver:  
Your Verification Code:${verificationCode}

This code is valid for the next 3 minutes. If you did not request this, please ignore this email.

If you have any questions or need assistance, feel free to contact our support team at webeighteen18@gmail.com.

Thank you,`
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ message: 'Error sending email.' });
          }
          res.cookie('token', token, { httpOnly: true, secure: true, maxAge: 5 * 60 * 1000 }); // Set HttpOnly cookie
          res.status(200).json({ message: 'User registered successfully. Please check your email for the verification code.' });
        });
      } catch (err) {
        console.error('Error registering new user:', err);
        res.status(500).send({ message: 'Error registering new user.' });
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
        res.cookie('token', token, { httpOnly: true, secure: true, maxAge: 5 * 60 * 1000 }); // Set HttpOnly cookie
        return res.status(200).json({ message: 'Email verified successfully.', token });
      } else {
        console.log('Invalid verification code for:', email);
        return res.status(400).json({ message: 'Invalid verification code.' });
      }
    });

    function limitVerificationRequests(req, res, next) {
      const { email } = req.body;
      const currentTime = Date.now();

      if (!verificationRequests[email]) {
        verificationRequests[email] = [];
      }

      verificationRequests[email] = verificationRequests[email].filter(
        (timestamp) => currentTime - timestamp < REQUEST_WINDOW_MS
      );

      if (verificationRequests[email].length >= MAX_REQUESTS) {
        return res.status(429).json({ message: 'Too many verification requests. Please try again after 10 hours.' });
      }

      if (lastRequestTimestamps[email] && currentTime - lastRequestTimestamps[email] < REQUEST_COOLDOWN_MS) {
        const remainingTime = Math.ceil((REQUEST_COOLDOWN_MS - (currentTime - lastRequestTimestamps[email])) / 1000);
        return res.status(429).json({ message: `Please wait ${remainingTime} seconds before requesting another verification code.` });
      }

      next();
    }

    app.use('/register', registerLimiter, limitVerificationRequests);
    app.use('/login', loginLimiter, limitVerificationRequests);

    app.post('/request-verification-code', limitVerificationRequests, async (req, res) => {
      const { email } = req.body;
      const user = await usersCollection.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: 'User not found.' });
      }

      const verificationCode = generateVerificationCode();
      const timestamp = Date.now();
      verificationCodes[email] = { code: verificationCode, timestamp };
      lastRequestTimestamps[email] = timestamp;

      if (!verificationRequests[email]) {
        verificationRequests[email] = [];
      }
      verificationRequests[email].push(timestamp);

      const mailOptions = {
        from: emailUser,
        to: email,
        subject: 'Email Verification',
        text: `
Thank you for signing up at hire a driver! To complete the verification process, please use the code below:

Hire a driver:  
Your Verification Code:${verificationCode}

This code is valid for the next 3 minutes. If you did not request this, please ignore this email.

If you have any questions or need assistance, feel free to contact our support team at webeighteen18@gmail.com.

Thank you,`
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error);
          return res.status(500).json({ message: 'Error sending email.' });
        }
        res.status(200).json({ message: 'Verification code sent again. Please check your email.' });
      });
    });

    app.post('/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        console.log('Login attempt:', email);

        // Check if account is deleted
        const deletedUser = await deletedUsersCollection.findOne({ email });
        if (deletedUser) {
          const daysLeft = Math.ceil((deletedUser.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
          return res.status(401).json({ 
            message: `This account has been deleted. Please wait ${daysLeft} days or contact support for account recovery.`
          });
        }

        // Validate and sanitize inputs
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          return res.status(400).json({ message: 'Invalid email format.' });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
          console.log('User not found:', email);
          return res.status(400).json({ message: 'Invalid email .' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          console.log('Password mismatch for user:', email);
          return res.status(400).json({ message: 'Invalid  password.' });
        }

        const token = jwt.sign({ email: user.email }, secretKey, { expiresIn: '5m' }); // Token expires in 5 minutes

        console.log('User logged in successfully:', email);

        const verificationCode = generateVerificationCode();
        const timestamp = Date.now();
        verificationCodes[email] = { code: verificationCode, timestamp };

        const mailOptions = {
          from: emailUser,
          to: email,
          subject: 'Email Verification',
          text: `Hi ${email},

Thank you for signing in at hire a driver! To complete the verification process, please use the code below:


Your Verification Code:${verificationCode}

This code is valid for the next 3 minutes. If you did not request this, please ignore this email.

If you have any questions or need assistance, feel free to contact our support team at webeighteen18@gmail.com.

Thank you,`
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ message: 'Error sending email.' });
          }
          res.cookie('token', token, { httpOnly: true, secure: true, maxAge: 5 * 60 * 1000 }); // Set HttpOnly cookie
          res.status(200).json({ message: 'Login successful. Please check your email for the verification code.' });
        });
      } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).send({ message: 'Error logging in.' });
      }
    });

    app.post('/forgot-password', async (req, res) => {
      const { email } = req.body;
      
      // Check if there's an existing request and it's within cooldown
      const lastRequest = resetRequests.get(email);
      const now = Date.now();
      if (lastRequest && (now - lastRequest) < 5 * 60 * 1000) { // 5 minutes cooldown
        const remainingTime = Math.ceil((5 * 60 * 1000 - (now - lastRequest)) / 1000);
        return res.status(429).json({ 
          message: `Please wait ${remainingTime} seconds before requesting another reset link.` 
        });
      }

      try {
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(400).json({ message: 'User not found.' });
        }

        resetRequests.set(email, now);
        
        const token = jwt.sign({ email: user.email }, secretKey, { expiresIn: '1h' });
        const resetLink = `http://localhost:3000/reset-password.html?token=${token}`;

        const mailOptions = {
          from: emailUser,
          to: email,
          subject: 'Password Reset',
          text: `Hi ${user.name},

We received a request to reset your password.

Click here to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
Hire a Driver Team`
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ message: 'Error sending email.' });
          }
          res.status(200).json({ message: 'Password reset link has been sent to your email.' });
        });
      } catch (err) {
        console.error('Error in forgot password:', err);
        res.status(500).json({ message: 'An error occurred. Please try again.' });
      }
    });

    app.post('/reset-password', async (req, res) => {
      const { token, newPassword } = req.body;
      try {
        const decoded = jwt.verify(token, secretKey);
        const email = decoded.email;

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await usersCollection.updateOne({ email }, { $set: { password: hashedPassword } });

        res.status(200).json({ message: 'Password has been reset successfully.' });
      } catch (err) {
        console.error('Error resetting password:', err);
        res.status(500).json({ message: 'Invalid or expired token.' });
      }
    });

    // Delete full account
    app.delete('/delete-account', async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({ message: 'Account not found.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid password.' });
        }

        // Move user to deleted users collection with deletion date
        const deletionDate = new Date();
        const expiryDate = new Date(deletionDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now

        await deletedUsersCollection.insertOne({
          ...user,
          deletionDate,
          expiryDate,
          deletionType: 'full_account'
        });

        // Remove user from active collection
        await usersCollection.deleteOne({ email });

        res.status(200).json({ message: 'Account deleted successfully. Data will be permanently removed after 30 days.' });
      } catch (err) {
        console.error('Error deleting account:', err);
        res.status(500).json({ message: 'Error deleting account.' });
      }
    });

    // Delete driver info only
    app.delete('/delete-driver-info', async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({ message: 'Account not found.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid password.' });
        }

        const driverInfo = user.driverInfo;
        if (!driverInfo) {
          return res.status(404).json({ message: 'No driver information found.' });
        }

        // Store deleted driver info
        await deletedDriverInfoCollection.insertOne({
          email,
          driverInfo,
          deletionDate: new Date(),
          expiryDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
        });

        // Remove driver info from user document
        await usersCollection.updateOne(
          { email },
          { $unset: { driverInfo: "" } }
        );

        res.status(200).json({ message: 'Driver information deleted successfully.' });
      } catch (err) {
        console.error('Error deleting driver info:', err);
        res.status(500).json({ message: 'Error deleting driver information.' });
      }
    });

    // Delete car info only
    app.delete('/delete-car-info', async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({ message: 'Account not found.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid password.' });
        }

        const carInfo = user.carInfo;
        if (!carInfo) {
          return res.status(404).json({ message: 'No car information found.' });
        }

        // Store deleted car info
        await deletedCarInfoCollection.insertOne({
          email,
          carInfo,
          deletionDate: new Date(),
          expiryDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
        });

        // Remove car info from user document
        await usersCollection.updateOne(
          { email },
          { $unset: { carInfo: "" } }
        );

        res.status(200).json({ message: 'Car information deleted successfully.' });
      } catch (err) {
        console.error('Error deleting car info:', err);
        res.status(500).json({ message: 'Error deleting car information.' });
      }
    });

    // Cleanup job for deleted data (runs daily)
    setInterval(async () => {
      try {
        const now = new Date();
        const collections = [deletedUsersCollection, deletedDriverInfoCollection, deletedCarInfoCollection];
        
        for (const collection of collections) {
          await collection.deleteMany({ expiryDate: { $lt: now } });
        }
        console.log('Cleanup job completed successfully');
      } catch (err) {
        console.error('Error in cleanup job:', err);
      }
    }, 24 * 60 * 60 * 1000); // Run every 24 hours

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
