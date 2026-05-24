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
import { CreateStatusPageDto } from './dto/create-status-page.dto';
import { UpdateStatusPageDto } from './dto/update-status-page.dto';
import { StatusPagesService } from './status-pages.service';

@ApiTags('Status Pages')
@Controller('status-pages')
export class StatusPagesController {
  constructor(private readonly statusPagesService: StatusPagesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Paginated list of status pages for the authenticated user',
  })
  @ApiOperation({
    summary: 'List status pages',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.statusPagesService.listStatusPages(user, pagination);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Create a status page',
  })
  @ApiOperation({
    summary: 'Create a status page',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStatusPageDto,
  ) {
    return this.statusPagesService.createStatusPage(user, dto);
  }

  @Get('manage/:id')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Get a status page by id for management',
  })
  @ApiOperation({
    summary: 'Get a status page by id for management',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.statusPagesService.getStatusPage(user, id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Update a status page',
  })
  @ApiOperation({
    summary: 'Update a status page',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStatusPageDto,
  ) {
    return this.statusPagesService.updateStatusPage(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Delete a status page',
  })
  @ApiOperation({
    summary: 'Delete a status page',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.statusPagesService.deleteStatusPage(user, id);
  }

  @Get(':slug')
  @ApiOkResponse({
    description: 'Public status page view by slug',
  })
  @ApiOperation({
    summary: 'Get a public status page by slug',
  })
  findPublic(@Param('slug') slug: string) {
    return this.statusPagesService.getPublicStatusPage(slug);
  }
}
