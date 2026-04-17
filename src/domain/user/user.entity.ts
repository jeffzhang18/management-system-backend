import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'user_info' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  user_name: string;

  @Column({ type: 'int', nullable: true })
  gender: number;

  @Column({ nullable: true })
  avatar: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  user_id: string;

  @Column()
  password: string; // bcrypt hash

  @Column({ type: 'json', nullable: true })
  role: string[];

  @Column({ nullable: true })
  language: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  contact: string;

  @Column({ nullable: true })
  about: string;

  @Column({ nullable: true })
  city: string;
}
