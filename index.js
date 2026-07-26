import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import dns from 'dns';
import path from 'path';
import portfolioRoutes from './routes/portfolioRoutes.js';
import imageRoutes from './routes/imageRoutes.js';

dns.setServers(['8.8.8.8','8.8.4.4']);

dotenv.config();

const app=express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve static uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/images', imageRoutes);

const PORT=process.env.PORT||5000;
const MONGODB_URI=process.env.MONGODB_URI;

// Basic test route
app.get('/',(req,res) => {
  res.send('Server is running successfully!');
});

// Connect to MongoDB and start server
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB Database!');
    app.listen(PORT,() => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:',error.message);
  });
