'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Sun, Cloud, Moon, Droplets, Sunrise, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WeatherData {
  rainAnalog: number;
  rainDigital: number;
  lightValue: number;
  lightPercentage: number;
  timestamp?: Date;
}

interface WeatherMetrics {
  lightIntensity: string;
  lightCategory: string;
  rainIntensity: string;
  rainProbability: number;
  lastHourReadings: number[];
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface WebSocketMessage {
  type: 'data' | 'error' | 'status';
  payload?: WeatherData;
  message?: string;
  connected?: boolean;
}

export default function Home() {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [readings, setReadings] = useState<WeatherData[]>([]);
  const [metrics, setMetrics] = useState<WeatherMetrics>({
    lightIntensity: 'Unknown',
    lightCategory: 'Unknown',
    rainIntensity: 'Unknown',
    rainProbability: 0,
    lastHourReadings: [],
    trend: 'stable'
  });

  // Previous calculation functions remain the same
  const calculateMetrics = (data: WeatherData, historicalData: WeatherData[]): WeatherMetrics => {
    // ... (keep existing calculation logic)
    const getLightIntensity = (percentage: number) => {
      if (percentage < 20) return 'Very Dark';
      if (percentage < 40) return 'Dark';
      if (percentage < 60) return 'Moderate';
      if (percentage < 80) return 'Bright';
      return 'Very Bright';
    };

    const getLightCategory = (value: number, percentage: number) => {
      if (value === 0 && percentage > 60) return 'Direct Sunlight';
      if (value === 0) return 'Daylight';
      if (percentage < 30) return 'Night';
      return 'Cloudy';
    };

    const getRainIntensity = (analog: number) => {
      const normalizedValue = (1024 - analog) / 1024 * 100;
      if (normalizedValue < 10) return 'No Rain';
      if (normalizedValue < 30) return 'Light Drizzle';
      if (normalizedValue < 60) return 'Moderate Rain';
      if (normalizedValue < 80) return 'Heavy Rain';
      return 'Intense Rain';
    };

    const calculateRainProbability = (analog: number) => {
      return Math.min(100, Math.max(0, ((1024 - analog) / 1024 * 100)));
    };

    const calculateTrend = (current: number, history: WeatherData[]) => {
      if (history.length < 3) return 'stable';
      const recentValues = history.slice(-3).map(h => h.lightPercentage);
      const average = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
      if (current > average + 5) return 'increasing';
      if (current < average - 5) return 'decreasing';
      return 'stable';
    };

    const lastHourReadings = historicalData
      .slice(-60)
      .map(reading => reading.lightPercentage);

    return {
      lightIntensity: getLightIntensity(data.lightPercentage),
      lightCategory: getLightCategory(data.lightValue, data.lightPercentage),
      rainIntensity: getRainIntensity(data.rainAnalog),
      rainProbability: calculateRainProbability(data.rainAnalog),
      lastHourReadings,
      trend: calculateTrend(data.lightPercentage, historicalData)
    };
  };

  // Replace WebSocket logic with REST API polling
  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        const response = await fetch('/api/weather');
        if (!response.ok) throw new Error('Failed to fetch');
        
        const data = await response.json();
        if (data.length > 0) {
          const latestReading = data[0];
          setWeatherData(latestReading);
          setReadings(data);
          setMetrics(calculateMetrics(latestReading, data));
          setWsStatus('connected');
          setErrorMessage('');
        }
      } catch (error) {
        console.error('Error fetching weather data:', error);
        setWsStatus('error');
        setErrorMessage('Failed to fetch weather data');
      }
    };

    // Fetch immediately and then every 30 seconds
    fetchWeatherData();
    const interval = setInterval(fetchWeatherData, 30000);

    return () => clearInterval(interval);
  }, []);

  const StatusIndicator = () => (
    <div className="flex items-center gap-2 mb-6 p-3 rounded-lg bg-white shadow-sm">
      {wsStatus === 'connected' ? (
        <CheckCircle2 className="h-5 w-5 text-green-500" />
      ) : wsStatus === 'connecting' ? (
        <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
      ) : (
        <AlertCircle className="h-5 w-5 text-red-500" />
      )}
      <span className={`text-sm font-medium ${
        wsStatus === 'connected' ? 'text-green-700' :
        wsStatus === 'connecting' ? 'text-yellow-700' :
        'text-red-700'
      }`}>
        {wsStatus === 'connected' ? 'System Online' :
         wsStatus === 'connecting' ? 'Connecting...' :
         'Connection Error'}
      </span>
      {errorMessage && (
        <span className="text-sm text-red-500 ml-2">- {errorMessage}</span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Weather Monitoring Station</h1>
          <StatusIndicator />
        </div>

        {weatherData && metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Enhanced Rain Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Precipitation Status</CardTitle>
                    <CardDescription>Real-time rain analysis</CardDescription>
                  </div>
                  <Droplets className={`h-8 w-8 ${
                    metrics.rainProbability > 50 ? 'text-blue-500' : 'text-gray-400'
                  }`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-700 font-medium mb-2">Current Conditions</p>
                    <p className="text-2xl font-bold text-blue-900">{metrics.rainIntensity}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-2">Precipitation Probability</p>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div 
                        className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${metrics.rainProbability}%` }}
                      />
                    </div>
                    <p className="text-sm mt-1 text-gray-600">{metrics.rainProbability.toFixed(1)}% chance of rain</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">Sensor Reading</p>
                      <p className="text-lg font-semibold">{weatherData.rainAnalog}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Sensor State</p>
                      <p className={`text-lg font-semibold ${
                        weatherData.rainDigital === 0 ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        {weatherData.rainDigital === 0 ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Light Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Light Conditions</CardTitle>
                    <CardDescription>Ambient light analysis</CardDescription>
                  </div>
                  {metrics.lightCategory === 'Direct Sunlight' ? (
                    <Sunrise className="h-8 w-8 text-yellow-500" />
                  ) : metrics.lightCategory === 'Daylight' ? (
                    <Sun className="h-8 w-8 text-yellow-500" />
                  ) : metrics.lightCategory === 'Cloudy' ? (
                    <Cloud className="h-8 w-8 text-gray-500" />
                  ) : (
                    <Moon className="h-8 w-8 text-blue-900" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-sm text-yellow-700 font-medium mb-2">Current Conditions</p>
                    <p className="text-2xl font-bold text-yellow-900">{metrics.lightCategory}</p>
                    <p className="text-sm text-yellow-600 mt-1">Intensity: {metrics.lightIntensity}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Light Level</p>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div 
                        className="bg-yellow-400 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${weatherData.lightPercentage}%` }}
                      />
                    </div>
                    <p className="text-sm mt-1 text-gray-600">{weatherData.lightPercentage.toFixed(1)}% brightness</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Light Trend</p>
                    <p className={`text-lg font-semibold ${
                      metrics.trend === 'increasing' ? 'text-green-600' :
                      metrics.trend === 'decreasing' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {metrics.trend.charAt(0).toUpperCase() + metrics.trend.slice(1)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {weatherData.timestamp && (
              <div className="md:col-span-2 flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                Last updated: {new Date(weatherData.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-gray-600">Waiting for weather data...</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}