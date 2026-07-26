import mongoose from 'mongoose';

const reelSchema = new mongoose.Schema(
  {
    cover_image_url: {
      type: String,
      required: true,
    },
    public_id: {
      type: String,
      default: '',
    },
    reel_url: {
      type: String,
      required: true,
      trim: true,
    },
    likes_count: {
      type: String,
      default: '0',
    },
    comments_count: {
      type: String,
      default: '0',
    },
    caption: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

const Reel = mongoose.model('Reel', reelSchema);

export default Reel;
