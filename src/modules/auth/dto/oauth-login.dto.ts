import { IsString, IsOptional, IsEnum } from 'class-validator';
import { IdentityType } from 'src/common/enums/common.enum';

export class OAuthLoginDto {
  @IsString()
  @IsOptional()
  state?: string;

  @IsEnum(IdentityType, {
    message: 'Provider must be one of: google, facebook, apple'
  })
  @IsOptional()
  provider?: IdentityType;
}
