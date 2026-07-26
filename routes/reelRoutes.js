import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import Reel from '../models/Reel.js';

dotenv.config();

const router = express.Router();

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'cj8syf8t',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for cover photo!'), false);
    }
  },
});

// Helper function to handle Cloudinary upload from buffer
const uploadToCloudinary = (fileBuffer, folderName = 'priti_portfolio_reels') => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: folderName,
      resource_type: 'image',
    };

    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      uploadOptions.api_key = process.env.CLOUDINARY_API_KEY;
      uploadOptions.api_secret = process.env.CLOUDINARY_API_SECRET;
    } else {
      uploadOptions.upload_preset = 'ml_default';
      uploadOptions.unsigned = true;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// 1. GET /api/reels - Return all reels sorted by newest
router.get('/', async (req, res) => {
  try {
    const reels = await Reel.find().sort({ createdAt: -1 });
    res.json(reels);
  } catch (error) {
    console.error('Error fetching reels:', error);
    res.status(500).json({ message: 'Server error fetching reels.' });
  }
});

// 2. POST /api/reels/upload - Create new reel item
router.post('/upload', upload.single('coverImage'), async (req, res) => {
  try {
    const { reel_url, likes_count, comments_count, caption } = req.body;

    if (!reel_url) {
      return res.status(400).json({ message: 'Instagram Reel URL is required.' });
    }

    let cover_image_url = '';
    let public_id = '';

    if (req.file) {
      const cloudResult = await uploadToCloudinary(req.file.buffer, 'priti_portfolio_reels');
      cover_image_url = cloudResult.secure_url;
      public_id = cloudResult.public_id;
    } else if (req.body.cover_image_url) {
      cover_image_url = req.body.cover_image_url;
    } else {
      return res.status(400).json({ message: 'Cover photo is required.' });
    }

    const newReel = new Reel({
      reel_url: reel_url.trim(),
      cover_image_url,
      public_id,
      likes_count: likes_count || '0',
      comments_count: comments_count || '0',
      caption: caption ? caption.trim() : '',
    });

    const savedReel = await newReel.save();
    res.status(201).json(savedReel);
  } catch (error) {
    console.error('Error creating reel:', error);
    res.status(500).json({ message: error.message || 'Server error creating reel.' });
  }
});

// 3. PUT /api/reels/:id - Update reel details
router.put('/:id', upload.single('coverImage'), async (req, res) => {
  try {
    const { reel_url, likes_count, comments_count, caption } = req.body;
    const reelDoc = await Reel.findById(req.params.id);

    if (!reelDoc) {
      return res.status(404).json({ message: 'Reel not found.' });
    }

    if (reel_url) reelDoc.reel_url = reel_url.trim();
    if (likes_count !== undefined) reelDoc.likes_count = likes_count;
    if (comments_count !== undefined) reelDoc.comments_count = comments_count;
    if (caption !== undefined) reelDoc.caption = caption.trim();

    if (req.file) {
      if (reelDoc.public_id && process.env.CLOUDINARY_API_KEY) {
        try {
          await cloudinary.uploader.destroy(reelDoc.public_id);
        } catch (e) {}
      }
      const cloudResult = await uploadToCloudinary(req.file.buffer, 'priti_portfolio_reels');
      reelDoc.cover_image_url = cloudResult.secure_url;
      reelDoc.public_id = cloudResult.public_id;
    }

    const updatedReel = await reelDoc.save();
    res.json(updatedReel);
  } catch (error) {
    console.error('Error updating reel:', error);
    res.status(500).json({ message: 'Server error updating reel.' });
  }
});

// 4. DELETE /api/reels/:id - Delete reel from Cloudinary & MongoDB
router.delete('/:id', async (req, res) => {
  try {
    const reelDoc = await Reel.findById(req.params.id);
    if (!reelDoc) {
      return res.status(404).json({ message: 'Reel not found.' });
    }

    if (reelDoc.public_id && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        await cloudinary.uploader.destroy(reelDoc.public_id);
      } catch (err) {
        console.warn('Cloudinary delete warning:', err.message);
      }
    }

    await Reel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Reel deleted successfully.' });
  } catch (error) {
    console.error('Error deleting reel:', error);
    res.status(500).json({ message: 'Server error deleting reel.' });
  }
});

export default router;
