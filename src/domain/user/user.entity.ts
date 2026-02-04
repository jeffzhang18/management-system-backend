import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'user_info' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  nick_name: string;

  @Column({ type: 'int', nullable: true })
  gender: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; // bcrypt hash

  @Column({ type: 'json', nullable: true })
  role: string[];
}
