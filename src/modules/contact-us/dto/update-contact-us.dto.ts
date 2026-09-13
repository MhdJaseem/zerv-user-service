import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContactUsStatus } from '../entities/contact-us.entity';

export class UpdateContactUsDto {
  @IsEnum(ContactUsStatus)
  @IsOptional()
  status?: ContactUsStatus;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  adminNotes?: string;
}
