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
  Put,
  Query,
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
import { AlertsService } from './alerts.service';
import { CreateAlertContactDto } from './dto/create-alert-contact.dto';
import { UpdateAlertContactDto } from './dto/update-alert-contact.dto';

@ApiTags('Alert Contacts')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('alert-contacts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Paginated list of alert contacts for the authenticated user',
  })
  @ApiOperation({
    summary: 'List alert contacts',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.alertsService.listAlertContacts(user, pagination);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Create an alert contact',
  })
  @ApiOperation({
    summary: 'Create an alert contact',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAlertContactDto,
  ) {
    return this.alertsService.createAlertContact(user, dto);
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Get an alert contact by id',
  })
  @ApiOperation({
    summary: 'Get an alert contact by id',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.alertsService.getAlertContact(user, id);
  }

  @Put(':id')
  @ApiOkResponse({
    description: 'Update an alert contact',
  })
  @ApiOperation({
    summary: 'Update an alert contact',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAlertContactDto,
  ) {
    return this.alertsService.updateAlertContact(user, id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({
    description: 'Delete an alert contact',
  })
  @ApiOperation({
    summary: 'Delete an alert contact',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.alertsService.deleteAlertContact(user, id);
  }
}
