import { BadRequestException, Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { PrintingService, PrintingConfigDto } from './printing.service';

@Controller('printing')
export class PrintingController {
  constructor(private readonly printingService: PrintingService) {}

  @Get('config')
  async getPrintingConfig(
    @Req() req: Request,
    @Query('branchId') branchId?: string,
  ): Promise<PrintingConfigDto> {
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    const clientId = req['clientId'];
    return await this.printingService.getBranchPrintingConfig(clientId, branchId);
  }

  @Get('poll')
  async poll(
    @Req() req: Request,
    @Query('branchId') branchId?: string,
    @Query('sinceCreatedAt') sinceCreatedAt?: string,
    @Query('limit') limit: string = '50',
  ) {
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    const clientId = req['clientId'];
    return await this.printingService.pollForPrinting(clientId, branchId, sinceCreatedAt, Number(limit) || 50);
  }

  @Post('reprint')
  async reprint(
    @Req() req: Request,
    @Body('branchId') branchId: string,
    @Body('orderId') orderId: string,
  ) {
    if (!branchId) throw new BadRequestException('branchId is required');
    if (!orderId) throw new BadRequestException('orderId is required');
    const clientId = req['clientId'];
    return await this.printingService.createReprintJob(clientId, branchId, orderId);
  }

  @Post('ack')
  async ack(
    @Req() req: Request,
    @Body('jobId') jobId: string,
    @Body('status') status: 'printed' | 'failed',
    @Body('errorMessage') errorMessage?: string,
  ) {
    const clientId = req['clientId'];
    return await this.printingService.ackPrintJob(clientId, jobId, status, errorMessage);
  }
}


