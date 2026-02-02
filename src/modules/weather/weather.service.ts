import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WeatherService {
  private readonly host: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.host = this.configService.get<string>('QWEATHER_HOST')!;
    this.apiKey = this.configService.get<string>('QWEATHER_TOKEN')!;
  }

  async getNow(location: string) {
    try {
      const url = `https://${this.host}/v7/weather/now`;

      const res = await axios.get(url, {
        params: { location },
        headers: {
          'X-QW-Api-Key': this.apiKey,
        },
      });

      return res.data;
    } catch (error) {
      throw new HttpException(
        'Failed to fetch weather data',
        502,
      );
    }
  }

  async getLocation(location: string) {
    try {
      const url = `https://${this.host}/geo/v2/city/lookup`;
      const res = await axios.get(url, {
          params:{location},
          headers:{
              'X-QW-Api-Key': this.apiKey
          }
      })
      return res.data
    } catch (error) {
        throw new HttpException(
          'Failed to fetch weather data',
          502,
        );
      }
  }

  async getDaysPrediction(
    locationId: string,
    days: '3d' | '7d' | '10d' | '15d' | '30d',
  ) {
    try {
      const url = `https://${this.host}/v7/weather/${days}`;
  
      const res = await axios.get(url, {
        params: { location: locationId },
        headers: {
          'X-QW-Api-Key': this.apiKey,
        },
      });
  
      return res.data;
    } catch (error) {
      throw new HttpException('Failed to fetch weather data', 502);
    }
  }
  async getHoursPrediction(
    locationId: string,
    hours: '24h'|'72h'|'168h'
  ) {
    try {
      const url = `https://${this.host}/v7/weather/${hours}`
      const res = await axios.get(url, {
        params:{location: locationId},
        headers:{
          'X-QW-Api-key': this.apiKey,
        }
      });
      return res.data
    } catch (error) {
      throw new HttpException('Failed to fetch weather data', 502);
    }
  }
  
}
