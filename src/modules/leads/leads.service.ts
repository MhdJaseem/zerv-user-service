import * as momentTz from 'moment-timezone';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';

import { LeadStatus } from '../../common/enums/leads.enum';
import { CreateLeadOnboardingDto } from './dto/create.lead.dto';
import { UpdateLeadOnboardingDto } from './dto/update.lead.dto';
import { ILead } from '../../common/interfaces/leads.interface';
import { IRestaurant } from 'src/common/interfaces/common.interface';
import { ASIA_CALCUTTA_TIMEZONE } from 'src/common/constants/common.constants';
import { AttributeAccess, AttributeNames, AdminRoles } from 'src/common/enums/user.enum';

import { HttpClientService } from '../../common/inter-service-communication/http-client.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly dbServices: IMongoDBServices,
    private readonly httpClientService: HttpClientService,
  ) { }

  private getAbilitiesByRole(role: string): any[] {
    const abilities: any[] = [];
    if (role === AdminRoles.SUPER_ADMIN) {
      for (const attributeName of Object.values(AttributeNames)) {
        abilities.push({ attributeName, attributeAccess: [AttributeAccess.ALL] });
      }
    } else if (role === AdminRoles.ADMIN || role === 'lead') {
      for (const attributeName of Object.values(AttributeNames)) {
        abilities.push({ attributeName, attributeAccess: [AttributeAccess.ALL] });
      }
    }
    return abilities;
  }

  async createLeadOnboarding(createLeadDto: CreateLeadOnboardingDto): Promise<ILead> {
    try {
      const existingLead = await this.dbServices.lead.findOne({ email: createLeadDto.email, isDeleted: { $in: [null, false] } } as any);

      if (existingLead) {
        console.info('Lead already exists we are going to fetch the restaurant details');
        
        // If existing lead has no abilities and has a restaurantId, populate them now
        if (existingLead.restaurantId && (!existingLead.abilities || existingLead.abilities.length === 0)) {
          const role = existingLead.role || 'lead';
          const abilities = this.getAbilitiesByRole(role);
          if (abilities.length > 0) {
            await this.dbServices.lead.findOneAndUpdate({ leadId: existingLead.leadId }, { $set: { abilities } });
            existingLead.abilities = abilities;
          }
        }

        let restaurant: IRestaurant | null = null;
        try {
          restaurant = await this.httpClientService.get<any>('MENU_SERVICE', `/restaurant/${existingLead?.restaurantId}`) as any;
        } catch (error) {
          console.error('Failed to fetch restaurant details: ' + error.message);
          restaurant = null;
        }
        return { ...restaurant, ...existingLead } as ILead;
      }

      const role = createLeadDto.role ?? 'lead';
      let abilities: any[] = createLeadDto.abilities ?? [];

      if (createLeadDto.restaurantId && abilities.length === 0) {
        abilities = this.getAbilitiesByRole(role);
      }

      const createdLead = await this.dbServices.lead.create({
        firstName: createLeadDto.firstName,
        lastName: createLeadDto.lastName,
        email: createLeadDto.email,
        password: createLeadDto.password,
        phoneNumber: createLeadDto.phoneNumber,
        role,
        abilities,
        leadStatus: LeadStatus.PENDING,
        isDeleted: false,
        authProvider: createLeadDto.authProvider ?? 'email',
      } as any);

      return createdLead;
    } catch (error) {
      console.error('Failed to create lead: ' + error.message);
      throw new BadRequestException('Failed to create lead: ' + error.message);
    }
  }

  async activateTrial(leadId: string, trialDays = 7): Promise<ILead> {
    try {
      const lead = await this.dbServices.lead.findOne({ leadId, isDeleted: { $in: [null, false] } } as any);
      if (!lead) {
        throw new NotFoundException('Lead not found');
      }

      if (lead.trialStartAt || lead.trialEndsAt) {
        throw new BadRequestException('Trial is already active for this lead');
      }

      const start = momentTz.tz(new Date(), ASIA_CALCUTTA_TIMEZONE).startOf('day').toDate();
      const end = momentTz.tz(start, ASIA_CALCUTTA_TIMEZONE).add(trialDays, 'days').endOf('day').toDate();

      return await this.dbServices.lead.findOneAndUpdate(
        { leadId },
        { $set: { trialStartAt: start, trialEndsAt: end } } as any,
        { new: true },
      );
    } catch (error) {
      console.error('Failed to activate trial: ' + error.message);
      throw error;
    }
  }

  async getLeadUserByEmailId(emailId: string) {
    try {
      const lead = await this.dbServices.lead.findOne({ email: emailId, isDeleted: { $in: [null, false] } } as any);
      if (!lead) {
        throw new NotFoundException('Lead not found');
      }
      return lead;
    } catch (error) {
      console.error('Failed to get lead user by email id: ' + error.message);
      throw new BadRequestException('Failed to get lead user by email id: ' + error.message);
    }
  }

  async updateLead(leadId: string, updateLeadDto: UpdateLeadOnboardingDto): Promise<ILead> {
    try {
      // If we are updating restaurantId (restaurant creation), ensure role is ADMIN and abilities are populated
      if (updateLeadDto.restaurantId) {
        const existingLead = await this.dbServices.lead.findOne({ leadId, isDeleted: { $in: [null, false] } } as any);
        if (existingLead) {
          // Update role to ADMIN if it was lead
          if (!updateLeadDto.role && existingLead.role === 'lead') {
            updateLeadDto.role = AdminRoles.ADMIN;
          }
          
          const role = updateLeadDto.role || existingLead.role || AdminRoles.ADMIN;
          
          // Populate abilities if they are missing or if we want to ensure they are set after restaurant creation
          if (!updateLeadDto.abilities || updateLeadDto.abilities.length === 0) {
            updateLeadDto.abilities = this.getAbilitiesByRole(role);
          }
        }
      }

      return await this.dbServices.lead.findOneAndUpdate({ leadId }, updateLeadDto, { new: true });
    } catch (error) {
      console.error('Failed to update lead: ' + error.message);
      throw new BadRequestException('Failed to update lead: ' + error.message);
    }
  }
}

