import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class UpdatePasswordDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message:
      'Password must be at least 8 characters long, include uppercase, lowercase, number, and special character',
  })
  newPassword: string;
}
