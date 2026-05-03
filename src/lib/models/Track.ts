import mongoose from 'mongoose';

const TrackSchema = new mongoose.Schema({
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  title: { type: String, required: true },
  description: { type: String },
  audioUrl: { type: String, required: true },
  story: { type: String }, // rich text
  genre: { type: String },
  releaseDate: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: true },
  playCount: { type: Number, default: 0 },
});

export default mongoose.models.Track || mongoose.model('Track', TrackSchema);