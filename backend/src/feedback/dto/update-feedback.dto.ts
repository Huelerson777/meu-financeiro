import { ApiProperty } from '@nestjs/swagger';
import { FeedbackStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateFeedbackDto {
  @ApiProperty({ enum: FeedbackStatus })
  @IsEnum(FeedbackStatus)
  status!: FeedbackStatus;
}
