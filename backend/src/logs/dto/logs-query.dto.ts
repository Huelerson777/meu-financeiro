import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class LogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por prefixo da ação, ex.: "transactions." pega create/update/delete de transações',
    example: 'transactions.',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Data inicial (ISO), inclusive' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Data final (ISO), inclusive' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
