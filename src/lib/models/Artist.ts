import mongoose from 'mongoose';

const ArtistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bio: { type: String },
  socialLinks: { type: Object }, // { instagram: '', twitter: '' }
  totalSupporters: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
});

export default mongoose.models.Artist || mongoose.model('Artist', ArtistSchema);