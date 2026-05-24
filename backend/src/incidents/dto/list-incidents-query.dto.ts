import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../users/dto/pagination-query.dto';

export enum IncidentStatusFilter {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

export class ListIncidentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: IncidentStatusFilter,
  })
  @IsOptional()
  @IsEnum(IncidentStatusFilter)
  status?: IncidentStatusFilter;

  @ApiPropertyOptional({
    example: '2026-05-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-05-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: '7f9d9c77-31d4-4b74-b0d2-d60b4bcbe3d0',
  })
  @IsOptional()
  @IsUUID()
  monitorId?: string;
}
