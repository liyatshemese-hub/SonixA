import mongoose from 'mongoose';

const DonationSchema = new mongoose.Schema({
  fan: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  message: { type: String },
  paymentId: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Donation || mongoose.model('Donation', DonationSchema);