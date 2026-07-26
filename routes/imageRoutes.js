import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import Image from '../models/Image.js';

dotenv.config();

const router = express.Router();

// Configure Cloudinary SDK with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'cj8syf8t',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Configure Multer for memory storage (for uploading buffer to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

// Helper function to handle Cloudinary upload from buffer
const uploadToCloudinary = (fileBuffer, folderName = 'priti_portfolio') => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: folderName,
      resource_type: 'image',
    };

    // Include API Key & Secret directly if configured
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

// 1. POST /api/images/upload
// Upload image to Cloudinary & save details in MongoDB
router.post('/upload',upload.single('image'),async (req,res) => {
  try {
    const {title,category,description}=req.body;

    if (!title) {
      return res.status(400).json({message: 'Title is required.'});
    }

    let image_url='';
    let public_id='';

    if (req.file) {
      // Direct Cloudinary Node SDK Upload inside folder 'priti_portfolio'
      const cloudResult=await uploadToCloudinary(req.file.buffer,'priti_portfolio');
      image_url=cloudResult.secure_url;
      public_id=cloudResult.public_id;
    } else if (req.body.image_url) {
      // Fallback if URL passed directly
      image_url=req.body.image_url;
      public_id=req.body.public_id||`priti_portfolio/${Date.now()}`;
    } else {
      return res.status(400).json({message: 'An image file is required for upload.'});
    }

    const newImage=new Image({
      title: title.trim(),
      category: category||'Bridal',
      description: description? description.trim():'',
      image_url,
      public_id,
    });

    const savedImage=await newImage.save();
    res.status(201).json(savedImage);
  } catch (error) {
    console.error('Error uploading image to Cloudinary/DB:',error);
    res.status(500).json({message: error.message||'Server error during upload.'});
  }
});

// 2. GET /api/images
// Return all images sorted by latest first
router.get('/',async (req,res) => {
  try {
    const images=await Image.find().sort({createdAt: -1});
    res.json(images);
  } catch (error) {
    console.error('Error fetching images:',error);
    res.status(500).json({message: 'Server error fetching images.'});
  }
});

// 3. GET /api/images/:id
// Return single image document
router.get('/:id',async (req,res) => {
  try {
    const image=await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({message: 'Image not found'});
    }
    res.json(image);
  } catch (error) {
    console.error('Error fetching single image:',error);
    res.status(500).json({message: 'Server error fetching image.'});
  }
});

// 4. PUT /api/images/:id
// Update title, category, description (image not re-uploaded unless a new file is provided)
router.put('/:id',upload.single('image'),async (req,res) => {
  try {
    const {title,category,description}=req.body;
    const imageDoc=await Image.findById(req.params.id);

    if (!imageDoc) {
      return res.status(404).json({message: 'Image document not found'});
    }

    if (title) imageDoc.title=title.trim();
    if (category) imageDoc.category=category;
    if (description!==undefined) imageDoc.description=description.trim();

    // Re-upload to Cloudinary ONLY if a new file is provided
    if (req.file) {
      // Delete old image from Cloudinary if public_id exists
      if (imageDoc.public_id) {
        try {
          await cloudinary.uploader.destroy(imageDoc.public_id);
        } catch (e) {
          console.warn('Could not remove old Cloudinary image:',e);
        }
      }
      const cloudResult=await uploadToCloudinary(req.file.buffer,'priti_portfolio');
      imageDoc.image_url=cloudResult.secure_url;
      imageDoc.public_id=cloudResult.public_id;
    }

    const updatedImage=await imageDoc.save();
    res.json(updatedImage);
  } catch (error) {
    console.error('Error updating image:',error);
    res.status(500).json({message: 'Server error updating image.'});
  }
});

// 5. DELETE /api/images/:id
// Delete image from Cloudinary using public_id and delete document from MongoDB
router.delete('/:id',async (req,res) => {
  try {
    const imageDoc=await Image.findById(req.params.id);
    if (!imageDoc) {
      return res.status(404).json({message: 'Image document not found'});
    }

    // Delete image from Cloudinary using public_id
    if (imageDoc.public_id) {
      try {
        const cloudDeleteRes=await cloudinary.uploader.destroy(imageDoc.public_id);
        console.log(`Cloudinary delete result for ${imageDoc.public_id}:`,cloudDeleteRes);
      } catch (err) {
        console.warn(`Error deleting ${imageDoc.public_id} from Cloudinary:`,err.message||err);
      }
    }

    await Image.findByIdAndDelete(req.params.id);
    res.json({message: 'Image deleted successfully from Cloudinary and MongoDB'});
  } catch (error) {
    console.error('Error deleting image:',error);
    res.status(500).json({message: 'Server error deleting image.'});
  }
});

export default router;
