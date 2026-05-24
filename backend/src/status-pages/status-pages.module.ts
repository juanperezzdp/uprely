import { Module } from '@nestjs/common';
import { MonitorsModule } from '../monitors/monitors.module';
import { StatusPagesController } from './status-pages.controller';
import { StatusPagesService } from './status-pages.service';
import { StatusPagesRepository } from './repositories/status-pages.repository';

@Module({
  imports: [MonitorsModule],
  controllers: [StatusPagesController],
  providers: [StatusPagesRepository, StatusPagesService],
  exports: [StatusPagesService],
})
export class StatusPagesModule {}
