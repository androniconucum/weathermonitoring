// src/app/api/weather/route.ts
import { NextResponse } from 'next/server';
import mongoose, { Model, Document } from 'mongoose';

// Define interface for weather data
interface IWeatherData extends Document {
  rainAnalog: number;
  rainDigital: number;
  lightValue: number;
  lightPercentage: number;
  timestamp: Date;
}

// Define the schema with types
const WeatherDataSchema = new mongoose.Schema<IWeatherData>({
  rainAnalog: { type: Number, required: true },
  rainDigital: { type: Number, required: true },
  lightValue: { type: Number, required: true },
  lightPercentage: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Define model with proper typing
let WeatherData: Model<IWeatherData>;

try {
  // Try to get existing model
  WeatherData = mongoose.model<IWeatherData>('WeatherData');
} catch {
  // Create new model if it doesn't exist
  WeatherData = mongoose.model<IWeatherData>('WeatherData', WeatherDataSchema);
}

// MongoDB connection function
async function connectDB() {
  try {
    if (mongoose.connections[0].readyState) return;
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// GET handler
export async function GET() {
    await connectDB();
    
    try {
      const data = await WeatherData.find()
        .sort({ timestamp: -1 })
        .limit(10);
      return NextResponse.json(data);
    } catch (error) {
      console.error('Failed to fetch data:', error); // Log the error
      return NextResponse.json(
        { error: 'Failed to fetch data' },
        { status: 500 }
      );
    }
  }
  
  // POST handler with type checking
  export async function POST(request: Request) {
    await connectDB();
    
    try {
      const body = await request.json();
      
      // Validate required fields
      const requiredFields = ['rainAnalog', 'rainDigital', 'lightValue', 'lightPercentage'];
      const missingFields = requiredFields.filter(field => !(field in body));
      
      if (missingFields.length > 0) {
        return NextResponse.json(
          { error: `Missing required fields: ${missingFields.join(', ')}` },
          { status: 400 }
        );
      }
  
      const weatherData = new WeatherData({
        rainAnalog: body.rainAnalog,
        rainDigital: body.rainDigital,
        lightValue: body.lightValue,
        lightPercentage: body.lightPercentage,
        timestamp: new Date()
      });
  
      await weatherData.save();
      return NextResponse.json(weatherData, { status: 201 });
    } catch (error) {
      console.error('Error saving data:', error); // Log the error
      return NextResponse.json(
        { error: 'Failed to save data' },
        { status: 500 }
      );
    }
  }
  