import { Injectable, HttpException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserWeatherLocation } from './entities/user-weather-location.entity';
import { UserService } from 'src/domain/user/user.service';

@Injectable()
export class WeatherService {
  private readonly host: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UserWeatherLocation)
    private readonly userWeatherLocationRepository: Repository<UserWeatherLocation>,
    private readonly userService: UserService,
  ) {
    this.host = this.configService.get<string>('QWEATHER_HOST')!;
    this.apiKey = this.configService.get<string>('QWEATHER_TOKEN')!;
  }

  async saveUserLocation(email: string, locationId: string) {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.userWeatherLocationRepository.findOne({
      where: {
        user_id: user.user_id,
        location_id: locationId,
      },
    });

    if (existing) {
      existing.is_non_deleted = true;
      const saved = await this.userWeatherLocationRepository.save(existing);
      return {
        message: 'Location saved successfully',
        data: saved,
      };
    }

    const record = this.userWeatherLocationRepository.create({
      user_id: user.user_id,
      location_id: locationId,
      is_non_deleted: true,
    });

    const saved = await this.userWeatherLocationRepository.save(record);

    return {
      message: 'Location saved successfully',
      data: saved,
    };
  }

  async getSavedLocationsByUserId(userId: string) {
    const records = await this.userWeatherLocationRepository.find({
      where: {
        user_id: userId,
        is_non_deleted: true,
      },
      order: {
        id: 'DESC',
      },
    });

    return {
      message: 'Saved locations fetched successfully',
      data: records.map((record) => record.location_id),
    };
  }

  async removeSavedLocation(userId: string, locationId: string) {
    const record = await this.userWeatherLocationRepository.findOne({
      where: {
        user_id: userId,
        location_id: locationId,
        is_non_deleted: true,
      },
      order: {
        id: 'DESC',
      },
    });

    if (!record) {
      throw new NotFoundException('Saved location not found');
    }

    record.is_non_deleted = false;
    const saved = await this.userWeatherLocationRepository.save(record);

    return {
      message: 'Saved location removed successfully',
      data: saved,
    };
  }

  async getNow(location: string, lang?: string, unit?: 'm' | 'i') {
    try {
      const url = `https://${this.host}/v7/weather/now`;

      const res = await axios.get(url, {
        params: { location, lang, unit },
        headers: {
          'X-QW-Api-Key': this.apiKey,
        },
      });

      return res.data;
    } catch (error) {
      throw new HttpException('Failed to fetch weather data', 502);
    }
  }

  async getLocation(location: string) {
    try {
      const url = `https://${this.host}/geo/v2/city/lookup`;
      const res = await axios.get(url, {
        params: { location },
        headers: {
          'X-QW-Api-Key': this.apiKey,
        },
      });
      return res.data;
    } catch (error) {
      throw new HttpException('Failed to fetch weather data', 502);
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
  async getHoursPrediction(locationId: string, hours: '24h' | '72h' | '168h') {
    try {
      const url = `https://${this.host}/v7/weather/${hours}`;
      const res = await axios.get(url, {
        params: { location: locationId },
        headers: {
          'X-QW-Api-key': this.apiKey,
        },
      });
      return res.data;
    } catch (error) {
      throw new HttpException('Failed to fetch weather data', 502);
    }
  }
}
