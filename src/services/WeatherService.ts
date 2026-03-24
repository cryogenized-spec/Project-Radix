import { getSetting } from '../lib/db';
import { decryptApiKey } from '../lib/apiKeyCrypto';

export class WeatherService {
  private static readonly BASE_URL = 'https://api.openweathermap.org/data/2.5';

  static async getCoordinates(city: string): Promise<{ lat: number; lon: number } | null> {
    const encryptedKey = await getSetting('openWeatherApiKey');
    if (!encryptedKey) throw new Error('OpenWeatherMap API key not configured.');
    const apiKey = await decryptApiKey(encryptedKey);

    const response = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`);
    if (!response.ok) throw new Error('Failed to fetch coordinates');
    
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: data[0].lat, lon: data[0].lon };
    }
    return null;
  }

  static async getForecast(lat: number, lon: number, type: 'today' | 'tomorrow' | 'weekly'): Promise<any> {
    const encryptedKey = await getSetting('openWeatherApiKey');
    if (!encryptedKey) throw new Error('OpenWeatherMap API key not configured.');
    const apiKey = await decryptApiKey(encryptedKey);

    // Using One Call API 3.0
    const response = await fetch(`${this.BASE_URL}/onecall?lat=${lat}&lon=${lon}&exclude=minutely,alerts&units=metric&appid=${apiKey}`);
    
    if (!response.ok) {
        // Fallback to standard forecast if One Call is not available (often requires subscription)
        if (type === 'weekly') {
             const fallback = await fetch(`${this.BASE_URL}/forecast/daily?lat=${lat}&lon=${lon}&cnt=7&units=metric&appid=${apiKey}`);
             if (fallback.ok) return fallback.json();
        }
        const fallbackHourly = await fetch(`${this.BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
        if (!fallbackHourly.ok) throw new Error('Failed to fetch weather data');
        return fallbackHourly.json();
    }
    
    return response.json();
  }
}
