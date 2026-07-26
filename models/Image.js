import mongoose from 'mongoose';

const imageSchema=new mongoose.Schema(
  {
    // Multiple images support
    images: [
      {
        image_url: { type: String, required: true },
        public_id: { type: String, required: true },
      }
    ],
    // Legacy single image fields for backwards compatibility
    image_url: {
      type: String,
      default: '',
    },
    public_id: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["Bridal","Party Makeup","Engagement","Reception","Traditional","HD Makeup"],
      default: "Bridal",
    },
    description: {
      type: String,
      default: "",
    },
    isBeforeAfter: {
      type: Boolean,
      default: false,
    },
  },
  {timestamps: true}
);

const Image=mongoose.model('Image',imageSchema);

export default Image;
