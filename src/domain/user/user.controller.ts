import { Body, Controller, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { User as UserDecorator } from 'src/common/decorators/user.decorator';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserService } from './user.service';

@ApiTags('User')
@ApiBearerAuth('access-token')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiBody({ type: UpdateUserProfileDto })
  @Patch('profile')
  updateProfile(
    @UserDecorator('email') email: string,
    @Body() body: UpdateUserProfileDto,
  ) {
    return this.userService.updateProfileByEmail(email, body);
  }
}
