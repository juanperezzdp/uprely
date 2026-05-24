import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({
    enum: Plan,
    example: Plan.PRO,
  })
  @IsEnum(Plan)
  plan!: Plan;
}
