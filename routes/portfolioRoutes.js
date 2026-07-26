import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Portfolio from '../models/Portfolio.js';

const router=express.Router();

// Configure storage for uploaded files
const uploadsDir=path.join(process.cwd(),'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir,{recursive: true});
}

const storage=multer.diskStorage({
  destination: function(req,file,cb) {
    cb(null,uploadsDir);
  },
  filename: function(req,file,cb) {
    const uniqueSuffix=Date.now()+'-'+Math.round(Math.random()*1e9);
    const ext=path.extname(file.originalname);
    cb(null,file.fieldname+'-'+uniqueSuffix+ext);
  },
});

const upload=multer({
  storage: storage,
  limits: {fileSize: 10*1024*1024}, // 10MB limit
  fileFilter: (req,file,cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null,true);
    } else {
      cb(new Error('Only image files are allowed!'),false);
    }
  },
});

// @route   GET /api/portfolio
// @desc    Get all portfolio items from DB
router.get('/',async (req,res) => {
  try {
    const items=await Portfolio.find().sort({createdAt: -1});
    res.json(items);
  } catch (error) {
    console.error('Error fetching portfolio items:',error);
    res.status(500).json({message: 'Server error fetching portfolio items'});
  }
});

// @route   POST /api/portfolio
// @desc    Save portfolio item (with file upload or image URL)
router.post('/',upload.single('imageFile'),async (req,res) => {
  try {
    const {title,category,imageUrl}=req.body;

    let finalImageUrl=imageUrl;

    // If a file was uploaded, construct local URL served by express static
    if (req.file) {
      finalImageUrl=`${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    if (!title||!finalImageUrl) {
      return res.status(400).json({message: 'Title and image are required.'});
    }

    const newItem=new Portfolio({
      title: title.trim(),
      category: category||'Bridal',
      image: finalImageUrl,
    });

    const savedItem=await newItem.save();
    res.status(201).json(savedItem);
  } catch (error) {
    console.error('Error saving portfolio item:',error);
    res.status(500).json({message: 'Server error saving portfolio item'});
  }
});

// @route   DELETE /api/portfolio/:id
// @desc    Delete a portfolio item
router.delete('/:id',async (req,res) => {
  try {
    const item=await Portfolio.findById(req.params.id);
    if (!item) {
      return res.status(404).json({message: 'Portfolio item not found'});
    }

    // If local file, optionally delete from disk
    if (item.image.includes('/uploads/')) {
      const filename=item.image.split('/uploads/')[1];
      if (filename) {
        const filePath=path.join(uploadsDir,filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    await Portfolio.findByIdAndDelete(req.params.id);
    res.json({message: 'Portfolio item deleted successfully'});
  } catch (error) {
    console.error('Error deleting portfolio item:',error);
    res.status(500).json({message: 'Server error deleting portfolio item'});
  }
});

export default router;
