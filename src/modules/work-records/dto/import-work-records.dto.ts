import { ApiProperty } from '@nestjs/swagger';
import { CreateWorkRecordDto } from './create-work-record.dto';

export class ImportWorkRecordsDto {
  @ApiProperty({
    description: '待导入的记录数组',
    type: [CreateWorkRecordDto],
  })
  records: CreateWorkRecordDto[];
}
