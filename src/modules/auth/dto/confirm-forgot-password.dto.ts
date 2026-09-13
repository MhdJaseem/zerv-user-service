import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class ConfirmForgotPasswordDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  confirmationCode: string;

  @IsNotEmpty()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};:'",.<>/?\\|`~])[A-Za-z\d!@#$%^&*()_\-+=\[\]{};:'",.<>/?\\|`~]{8,}$/, {
    message:
      'Password must be at least 8 characters long, include uppercase, lowercase, number, and special character',
  })
  newPassword: string;
}
