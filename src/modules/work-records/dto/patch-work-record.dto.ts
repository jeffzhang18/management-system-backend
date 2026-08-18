import { PartialType } from '@nestjs/swagger';
import { UpdateWorkRecordDto } from './update-work-record.dto';

export class PatchWorkRecordDto extends PartialType(UpdateWorkRecordDto) {}
