import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from 'src/domain/user/user.service';
import { CreateUserBrowsingHistoryDto } from './dto/create-user-browsing-history.dto';
import { UserBrowsingHistory } from './entities/user-browsing-history.entity';

@Injectable()
export class SysService {
  constructor(
    @InjectRepository(UserBrowsingHistory)
    private readonly userBrowsingHistoryRepository: Repository<UserBrowsingHistory>,
    private readonly userService: UserService,
  ) {}

  async createUserBrowsingHistory(
    email: string,
    payload: CreateUserBrowsingHistoryDto,
    userIp?: string | null,
  ) {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const record = this.userBrowsingHistoryRepository.create({
      user_id: user.user_id,
      page_url: payload.pageUrl,
      device: payload.device ?? null,
      user_ip: userIp ?? null,
    });

    const saved = await this.userBrowsingHistoryRepository.save(record);

    return {
      message: 'User browsing history created successfully',
      data: saved,
    };
  }
}
