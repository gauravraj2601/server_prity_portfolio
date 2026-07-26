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
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowedExts = /\.(jpg|jpeg|png|webp|gif|heic|avif|bmp)$/i;
    const isImageMime = file.mimetype ? file.mimetype.startsWith('image/') : false;
    const isImageExt = allowedExts.test(file.originalname);

    if (isImageMime || isImageExt) {
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

// 1. POST /api/portfolio_images/upload
// Upload multiple images to Cloudinary & save details in MongoDB
router.post('/upload', upload.array('images', 10), async (req, res) => {
  try {
    const { title, category, description, isBeforeAfter } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required.' });
    }

    let uploadedImages = [];

    // Support multiple uploaded files via multer
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const cloudResult = await uploadToCloudinary(file.buffer, 'priti_portfolio');
        uploadedImages.push({
          image_url: cloudResult.secure_url,
          public_id: cloudResult.public_id,
        });
      }
    } else if (req.file) {
      // Single file fallback
      const cloudResult = await uploadToCloudinary(req.file.buffer, 'priti_portfolio');
      uploadedImages.push({
        image_url: cloudResult.secure_url,
        public_id: cloudResult.public_id,
      });
    } else if (req.body.image_url) {
      uploadedImages.push({
        image_url: req.body.image_url,
        public_id: req.body.public_id || `priti_portfolio/${Date.now()}`,
      });
    } else {
      return res.status(400).json({ message: 'At least one image file is required for upload.' });
    }

    const firstImg = uploadedImages[0];

    const newImage = new Image({
      title: title.trim(),
      category: category || 'Bridal',
      description: description ? description.trim() : '',
      isBeforeAfter: isBeforeAfter === 'true' || isBeforeAfter === true,
      images: uploadedImages,
      image_url: firstImg ? firstImg.image_url : '',
      public_id: firstImg ? firstImg.public_id : '',
    });

    const savedImage = await newImage.save();
    res.status(201).json(savedImage);
  } catch (error) {
    console.error('Error uploading images to Cloudinary/DB:', error);
    res.status(500).json({ message: error.message || 'Server error during upload.' });
  }
});

// 2. GET /api/images
// Return all images sorted by latest first
router.get('/', async (req, res) => {
  try {
    const images = await Image.find().sort({ createdAt: -1 });
    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ message: 'Server error fetching images.' });
  }
});

// 3. GET /api/images/:id
// Return single image document
router.get('/:id', async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    res.json(image);
  } catch (error) {
    console.error('Error fetching single image:', error);
    res.status(500).json({ message: 'Server error fetching image.' });
  }
});

// 4. PUT /api/images/:id
// Update title, category, description, isBeforeAfter, remove deselected photos from Cloudinary & append new uploaded photos
router.put('/:id', upload.array('images', 10), async (req, res) => {
  try {
    const { title, category, description, isBeforeAfter, keepPublicIds, removedPublicIds } = req.body;
    const imageDoc = await Image.findById(req.params.id);

    if (!imageDoc) {
      return res.status(404).json({ message: 'Image document not found' });
    }

    if (title) imageDoc.title = title.trim();
    if (category) imageDoc.category = category;
    if (description !== undefined) imageDoc.description = description.trim();
    if (isBeforeAfter !== undefined) {
      imageDoc.isBeforeAfter = isBeforeAfter === 'true' || isBeforeAfter === true;
    }

    // Parse IDs sent from frontend
    let keptIdsList = null;
    let removedIdsList = [];

    if (keepPublicIds) {
      try { keptIdsList = JSON.parse(keepPublicIds); } catch (e) {}
    }
    if (removedPublicIds) {
      try { removedIdsList = JSON.parse(removedPublicIds); } catch (e) {}
    }

    // 1. Destroy explicitly removed photos from Cloudinary
    if (removedIdsList && removedIdsList.length > 0) {
      for (const pubId of removedIdsList) {
        if (pubId) {
          try {
            await cloudinary.uploader.destroy(pubId);
            console.log(`Destroyed Cloudinary image: ${pubId}`);
          } catch (err) {
            console.warn(`Could not destroy Cloudinary image ${pubId}:`, err.message || err);
          }
        }
      }
    }

    // 2. Filter existing document images to only keep those in keptIdsList (if passed)
    let currentImages = [];
    if (imageDoc.images && imageDoc.images.length > 0) {
      if (Array.isArray(keptIdsList)) {
        currentImages = imageDoc.images.filter(img => keptIdsList.includes(img.public_id));
      } else {
        currentImages = imageDoc.images.filter(img => !removedIdsList.includes(img.public_id));
      }
    } else if (imageDoc.image_url) {
      if (!removedIdsList.includes(imageDoc.public_id)) {
        currentImages = [{ image_url: imageDoc.image_url, public_id: imageDoc.public_id }];
      }
    }

    // 3. Upload any newly added files to Cloudinary and append to currentImages
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const cloudResult = await uploadToCloudinary(file.buffer, 'priti_portfolio');
        currentImages.push({
          image_url: cloudResult.secure_url,
          public_id: cloudResult.public_id,
        });
      }
    }

    imageDoc.images = currentImages;
    if (currentImages.length > 0) {
      imageDoc.image_url = currentImages[0].image_url;
      imageDoc.public_id = currentImages[0].public_id;
    } else {
      imageDoc.image_url = '';
      imageDoc.public_id = '';
    }

    const updatedImage = await imageDoc.save();
    res.json(updatedImage);
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ message: 'Server error updating image.' });
  }
});

// 5. DELETE /api/images/:id
// Delete all associated images from Cloudinary using public_ids and delete document from MongoDB
router.delete('/:id', async (req, res) => {
  try {
    const imageDoc = await Image.findById(req.params.id);
    if (!imageDoc) {
      return res.status(404).json({ message: 'Image document not found' });
    }

    // Delete all images in array from Cloudinary
    if (imageDoc.images && imageDoc.images.length > 0) {
      for (const imgItem of imageDoc.images) {
        if (imgItem.public_id) {
          try {
            await cloudinary.uploader.destroy(imgItem.public_id);
          } catch (err) {
            console.warn(`Error deleting ${imgItem.public_id} from Cloudinary:`, err.message || err);
          }
        }
      }
    } else if (imageDoc.public_id) {
      try {
        await cloudinary.uploader.destroy(imageDoc.public_id);
      } catch (err) {
        console.warn(`Error deleting ${imageDoc.public_id} from Cloudinary:`, err.message || err);
      }
    }

    await Image.findByIdAndDelete(req.params.id);
    res.json({ message: 'Portfolio client entry deleted successfully from Cloudinary and MongoDB' });
  } catch (error) {
    console.error('Error deleting image entry:', error);
    res.status(500).json({ message: 'Server error deleting entry.' });
  }
});

export default router;
