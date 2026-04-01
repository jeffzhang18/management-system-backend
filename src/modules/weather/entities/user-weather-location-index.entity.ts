import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'user_weather_location_index' })
export class UserWeatherLocationIndex {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, length: 100 })
  user_id: string;

  @Column({ type: 'text', array: true, nullable: true })
  location_list: string[];
}
