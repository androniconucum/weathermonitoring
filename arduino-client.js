const SerialPort = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fetch = require('node-fetch');

// Replace with your Vercel deployment URL
const VERCEL_URL = 'https://your-project-name.vercel.app/api/weather';

async function connectToArduino() {
  try {
    const ports = await SerialPort.list();
    const arduinoPort = ports.find(port => 
      port.manufacturer?.toLowerCase().includes('arduino') ||
      port.manufacturer?.toLowerCase().includes('wch.cn')
    );

    if (!arduinoPort) {
      console.error('No Arduino found');
      return null;
    }

    const serialPort = new SerialPort({
      path: arduinoPort.path,
      baudRate: 9600
    });

    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', async (data) => {
      try {
        const parsedData = JSON.parse(data.trim());
        parsedData.timestamp = new Date().toISOString();

        // Send data to your Vercel API
        const response = await fetch(VERCEL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(parsedData)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('Data sent successfully:', parsedData);
      } catch (error) {
        console.error('Error sending data:', error);
      }
    });

    return parser;
  } catch (error) {
    console.error('Arduino connection error:', error);
    return null;
  }
}

// Start the Arduino connection
connectToArduino();