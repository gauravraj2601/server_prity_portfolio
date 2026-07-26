import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["Bridal", "Party", "Engagement", "Reception", "Traditional", "HD Makeup"],
      default: "Bridal",
    },
    image: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Portfolio = mongoose.model('Portfolio', portfolioSchema);

export default Portfolio;
