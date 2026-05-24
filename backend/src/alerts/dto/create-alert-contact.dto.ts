import { ApiProperty } from '@nestjs/swagger';
import { AlertContactType } from '@prisma/client';
import {
  IsEnum,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAlertContactDto {
  @ApiProperty({
    enum: AlertContactType,
    example: AlertContactType.EMAIL,
  })
  @IsEnum(AlertContactType)
  type!: AlertContactType;

  @ApiProperty({
    example: 'alerts@uptimewatch.dev',
  })
  @IsString()
  @MaxLength(2048)
  value!: string;
}
