import { Module } from '@nestjs/common';
import { DBServicesModule } from '../../repository/repository-services.module';
import { ActionLogService } from './actionLog.service';

@Module({
    imports: [DBServicesModule],
    providers: [ActionLogService],
    exports: [ActionLogService],
})
export class ActionLogModule { }