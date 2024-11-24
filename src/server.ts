import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serial Port Configuration
const serialPort = new SerialPort({
  path: 'COM5', // Update this with your Arduino port
  baudRate: 9600
});

const parser = new ReadlineParser();
serialPort.pipe(parser);

// Error handling for serial port
serialPort.on('error', (error) => {
  if (error instanceof Error) {
    console.error('Serial Port Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  } else {
    console.error('Unknown Serial Port Error:', error);
  }
});

// MongoDB Schema
const WeatherDataSchema = new mongoose.Schema({
  rainAnalog: Number,
  rainDigital: Number,
  isRaining: Boolean,
  lightReading: String,
  lightPercentage: Number,
  timestamp: { type: Date, default: Date.now }
});

const WeatherData = mongoose.model('WeatherData', WeatherDataSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI as string)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Parse Arduino data
function parseArduinoData(data: string) {
  try {
    // Parse rain sensor data
    const rainMatch = data.match(/Rain Sensor - Analog Value: (\d+)\s+Digital Value: (\d+)/);
    const lightMatch = data.match(/Light Sensor - Reading: (\w+)\s+Light Level: ([\d.]+)%/);
    
    if (rainMatch && lightMatch) {
      return {
        rainAnalog: parseInt(rainMatch[1]),
        rainDigital: parseInt(rainMatch[2]),
        isRaining: rainMatch[2] === '0', // Digital value 0 means rain detected
        lightReading: lightMatch[1],
        lightPercentage: parseFloat(lightMatch[2])
      };
    }
    return null;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error parsing Arduino data:', {
        message: error.message,
        data: data,
        stack: error.stack
      });
    } else {
      console.error('Unknown error parsing Arduino data:', error);
    }
    return null;
  }
}

// Handle serial port data
parser.on('data', async (data: string) => {
  try {
    console.log('Raw data:', data); // Debug log
    const parsedData = parseArduinoData(data);
    
    if (parsedData) {
      const weatherData = new WeatherData(parsedData);
      await weatherData.save();
      console.log('Data saved:', parsedData);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error processing serial port data:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('Unknown error processing serial port data:', error);
    }
  }
});

// API Routes
app.get('/api/weather/latest', async (req, res) => {
  try {
    const latestData = await WeatherData.findOne().sort({ timestamp: -1 });
    res.json(latestData);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error fetching latest weather data:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ 
        error: 'Failed to fetch data',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('Unknown error fetching latest weather data:', error);
      res.status(500).json({ 
        error: 'Failed to fetch data',
        message: 'An unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  }
});

app.get('/api/weather/history', async (req, res) => {
  try {
    const history = await WeatherData.find()
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(history);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error fetching weather history:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ 
        error: 'Failed to fetch history',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('Unknown error fetching weather history:', error);
      res.status(500).json({ 
        error: 'Failed to fetch history',
        message: 'An unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});