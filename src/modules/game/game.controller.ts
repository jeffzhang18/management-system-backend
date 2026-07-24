import { Controller, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { GameService } from './game.service';

@ApiTags('game')
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Public()
  @ApiOperation({
    summary: '小游戏抽卡',
    description:
      '执行一次抽卡，更新主角属性、经验、等级和阶段，并返回抽卡结果。该接口不包含企微推送能力。',
  })
  @ApiQuery({
    name: 'characterId',
    required: false,
    description:
      '指定主角 character_id；不传则使用第一条角色，没有角色时自动创建。',
    example: 1,
  })
  @ApiQuery({
    name: 'lucky',
    required: false,
    description:
      '测试用：true 强制幸运日，false 强制普通日；不传则按 20% 概率随机。',
    example: true,
  })
  @Post('draw')
  draw(
    @Query('characterId') characterId?: string,
    @Query('lucky') lucky?: string,
  ) {
    return this.gameService.drawCard({
      characterId: characterId ? Number(characterId) : undefined,
      forceLucky:
        lucky === undefined
          ? undefined
          : lucky === 'true' || lucky === '1' || lucky === 'yes',
    });
  }
}
