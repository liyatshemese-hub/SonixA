import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import dbConnect from '@/lib/mongodb';
import Donation from '@/lib/models/Donation';
import Artist from '@/lib/models/Artist';
import jwt from 'jsonwebtoken';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(request: NextRequest) {
  await dbConnect();

  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { artistId, amount, message } = await request.json();

  if (!artistId || !amount) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const artist = await Artist.findById(artistId);
  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
  }

  // Create Stripe payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100, // in cents
    currency: 'usd',
    metadata: { artistId, fanId: decoded.userId },
  });

  const donation = new Donation({
    fan: decoded.userId,
    artist: artistId,
    amount,
    message,
    paymentId: paymentIntent.id,
  });

  await donation.save();

  // Update artist's earnings
  artist.totalEarnings += amount;
  artist.totalSupporters += 1; // simplistic
  await artist.save();

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}