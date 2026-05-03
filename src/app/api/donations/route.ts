import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Donation from '@/lib/models/Donation';
import Artist from '@/lib/models/Artist';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID!;
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY!;
const PAYFAST_RETURN_URL = process.env.PAYFAST_RETURN_URL!;
const PAYFAST_CANCEL_URL = process.env.PAYFAST_CANCEL_URL!;
const PAYFAST_NOTIFY_URL = process.env.PAYFAST_NOTIFY_URL!;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';
const PAYFAST_URL = process.env.PAYFAST_SANDBOX === 'true'
  ? 'https://sandbox.payfast.co.za/eng/process'
  : 'https://www.payfast.co.za/eng/process';

function createPayfastSignature(data: Record<string, string>) {
  const ordered = Object.keys(data)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');

  const stringToHash = PAYFAST_PASSPHRASE
    ? `${ordered}&passphrase=${encodeURIComponent(PAYFAST_PASSPHRASE)}`
    : ordered;

  return createHash('md5').update(stringToHash).digest('hex');
}

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
  const parsedAmount = Number(amount);

  if (!artistId || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
  }

  const artist = await Artist.findById(artistId);
  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
  }

  const donation = new Donation({
    fan: decoded.userId,
    artist: artistId,
    amount: parsedAmount,
    currency: 'ZAR',
    message,
    paymentId: '',
  });

  await donation.save();

  const paymentData: Record<string, string> = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    return_url: PAYFAST_RETURN_URL,
    cancel_url: PAYFAST_CANCEL_URL,
    notify_url: PAYFAST_NOTIFY_URL,
    amount: parsedAmount.toFixed(2),
    item_name: `Donation to ${artist.name}`,
    item_description: message || `Support ${artist.name}`,
    m_payment_id: donation._id.toString(),
    custom_str1: artistId,
    custom_str2: decoded.userId,
  };

  const signature = createPayfastSignature(paymentData);
  const redirectUrl = `${PAYFAST_URL}?${new URLSearchParams({
    ...paymentData,
    signature,
  }).toString()}`;

  artist.totalEarnings += parsedAmount;
  artist.totalSupporters += 1;
  await artist.save();

  return NextResponse.json({ redirectUrl });
}