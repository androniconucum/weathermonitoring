import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

// Define how your weather data should look
const WeatherDataSchema = new mongoose.Schema({
  rainAnalog: Number,
  rainDigital: Number,
  lightValue: Number,
  lightPercentage: Number,
  timestamp: { type: Date, default: Date.now }
});

// Initialize the MongoDB model
let WeatherData: any;
try {
  WeatherData = mongoose.model('WeatherData');
} catch {
  WeatherData = mongoose.model('WeatherData', WeatherDataSchema);
}

// Function to connect to MongoDB
async function connectDB() {
  try {
    if (mongoose.connections[0].readyState) return;
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// GET handler - Retrieves weather data
export async function GET() {
  await connectDB();
  
  try {
    const data = await WeatherData.find()
      .sort({ timestamp: -1 })
      .limit(10);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

// POST handler - Saves new weather data
export async function POST(request: Request) {
  await connectDB();
  
  try {
    const body = await request.json();
    const weatherData = new WeatherData(body);
    await weatherData.save();
    return NextResponse.json(weatherData, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save data' },
      { status: 500 }
    );
  }
}
