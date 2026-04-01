import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'user_weather_location' })
export class UserWeatherLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  user_id: string;

  @Column({ nullable: true })
  location_id: string;

  @Column({ nullable: true, default: true })
  is_non_deleted: boolean;

  @Column({ nullable: true })
  country: string;

  @Column({ name: 'name', nullable: true })
  name: string;

  @Column({ nullable: true })
  adm1: string;
}
