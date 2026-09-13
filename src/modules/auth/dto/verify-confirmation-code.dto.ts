import { IsEmail, IsNotEmpty } from 'class-validator';

export class VerifyConfirmationCodeDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  confirmationCode: string;
}
