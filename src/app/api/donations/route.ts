import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Donation from '@/lib/models/Donation';
import Artist from '@/lib/models/Artist';
import jwt from 'jsonwebtoken';

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getPayfastConfig() {
  return {
    merchantId: getRequiredEnv('PAYFAST_MERCHANT_ID'),
    merchantKey: getRequiredEnv('PAYFAST_MERCHANT_KEY'),
    returnUrl: getRequiredEnv('PAYFAST_RETURN_URL'),
    cancelUrl: getRequiredEnv('PAYFAST_CANCEL_URL'),
    notifyUrl: getRequiredEnv('PAYFAST_NOTIFY_URL'),
    passphrase: process.env.PAYFAST_PASSPHRASE || '',
    url: process.env.PAYFAST_SANDBOX === 'true'
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process',
  };
}

function createPayfastSignature(data: Record<string, string>, passphrase: string) {
  const ordered = Object.keys(data)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');

  const stringToHash = passphrase
    ? `${ordered}&passphrase=${encodeURIComponent(passphrase)}`
    : ordered;

  return createHash('md5').update(stringToHash).digest('hex');
}

export async function POST(request: NextRequest) {
  const JWT_SECRET = getRequiredEnv('JWT_SECRET');
  const payfast = getPayfastConfig();

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
    merchant_id: payfast.merchantId,
    merchant_key: payfast.merchantKey,
    return_url: payfast.returnUrl,
    cancel_url: payfast.cancelUrl,
    notify_url: payfast.notifyUrl,
    amount: parsedAmount.toFixed(2),
    item_name: `Donation to ${artist.name}`,
    item_description: message || `Support ${artist.name}`,
    m_payment_id: donation._id.toString(),
    custom_str1: artistId,
    custom_str2: decoded.userId,
  };

  const signature = createPayfastSignature(paymentData, payfast.passphrase);
  const redirectUrl = `${payfast.url}?${new URLSearchParams({
    ...paymentData,
    signature,
  }).toString()}`;

  artist.totalEarnings += parsedAmount;
  artist.totalSupporters += 1;
  await artist.save();

  return NextResponse.json({ redirectUrl });
}