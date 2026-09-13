import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { IdentityType } from 'src/common/enums/common.enum';

export class OAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsEnum(IdentityType)
  @IsOptional()
  identityType?: IdentityType;
}

export class CognitoTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export class CognitoIdentityClaim {
  providerName?: string;
  providerType?: string;
  userId?: string;
}

export class CognitoUserPayload {
  sub: string;
  email: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  'cognito:username'?: string;
  identities?: CognitoIdentityClaim[];
  provider?: IdentityType;
}

