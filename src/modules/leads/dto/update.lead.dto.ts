import { PartialType } from '@nestjs/mapped-types';
import { CreateLeadOnboardingDto } from './create.lead.dto';

export class UpdateLeadOnboardingDto extends PartialType(CreateLeadOnboardingDto) { }

