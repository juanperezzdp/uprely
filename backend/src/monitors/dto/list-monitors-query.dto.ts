import { ApiPropertyOptional } from '@nestjs/swagger';
import { MonitorType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../users/dto/pagination-query.dto';

export class ListMonitorsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: MonitorType,
  })
  @IsOptional()
  @IsEnum(MonitorType)
  type?: MonitorType;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
