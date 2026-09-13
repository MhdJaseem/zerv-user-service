import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { CognitoUserPayload, CognitoTokenResponse } from './dto/oauth-callback.dto';
import { IdentityType } from 'src/common/enums/common.enum';
import { LeadStatus } from 'src/common/enums/leads.enum';
import { Helpers } from 'src/common/helpers/common.helpers';
import { AdminRoles, AttributeAccess, AttributeNames } from 'src/common/enums/user.enum';

/** Normalized result after Cognito OAuth upsert (user, admin, or lead). */
export interface OAuthUpsertResult {
  recordType: 'user' | 'lead' | 'admin';
  subjectId: string;
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  restaurantId: string | null;
  abilities?: any[];
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(private readonly dbServices: IMongoDBServices) { }

  /**
   * Infer IdP from Cognito ID token claims when callback query does not pass identityType.
   */
  inferProviderFromPayload(payload: CognitoUserPayload): IdentityType | undefined {
    const identities = payload.identities;
    if (Array.isArray(identities) && identities.length > 0) {
      const raw =
        identities[0]?.providerName || identities[0]?.providerType || '';
      const p = String(raw).toLowerCase();
      if (p.includes('google')) return IdentityType.Google;
      if (p.includes('facebook')) return IdentityType.Facebook;
      if (p.includes('apple')) return IdentityType.Apple;
    }
    const username = String(payload['cognito:username'] || '').toLowerCase();
    if (username.startsWith('google_') || username.includes('google')) {
      return IdentityType.Google;
    }
    if (username.startsWith('facebook_') || username.includes('facebook')) {
      return IdentityType.Facebook;
    }
    if (
      username.startsWith('signinwithapple') ||
      username.includes('apple')
    ) {
      return IdentityType.Apple;
    }
    return undefined;
  }

  private coerceEmailVerified(payload: CognitoUserPayload): boolean {
    const v = payload.email_verified;
    return v === true || v === 'true';
  }

  private normalizeOriginUrls(originUrls: string[] | string | undefined): string[] {
    if (Array.isArray(originUrls)) {
      return originUrls;
    }
    if (typeof originUrls === 'string' && originUrls.trim().length > 0) {
      return [originUrls];
    }
    return [];
  }



  private resolveNames(
    userPayload: CognitoUserPayload,
    email: string,
  ): { firstName: string; lastName: string } {
    let first = (userPayload.given_name || '').trim();
    let last = (userPayload.family_name || '').trim();

    if (!first && !last && userPayload.name?.trim()) {
      const parts = userPayload.name.trim().split(/\s+/);
      first = parts[0] || '';
      last = parts.slice(1).join(' ') || '';
    }

    if (!first && !last) {
      if (userPayload.provider === IdentityType.Apple) {
        first = this.generateDefaultNameFromEmail(email);
      } else {
        first =
          userPayload.name?.trim() || this.generateDefaultNameFromEmail(email);
      }
    }

    return { firstName: first, lastName: last };
  }

  /** IdP string persisted on user/admin/lead (see `IdentityType` + `email`). */
  private resolveAuthProviderForStorage(userPayload: CognitoUserPayload): string {
    return (
      userPayload.provider ??
      this.inferProviderFromPayload(userPayload) ??
      IdentityType.Google
    );
  }

  /**
   * Upsert after Cognito Hosted UI: update existing user/admin/lead, or create a lead (no restaurantId yet).
   */
  async upsertUserFromOAuth(userPayload: CognitoUserPayload, _tokenResponse: CognitoTokenResponse, expectedRestaurantId?: string): Promise<OAuthUpsertResult> {
    const email = userPayload.email.toLowerCase();
    // SSO logins inherently verify the user's email through the external identity provider
    const verified = true;
    const names = this.resolveNames(userPayload, email);
    const authProvider = this.resolveAuthProviderForStorage(userPayload);

    this.logger.log(
      `OAuth upsert for ${email}: provider=${userPayload.provider}, expectedRestaurantId=${expectedRestaurantId}`,
    );

    const existingUser = await this.dbServices.user.findOne({ email });
    if (existingUser) {
      // 🔒 Tenant isolation for customers
      if (expectedRestaurantId && expectedRestaurantId !== 'super-admin') {
        if (existingUser.restaurantId && String(existingUser.restaurantId) !== String(expectedRestaurantId)) {
          this.logger.error(`[OAuth Tenant Mismatch] User ${email} belongs to ${existingUser.restaurantId} but tried login to ${expectedRestaurantId}`);
          throw new ForbiddenException('This account is associated with another restaurant. Cross-tenant access is not allowed.');
        }
      }

      const firstName = names.firstName || existingUser.firstName;
      const lastName = names.lastName || existingUser.lastName || '';

      const updated = await this.dbServices.user.findOneAndUpdate(
        { email },
        { $set: { firstName, lastName, authProvider, isEmailVerified: verified } },
        { new: true },
      );

      return {
        recordType: 'user',
        subjectId: updated.userId,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName || '',
        isEmailVerified: verified,
        restaurantId: updated.restaurantId ?? null,
        abilities: [],
      };
    }

    const existingAdmin = await this.dbServices.adminUser.findOne({ email });
    if (existingAdmin) {
      // 🔒 Tenant isolation for admins
      const isAdminSuperAdmin = existingAdmin.role === AdminRoles.SUPER_ADMIN;

      if (expectedRestaurantId && expectedRestaurantId !== 'super-admin') {
        if (!isAdminSuperAdmin && existingAdmin.restaurantId && String(existingAdmin.restaurantId) !== String(expectedRestaurantId)) {
          this.logger.error(`[OAuth Tenant Mismatch] Admin ${email} belongs to ${existingAdmin.restaurantId} but tried login to ${expectedRestaurantId}`);
          throw new ForbiddenException('You are not authorized to access this restaurant portal');
        }
      } else if (expectedRestaurantId === 'super-admin') {
        if (!isAdminSuperAdmin) {
          throw new ForbiddenException('Only Super Admin can access this dashboard');
        }
      }

      const firstName = names.firstName || existingAdmin.firstName;
      const lastName = names.lastName || existingAdmin.lastName || '';

      const updated = await this.dbServices.adminUser.findOneAndUpdate(
        { email },
        { $set: { firstName, lastName, authProvider, isEmailVerified: verified } },
        { new: true },
      );

      return {
        recordType: 'admin',
        subjectId: updated.adminId,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName || '',
        isEmailVerified: verified,
        restaurantId: updated.restaurantId ?? null,
        abilities: (updated as any).abilities || [],
      };
    }

    const existingLead = await this.dbServices.lead.findOne({
      email,
      isDeleted: { $in: [null, false] },
    } as any);
    if (existingLead) {
      // 🔒 Tenant isolation for leads
      if (expectedRestaurantId && expectedRestaurantId !== 'super-admin') {
        if (existingLead.restaurantId && String(existingLead.restaurantId) !== String(expectedRestaurantId)) {
          this.logger.error(`[OAuth Tenant Mismatch] Lead ${email} belongs to ${existingLead.restaurantId} but tried login to ${expectedRestaurantId}`);
          throw new ForbiddenException('You are not authorized to access this restaurant portal');
        }
        if (!existingLead.restaurantId) {
          this.logger.error(`[OAuth First-timer Error] New lead ${email} tried to login to specific portal ${expectedRestaurantId}`);
          throw new ForbiddenException('You are not authorized to access this restaurant portal');
        }
      }

      const firstName = names.firstName || existingLead.firstName || '';
      const lastName = names.lastName || existingLead.lastName || '';

      const leadSet: Record<string, unknown> = {
        firstName,
        lastName,
        isEmailVerified: verified,
      };
      if (!existingLead.authProvider) {
        leadSet.authProvider = authProvider;
      }

      const updated = await this.dbServices.lead.findOneAndUpdate(
        { leadId: existingLead.leadId },
        { $set: leadSet },
        { new: true },
      );
      return {
        recordType: 'lead',
        subjectId: updated.leadId,
        email: updated.email,
        firstName: updated.firstName || '',
        lastName: updated.lastName || '',
        isEmailVerified: updated.isEmailVerified ?? verified,
        restaurantId: updated.restaurantId ?? null,
        abilities: (updated as any).abilities || [],
      };
    }
    if (expectedRestaurantId && expectedRestaurantId !== 'super-admin') {
       this.logger.error(`[OAuth First-timer Error] New user ${email} tried to login to specific portal ${expectedRestaurantId}`);
       throw new ForbiddenException('You are not authorized to access this restaurant portal');
    }

    const role = 'lead';
    const abilities: any[] = [];

    for (const attributeName of Object.values(AttributeNames)) {
        abilities.push({
          attributeName,
          attributeAccess: [AttributeAccess.ALL],
        });
    }

    const created = await this.dbServices.lead.create({
      firstName: names.firstName,
      lastName: names.lastName || '',
      email,
      password: Helpers.generateTempPassword(),
      phoneNumber: 'NA',
      role,
      abilities,
      leadStatus: LeadStatus.PENDING,
      isEmailVerified: verified,
      isDeleted: false,
      authProvider,
    } as any);

    this.logger.log(`Created new lead from OAuth: ${email}`);

    return {
      recordType: 'lead',
      subjectId: created.leadId,
      email: created.email,
      firstName: created.firstName || '',
      lastName: created.lastName || '',
      isEmailVerified: created.isEmailVerified ?? verified,
      restaurantId: created.restaurantId ?? null,
      abilities: (created as any).abilities || [],
    };
  }

  private generateDefaultNameFromEmail(email: string): string {
    const emailPrefix = email.split('@')[0];
    const nameParts = emailPrefix.split(/[._-]/).map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    );
    return nameParts.join(' ');
  }

  async getUserByEmail(email: string) {
    try {
      return await this.dbServices.user.findOne({
        email: email.toLowerCase(),
      });
    } catch (error: any) {
      this.logger.error(`Error getting user by email: ${error.message}`);
      throw error;
    }
  }

  async getUserByCognitoSub(sub: string) {
    try {
      return await this.dbServices.user.findOne({ userId: sub });
    } catch (error: any) {
      this.logger.error(`Error getting user by Cognito sub: ${error.message}`);
      throw error;
    }
  }
}
