import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl, Matches, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Número do WhatsApp em formato internacional, só dígitos (ex: 5548999999999)' })
  @IsOptional()
  @Matches(/^\d{10,15}$/, { message: 'whatsappNumber deve conter só dígitos com DDI e DDD, ex: 5548999999999' })
  whatsappNumber?: string;
}
