import { PartialType } from '@nestjs/mapped-types';
import { createRewardDto } from './create-reward.dto';

export class UpdateRewardDto extends PartialType(createRewardDto) {} 