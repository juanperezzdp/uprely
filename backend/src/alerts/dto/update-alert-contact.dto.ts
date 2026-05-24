import { ApiPropertyOptional } from '@nestjs/swagger';
import { AlertContactType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateAlertContactDto {
  @ApiPropertyOptional({
    enum: AlertContactType,
    example: AlertContactType.WEBHOOK,
  })
  @IsOptional()
  @IsEnum(AlertContactType)
  type?: AlertContactType;

  @ApiPropertyOptional({
    example: 'https://example.com/hooks/uptimewatch',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  value?: string;
}
