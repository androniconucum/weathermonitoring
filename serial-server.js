const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Add CORS configuration
app.use(cors({
  origin: [
    'https://weathermonitoring-jc38.vercel.app/', // Replace with your actual domain
    'http://localhost:3000' // Keep for local development
  ]
}));

// Declare connectedClients set in a global scope
const connectedClients = new Set();
// Declare serialPort in a global scope
let serialPort;

// Enhanced broadcast function with logging
function broadcast(message) {
  console.log('Broadcasting to', connectedClients.size, 'clients:', message);
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (err) {
        console.error('Error broadcasting to client:', err);
      }
    }
  });
}

async function connectToArduino() {
  try {
    const ports = await SerialPort.list();
    console.log('Available ports:', ports);

    const arduinoPort = ports.find(port => 
      port.manufacturer?.toLowerCase().includes('arduino') ||
      port.manufacturer?.toLowerCase().includes('wch.cn') ||
      port.manufacturer?.toLowerCase().includes('ftdi')
    );

    if (!arduinoPort) {
      console.error('No Arduino found');
      broadcast({ type: 'error', message: 'Arduino not found' });
      return null;
    }

    console.log('Connecting to Arduino on:', arduinoPort.path);
    
    serialPort = new SerialPort({
      path: arduinoPort.path,
      baudRate: 9600,
    });

    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
    
    serialPort.on('open', () => {
      console.log('Serial port opened successfully');
      broadcast({ type: 'status', connected: true });
    });

    parser.on('data', (data) => {
      console.log('Raw data received:', data);
      try {
        const parsedData = JSON.parse(data.trim());
        console.log('Successfully parsed data:', parsedData);
        
        // Validate data structure
        const requiredFields = ['rainAnalog', 'rainDigital', 'lightValue', 'lightPercentage'];
        const hasAllFields = requiredFields.every(field => 
          parsedData.hasOwnProperty(field)
        );

        if (!hasAllFields) {
          throw new Error('Missing required fields');
        }

        parsedData.timestamp = new Date().toISOString();
        console.log('Broadcasting data:', parsedData);
        broadcast({ type: 'data', payload: parsedData });
      } catch (error) {
        console.error('Data parsing error:', error.message, 'Raw data:', data);
        broadcast({ type: 'error', message: 'Invalid data format' });
      }
    });

    return parser;
  } catch (err) {
    console.error('Arduino connection error:', err);
    broadcast({ type: 'error', message: 'Failed to connect to Arduino' });
    return null;
  }
}

// Enhanced WebSocket connection handling
wss.on('connection', async (ws, req) => {
  console.log('New client connected from:', req.socket.remoteAddress);
  connectedClients.add(ws);

  // Send immediate status update
  const status = {
    type: 'status',
    connected: serialPort?.isOpen || false
  };
  console.log('Sending initial status:', status);
  ws.send(JSON.stringify(status));

  if (!serialPort || !serialPort.isOpen) {
    console.log('Attempting to connect to Arduino...');
    await connectToArduino();
  }

  ws.on('close', () => {
    console.log('Client disconnected');
    connectedClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectedClients.delete(ws);
  });
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  connectToArduino();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }
  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});

// Reconnection logic
setInterval(async () => {
  if (!serialPort || !serialPort.isOpen) {
    console.log('Attempting to reconnect to Arduino...');
    await connectToArduino();
  }
}, 10000);
