import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginationQueryDto } from '../users/dto/pagination-query.dto';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { ListMonitorsQueryDto } from './dto/list-monitors-query.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';
import { MonitorsService } from './monitors.service';

@ApiTags('Monitors')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('monitors')
export class MonitorsController {
  constructor(private readonly monitorsService: MonitorsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Paginated list of monitors for the authenticated user',
  })
  @ApiOperation({
    summary: 'List monitors with pagination',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMonitorsQueryDto,
  ) {
    return this.monitorsService.listMonitors(user, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Create a monitor',
  })
  @ApiOperation({
    summary: 'Create a monitor',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createMonitorDto: CreateMonitorDto,
  ) {
    return this.monitorsService.createMonitor(user, createMonitorDto);
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Get a monitor by id',
  })
  @ApiOperation({
    summary: 'Get a monitor by id',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.monitorsService.getMonitor(user, id);
  }

  @Put(':id')
  @ApiOkResponse({
    description: 'Update a monitor',
  })
  @ApiOperation({
    summary: 'Update a monitor',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateMonitorDto: UpdateMonitorDto,
  ) {
    return this.monitorsService.updateMonitor(user, id, updateMonitorDto);
  }

  @Post(':id/restart')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({
    description: 'Queue an immediate check for the monitor',
  })
  @ApiOperation({
    summary: 'Restart a monitor by queuing an immediate check',
  })
  restart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.monitorsService.restartMonitor(user, id);
  }

  @Delete(':id')
  @ApiOkResponse({
    description: 'Delete a monitor',
  })
  @ApiOperation({
    summary: 'Delete a monitor',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.monitorsService.deleteMonitor(user, id);
  }

  @Get(':id/stats')
  @ApiOkResponse({
    description: 'Get monitor uptime and latency statistics',
  })
  @ApiOperation({
    summary: 'Get monitor statistics',
  })
  getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.monitorsService.getMonitorStats(user, id);
  }

  @Get(':id/checks')
  @ApiOkResponse({
    description: 'Get paginated monitor check results',
  })
  @ApiOperation({
    summary: 'Get monitor checks',
  })
  getChecks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.monitorsService.getMonitorChecks(
      user,
      id,
      pagination.page,
      pagination.limit,
    );
  }

  @Get(':id/incidents')
  @ApiOkResponse({
    description: 'Get paginated monitor incidents',
  })
  @ApiOperation({
    summary: 'Get monitor incidents',
  })
  getIncidents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.monitorsService.getMonitorIncidents(
      user,
      id,
      pagination.page,
      pagination.limit,
    );
  }
}
