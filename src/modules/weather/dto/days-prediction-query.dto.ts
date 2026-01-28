export class DaysPredictionQueryDto {
    location: string;
    days: '3d' | '7d' | '10d' | '15d' | '30d';
  }
  