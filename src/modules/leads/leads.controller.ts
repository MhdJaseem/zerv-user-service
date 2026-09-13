import { Body, Controller, HttpCode, HttpStatus, Param, Post, Put, Get } from '@nestjs/common';
import { CreateLeadOnboardingDto } from './dto/create.lead.dto';
import { LeadsService } from './leads.service';
import { UpdateLeadOnboardingDto } from './dto/update.lead.dto';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) { }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createLeadOnboarding(@Body() createLeadOnboardingDto: CreateLeadOnboardingDto) {
    return this.leadsService.createLeadOnboarding(createLeadOnboardingDto);
  }

  @Get('/:emailId')
  async getLeadUserByEmailId(@Param('emailId') emailId: string) {
    return this.leadsService.getLeadUserByEmailId(emailId);
  }

  @Put('update/:leadId')
  @HttpCode(HttpStatus.OK)
  async updateLead(@Param('leadId') leadId: string, @Body() updateLeadDto: UpdateLeadOnboardingDto) {
    return this.leadsService.updateLead(leadId, updateLeadDto);
  }

  @Put('activate-trial/:leadId')
  @HttpCode(HttpStatus.OK)
  async activateTrial(@Param('leadId') leadId: string) {
    return this.leadsService.activateTrial(leadId, 7);
  }
}

