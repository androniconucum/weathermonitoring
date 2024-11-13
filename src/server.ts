import express from 'express';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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

// Serial Port Configuration
const serialPort = new SerialPort({ 
  path: 'COM5', // Change this to match your Arduino port
  baudRate: 9600 
});

const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

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
    console.error('Error parsing data:', error);
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
    console.error('Error processing data:', error);
  }
});

// API Routes
app.get('/api/weather/latest', async (req, res) => {
  try {
    const latestData = await WeatherData.findOne().sort({ timestamp: -1 });
    res.json(latestData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/weather/history', async (req, res) => {
  try {
    const history = await WeatherData.find()
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});