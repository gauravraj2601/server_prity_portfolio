import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import dns from 'dns';
import portfolioImageRoutes from './routes/portfolioImageRoutes.js';

dns.setServers(['8.8.8.8','8.8.4.4']);

dotenv.config();

const app=express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/api/portfolio_images',portfolioImageRoutes);
app.use('/api/images',portfolioImageRoutes);

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
