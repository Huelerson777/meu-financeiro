import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  /** Opcional: quando ausente, o backend usa o cookie httpOnly. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
