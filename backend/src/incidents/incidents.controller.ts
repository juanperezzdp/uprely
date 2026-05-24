import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { IncidentsService } from './incidents.service';

@ApiTags('Incidents')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Paginated list of incidents filtered by status and date range',
  })
  @ApiOperation({
    summary: 'List incidents with pagination and filters',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListIncidentsQueryDto,
  ) {
    return this.incidentsService.listIncidents(user, query);
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Get an incident by id',
  })
  @ApiOperation({
    summary: 'Get an incident by id',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.incidentsService.getIncidentById(user, id);
  }
}
