import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateContactUsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  remarks: string;
}
