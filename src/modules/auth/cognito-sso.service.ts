import axios from 'axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { Helpers } from '../../common/helpers/common.helpers';
import { LeadStatus } from '../../common/enums/leads.enum';
import { AdminRoles } from '../../common/enums/user.enum';
import { IdentityType } from 'src/common/enums/common.enum';
import { CognitoUserPayload } from './dto/oauth-callback.dto';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import { OAuthService } from './oauth.service';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

export interface CognitoTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface CognitoUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private region = process.env.COGNITO_REGION || process.env.AWS_REGION!;

  private client = new CognitoIdentityProviderClient({
    region: this.region,
    ...(typeof process.env.AWS_ACCESS_KEY_ID === 'string' &&
    typeof process.env.AWS_SECRET_ACCESS_KEY === 'string'
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });

  private clientId = process.env.COGNITO_CLIENT_ID!;
  private clientSecret = process.env.COGNITO_CLIENT_SECRET!;
  private userPoolId = process.env.COGNITO_USER_POOL_ID!;
  private cognitoDomain = process.env.COGNITO_DOMAIN!;
  private redirectUri = process.env.COGNITO_REDIRECT_URI!;

  constructor(
    private readonly dbService: IMongoDBServices,
    private readonly jwtService: JwtService,
    private readonly oauthService: OAuthService,
  ) { }

  /**
   * Get the Cognito Hosted UI login URL
   * This URL redirects users to the specified identity provider
   */
  getHostedUILoginUrl(state?: string, identityProvider?: IdentityType): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: this.redirectUri,
      // Force the account picker to appear every time instead of auto-signing in
      prompt: 'select_account',
    });

    // Add identity_provider to skip Cognito UI and go directly to the specified provider
    if (identityProvider) {
      let cognitoProviderName: string;
      switch (identityProvider) {
        case IdentityType.Google:
          cognitoProviderName = 'Google';
          break;
        case IdentityType.Facebook:
          cognitoProviderName = 'Facebook';
          break;
        case IdentityType.Apple:
          cognitoProviderName = 'SignInWithApple';
          break;
        default:
          cognitoProviderName = identityProvider;
      }
      params.append('identity_provider', cognitoProviderName);
    }

    if (state) {
      params.append('state', state);
    }

    return `${this.cognitoDomain}/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<CognitoTokenResponse> {
    const tokenEndpoint = `${this.cognitoDomain}/oauth2/token`;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    try {
      const response = await axios.post<CognitoTokenResponse>(tokenEndpoint, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (!response.data?.access_token) {
        throw new UnauthorizedException('Cognito returned an empty token response');
      }
      if (!response.data?.id_token) {
        throw new UnauthorizedException('Cognito did not return an id_token; check app client scopes (openid)');
      }

      this.logger.log('[exchangeCodeForTokens] Token exchange successful');
      return response.data;
    } catch (err: any) {
      const errorCode = err?.response?.data?.error;
      const errorDesc = err?.response?.data?.error_description;
      this.logger.error(`[exchangeCodeForTokens] Failed: ${errorCode} – ${errorDesc}`);

      if (errorCode === 'invalid_grant') {
        throw new UnauthorizedException(
          'Authorization code has expired or was already used. Please sign in again.',
        );
      }
      if (errorCode === 'invalid_client') {
        throw new InternalServerErrorException(
          'OAuth client misconfiguration. Check COGNITO_CLIENT_ID and COGNITO_CLIENT_SECRET.',
        );
      }
      if (errorCode === 'redirect_mismatch') {
        throw new InternalServerErrorException(
          'redirect_uri mismatch. Verify COGNITO_REDIRECT_URI matches the Cognito App Client settings.',
        );
      }

      throw new UnauthorizedException(
        errorDesc || err?.message || 'Token exchange with Cognito failed',
      );
    }
  }

  /**
    * Verify ID Token using JWKS from Cognito
    * Returns the decoded and verified payload
    */
  async fetchUserInfo(idToken: string): Promise<CognitoUserPayload> {
    if (!idToken || typeof idToken !== 'string') {
      throw new UnauthorizedException('ID token is required for verification');
    }
    try {
      // Construct the JWKS URI for the Cognito User Pool
      const jwksUri = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}/.well-known/jwks.json`;

      // Create a remote JWK set
      const JWKS = createRemoteJWKSet(new URL(jwksUri));

      // Verify the token
      const { payload } = await jwtVerify(idToken, JWKS, {
        issuer: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`,
        audience: this.clientId,
      });

      // Validate required claims
      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException('Missing required claims in ID token');
      }

      return payload as unknown as CognitoUserPayload;
    } catch (error) {
      console.error('Error verifying ID token:', error.message);

      if (error.name === 'JWTExpired') {
        throw new UnauthorizedException('ID token has expired');
      }

      if (error.name === 'JWSSignatureVerificationFailed') {
        throw new UnauthorizedException('Invalid token signature');
      }

      throw new UnauthorizedException('Failed to verify ID token');
    }
  }

  parseUserProfile(userInfo: CognitoUserInfo | CognitoUserPayload): {
    email: string;
    firstName: string;
    lastName: string;
    picture: string;
  } {
    const email = userInfo.email;
    if (!email) throw new UnauthorizedException('Email not present in Cognito user info');

    const fullName = userInfo.name || '';
    const nameParts = fullName.trim().split(' ');

    const firstName = userInfo.given_name || nameParts[0] || '';
    const lastName =
      userInfo.family_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
    const picture = userInfo.picture || '';

    return { email, firstName, lastName, picture };
  }

  async upsertLeadAndIssueTokens(profile: {
    email: string;
    firstName: string;
    lastName: string;
    picture: string;
    authProvider: string;
  }): Promise<{
    user: any;
    isNewLead: boolean;
    accessToken: string;
    refreshToken: string;
    idToken: string;
  }> {
    const { email, firstName, lastName } = profile;

    let existingRecord: any =
      (await this.dbService.lead.findOne({ email, isDeleted: { $in: [null, false] } })) ||
      (await this.dbService.adminUser.findOne({ email })) ||
      (await this.dbService.user.findOne({ email }));

    let isNewLead = false;

    if (!existingRecord) {
      existingRecord = await this.dbService.lead.create({
        firstName,
        lastName,
        email,
        password: Helpers.generateTempPassword(),
        phoneNumber: '',
        role: AdminRoles.ADMIN,
        abilities: [],
        leadStatus: LeadStatus.PENDING,
        isEmailVerified: true, // Google verified
        isDeleted: false,
        authProvider: profile.authProvider,
      });
      isNewLead = true;
      this.logger.log(`[upsertLeadAndIssueTokens] Created new lead: ${email}`);
    } else {
      this.logger.log(`[upsertLeadAndIssueTokens] Found existing record: ${email}`);
    }

    const { accessToken, refreshToken } = await this.generateJwtTokens(existingRecord);

    const idTokenPayload = {
      sub: existingRecord.leadId || existingRecord.adminId || existingRecord.userId,
      email: existingRecord.email,
      given_name: existingRecord.firstName,
      family_name: existingRecord.lastName || '',
    };
    const idToken = await this.jwtService.signAsync(idTokenPayload, {
      secret: process.env.JWT_ACCESS_TOKEN_SECRET,
      expiresIn: '1h',
    });

    if (existingRecord.leadId) {
      const leadUpdates: Record<string, unknown> = { isEmailVerified: true };
      if (!existingRecord.authProvider) {
        leadUpdates.authProvider = profile.authProvider;
      }
      await this.dbService.lead.findOneAndUpdate(
        { leadId: existingRecord.leadId },
        { $set: leadUpdates },
      );
    } else if (existingRecord.adminId) {
      await this.dbService.adminUser.findOneAndUpdate(
        { adminId: existingRecord.adminId },
        { $set: { authProvider: profile.authProvider } },
      );
    } else if (existingRecord.userId) {
      await this.dbService.user.findOneAndUpdate(
        { userId: existingRecord.userId },
        { $set: { authProvider: profile.authProvider } },
      );
    }

    const userPayload = {
      email: existingRecord.email,
      firstName: existingRecord.firstName || firstName,
      lastName: existingRecord.lastName || lastName,
      leadId: existingRecord.leadId || null,
      adminId: existingRecord.adminId || null,
      restaurantId: existingRecord.restaurantId || null,
      role: existingRecord.role || null,
      leadStatus: existingRecord.leadStatus || null,
      isEmailVerified: existingRecord.isEmailVerified ?? true,
      isNewLead,
    };

    return { user: userPayload, isNewLead, accessToken, refreshToken, idToken };
  }

  private async generateJwtTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    const subject = user.leadId || user.adminId || user.userId || user.email;

    const payload = {
      sub: subject,
      email: user.email,
      name: user.firstName,
      restaurantId: user.restaurantId || null,
      branchId: user.branchId || null,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_TOKEN_SECRET,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_TOKEN_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async handleCognitoCallback(code: string): Promise<{
    user: any;
    isNewLead: boolean;
    accessToken: string;
    idToken: string;
    refreshToken: string;
  }> {
    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    const tokens = await this.exchangeCodeForTokens(code);

    if (!tokens.id_token) {
      throw new UnauthorizedException('Missing id_token from Cognito token response');
    }

    const userInfo = await this.fetchUserInfo(tokens.id_token);

    const profile = this.parseUserProfile(userInfo);

    const claims = decodeJwt(tokens.id_token) as unknown as CognitoUserPayload;
    const authProvider =
      claims.provider ??
      this.oauthService.inferProviderFromPayload(claims) ??
      IdentityType.Google;

    const result = await this.upsertLeadAndIssueTokens({ ...profile, authProvider });

    return {
      ...result,
      idToken: tokens.id_token || result.idToken,
    };
  }
}
