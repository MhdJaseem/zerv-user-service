import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { HttpClientService } from '../../common/inter-service-communication/http-client.service';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { PrintJobStatus } from '../../common/repository/entities/print-job.entity';

export interface PrintingConfigDto {
  branchId: string;
  autoPrint: boolean;
  printerHost: string | null;
  printerPort: number;
  pollIntervalSec: number;
  printerPaperIn: 2 | 3;
  updatedAt?: string;
}

@Injectable()
export class PrintingService {
  constructor(
    private readonly httpClientService: HttpClientService,
    private readonly db: IMongoDBServices,
  ) {}

  async getBranchPrintingConfig(clientId: string, branchId: string): Promise<PrintingConfigDto> {
    // Fetch full branch from MENU_SERVICE (support both {result} and direct payload shapes)
    const resp: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${branchId}`);
    const branch = (resp && typeof resp === 'object' && 'result' in resp) ? resp.result : resp;

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }

    // Tenant safety: ensure the branch belongs to this clientId
    if (branch.restaurantId && clientId && branch.restaurantId !== clientId) {
      throw new ForbiddenException('Branch does not belong to this tenant');
    }

    // Map only the printing fields. Use safe defaults if absent.
    const config: PrintingConfigDto = {
      branchId: branchId,
      autoPrint: Boolean(branch.autoPrint) || false,
      printerHost: branch.printerHost || null,
      printerPort: typeof branch.printerPort === 'number' ? branch.printerPort : 9100,
      pollIntervalSec: typeof branch.pollIntervalSec === 'number' ? branch.pollIntervalSec : 30,
      printerPaperIn: branch.printerPaperIn === 2 ? 2 : 3,
      updatedAt: branch.updatedAt || branch.modifiedAt || branch.createdAt,
    };

    return config;
  }

  async pollForPrinting(clientId: string, branchId: string, sinceCreatedAt?: string, limit: number = 50) {
    // Validate branch ownership (reuse printing-config branch fetch)
    const resp: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${branchId}`);
    const branch = (resp && typeof resp === 'object' && 'result' in resp) ? resp.result : resp;

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }
    if (branch.restaurantId && clientId && branch.restaurantId !== clientId) {
      throw new ForbiddenException('Branch does not belong to this tenant');
    }

    // Build filter for orders: this endpoint is a lightweight aggregator, not exposing DB directly
    const baseFilter: any = {
      branchId,
      orderStatus: { $ne: 'pending' },
    };
    if (sinceCreatedAt) {
      // Use $and to avoid normalization in orders service that overwrites top-level createdAt
      baseFilter.$and = [{ createdAt: { $gt: sinceCreatedAt } }];
    }

    // Call existing orders endpoint via HttpClientService (keeps one source of truth)
    const ordersResp: any = await this.httpClientService.get('USER_SERVICE', `/orders`, {
      filter: JSON.stringify(baseFilter),
      limit,
    }, true);

    const raw = (ordersResp && ordersResp.result) ? ordersResp.result : ordersResp; // shape guard
    const items = raw?.items || [];

    // Map to minimal shape required by printer app to keep payload light
    const newOrders = items.map((o: any) => ({
      orderId: o?.orderId,
      createdAt: o?.createdAt,
      orderStatus: o?.orderStatus,
      orderType: o?.orderType,
      includeUtensils: o?.includeUtensils,
      customerInfo: o?.customerInfo || {},
      items: o?.items || [],
      specialInstruction: o?.specialInstruction,
      total: o?.total,
      branchId: o?.branchId,
    }));

    // Fetch queued print jobs for this branch
    const queuedJobs = await this.db.printJob.find({ branchId, status: 'queued' as PrintJobStatus });

    const printJobs = (queuedJobs || []).map(j => ({
      jobId: j['_id'],
      orderId: j['orderId'],
      createdAt: j['createdAt'],
    }));

    return {
      nowIso: new Date().toISOString(),
      newOrders,
      printJobs,
    };
  }

  async createReprintJob(clientId: string, branchId: string, orderId: string) {
    if (!orderId) throw new BadRequestException('orderId is required');
    // Verify branch ownership
    const resp: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${branchId}`);
    const branch = (resp && typeof resp === 'object' && 'result' in resp) ? resp.result : resp;
    if (!branch) throw new NotFoundException(`Branch with ID ${branchId} not found`);
    if (branch.restaurantId && clientId && branch.restaurantId !== clientId) {
      throw new ForbiddenException('Branch does not belong to this tenant');
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const created = await this.db.printJob.create({
      restaurantId: clientId,
      branchId,
      orderId,
      status: 'queued' as PrintJobStatus,
      expiresAt,
    });
    return { jobId: created['_id'] };
  }

  async ackPrintJob(clientId: string, jobId: string, status: 'printed' | 'failed', errorMessage?: string) {
    if (!jobId) throw new BadRequestException('jobId is required');
    if (!status || (status !== 'printed' && status !== 'failed')) {
      throw new BadRequestException('status must be printed|failed');
    }
    const job = await this.db.printJob.findOne({ _id: jobId });
    if (!job) throw new NotFoundException('Job not found');
    // Tenant safety
    if (job['restaurantId'] && job['restaurantId'] !== clientId) {
      throw new ForbiddenException('Job does not belong to this tenant');
    }
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.db.printJob.findOneAndUpdate(
      { _id: jobId },
      { $set: { status, lastError: status === 'failed' ? (errorMessage || '') : undefined, expiresAt } },
      { new: true },
    );
    return { ok: true };
  }
}


