import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { User } from './user.entity';
import { ConflictException } from '@nestjs/common';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

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

  async createUser(email: string, userName: string, password: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const hash = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      email,
      user_id: randomUUID(),
      user_name: userName,
      password: hash,
      role: ['user'], // 默认角色
    });

    return this.userRepository.save(user);
  }

  async updateProfileByEmail(email: string, payload: UpdateUserProfileDto) {
    const user = await this.findByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (payload.name !== undefined) {
      user.name = payload.name;
    }
    if (payload.userName !== undefined) {
      user.user_name = payload.userName;
    }
    if (payload.gender !== undefined) {
      user.gender = payload.gender;
    }
    if (payload.avatar !== undefined) {
      user.avatar = payload.avatar;
    }
    if (payload.language !== undefined) {
      user.language = payload.language;
    }
    if (payload.country !== undefined) {
      user.country = payload.country;
    }
    if (payload.city !== undefined) {
      user.city = payload.city;
    }
    if (payload.contact !== undefined) {
      user.contact = payload.contact;
    }
    if (payload.about !== undefined) {
      user.about = payload.about;
    }

    const saved = await this.userRepository.save(user);
    const { password, ...safeUser } = saved;

    return {
      message: 'Profile updated successfully',
      data: safeUser,
    };
  }
}
