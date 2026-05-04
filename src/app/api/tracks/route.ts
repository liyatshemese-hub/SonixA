import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Track from '@/lib/models/Track';
import Artist from '@/lib/models/Artist';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    return NextResponse.json({ error: 'Missing JWT_SECRET' }, { status: 500 });
  }

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

  const artist = await Artist.findOne({ user: decoded.userId });
  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const story = formData.get('story') as string;
  const genre = formData.get('genre') as string;
  const file = formData.get('file') as File;

  if (!title || !file) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Save file locally
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = `${Date.now()}-${file.name}`;
  const filePath = path.join(uploadsDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const audioUrl = `/uploads/${fileName}`;

  const track = new Track({
    artist: artist._id,
    title,
    description,
    audioUrl,
    story,
    genre,
  });

  await track.save();

  return NextResponse.json({ track }, { status: 201 });
}

export async function GET() {
  await dbConnect();

  const tracks = await Track.find().populate('artist').sort({ releaseDate: -1 });

  return NextResponse.json({ tracks });
}