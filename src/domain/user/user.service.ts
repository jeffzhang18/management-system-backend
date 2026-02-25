import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { ConflictException } from '@nestjs/common';


@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  async createUser(email: string, nickName: string, password: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }
  
    const hash = await bcrypt.hash(password, 10);
  
    const user = this.userRepository.create({
      email,
      nick_name: nickName,
      password: hash,
      role: ['user'], // 默认角色
    });
  
    return this.userRepository.save(user);
  }
}
