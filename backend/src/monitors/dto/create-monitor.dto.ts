import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MonitorType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMonitorDto {
  @ApiProperty({
    example: 'API Principal',
  })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    enum: MonitorType,
    example: MonitorType.HTTP,
  })
  @IsEnum(MonitorType)
  type!: MonitorType;

  @ApiPropertyOptional({
    example: 'https://api.uptimewatch.dev/health',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @ApiProperty({
    example: 300,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  intervalSeconds!: number;

  @ApiPropertyOptional({
    example: 10000,
    minimum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(120000)
  timeoutMs?: number;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'ok',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  keywordExpected?: string;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  keywordMustExist?: boolean;

  @ApiPropertyOptional({
    example: 2,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  consecutiveFailuresThreshold?: number;
}
