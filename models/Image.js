import mongoose from 'mongoose';

const imageSchema=new mongoose.Schema(
  {
    image_url: {
      type: String,
      required: true,
    },
    public_id: {
      type: String,
      required: true,
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
  },
  {timestamps: true}
);

const Image=mongoose.model('Image',imageSchema);

export default Image;
