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

app.use(express.static(path.join(__dirname, 'driverpanel')));
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

app.use('/register', registerLimiter);
app.use('/login', loginLimiter);
app.use('/verify-email-code', verificationLimiter);

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
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'User not found.' });
      }

      const token = jwt.sign({ email: user.email }, secretKey, { expiresIn: '1h' });
      const resetLink = `http://localhost:3000/reset-password.html?token=${token}`;

      const mailOptions = {
        from: emailUser,
        to: email,
        subject: 'Password Reset',
        text: `Hi ${user.name},

We received a request to reset the password for your account associated with this email address.

Please click the link below to reset your password:
${resetLink}

For security reasons, this link will expire in 1 hour. If you did not request a password reset, please ignore this email. Your password will remain unchanged.

### Instructions:

1. Click the link above.
2. You will be redirected to our password reset page.
3. Enter your new password and confirm it.
4. Submit the form to complete the process.

If you have any questions or need further assistance, feel free to contact our support team.

Best regards,
hire a driver Support Team

 If you did not request this password reset, you can safely ignore this email. Your account will remain secure.`
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error);
          return res.status(500).json({ message: 'Error sending email.' });
        }
        res.status(200).json({ message: 'Password reset link has been sent to your email.' });
      });
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
