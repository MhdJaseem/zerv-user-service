import * as bcrypt from 'bcryptjs'
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminUserService } from '../admin-users/admin-user.service';
import { IAdminUser } from '../../common/interfaces/admin-user.interface';
import { ILead } from 'src/common/interfaces/leads.interface';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { AttributeAccess, AttributeNames, AdminRoles } from 'src/common/enums/user.enum';

@Injectable()
export class AdminAuthService {
    private refreshTokenSecret: string;
    private accessTokenSecret: string;
    constructor(
        private jwtService: JwtService,
        private readonly dbServices: IMongoDBServices,
        private adminUsersService: AdminUserService
    ) {
        this.refreshTokenSecret = process.env.JWT_REFRESH_TOKEN_SECRET || '';
        this.accessTokenSecret = process.env.JWT_ACCESS_TOKEN_SECRET || '';
    }

    async validateUser(email: string, password: string, clientId: string): Promise<IAdminUser | ILead> {
        try {
            const adminPayload: any = { email, isDeleted: { $in: [null, false] } };
            if (clientId && clientId !== 'super-admin') {
                adminPayload.restaurantId = clientId;
            }

            // 1) Try admin login by email (and restaurant for non-super-admin clients).
            console.log(`[Auth Debug] Admin Lookup: email=${email}, payload=${JSON.stringify(adminPayload)}`);
            const adminUser = await this.dbServices.adminUser.findOne(adminPayload);
            if (adminUser) {
                if (adminUser.password !== password) {
                    throw new UnauthorizedException('Invalid credentials');
                }
                console.log(`[Auth Debug] Admin Login Successful: adminId=${adminUser.adminId}`);
                return adminUser;
            }

            // 2) Try branch-scoped admin login by email.
            if (clientId && clientId !== 'super-admin') {
                const branchDetails = await this.dbServices.branch.find({ restaurantId: clientId });
                const branchIds = branchDetails?.map((branch) => branch.branchId) || [];
                if (branchIds.length > 0) {
                    const branchAdminUser = await this.dbServices.adminUser.findOne({
                        email,
                        branchId: { $in: branchIds },
                        isDeleted: { $in: [null, false] },
                    });

                    if (branchAdminUser) {
                        if (branchAdminUser.password !== password) {
                            throw new UnauthorizedException('Invalid credentials');
                        }
                        return branchAdminUser;
                    }
                }
            }

            // 3) Try lead login by existing email.
            const existingLeadUser = await this.dbServices.lead.findOne({ email });
            if (!existingLeadUser) {
                throw new UnauthorizedException('Invalid credentials');
            }
            if (existingLeadUser.password !== password) {
                throw new UnauthorizedException('Invalid credentials');
            }

            if (existingLeadUser && !existingLeadUser.isEmailVerified) {
                throw new UnauthorizedException('Email not verified. Please verify your email.');
            }

            // 🔒 Tenant isolation for leads
            const currentClientId = clientId ? String(clientId) : '';
            const leadRestaurantId = existingLeadUser.restaurantId ? String(existingLeadUser.restaurantId) : '';
            
            console.log(`[Auth Debug] Login Attempt: email=${email}, currentClientId=${currentClientId}, leadRestaurantId=${leadRestaurantId}`);

            if (leadRestaurantId) {
                // Returning lead — restaurantId must match the origin's clientId
                if (currentClientId && currentClientId !== 'super-admin' && leadRestaurantId !== currentClientId) {
                    console.error(`[Auth Debug] Tenant Mismatch: Lead belongs to ${leadRestaurantId} but tried to login to ${currentClientId}`);
                    throw new ForbiddenException('You are not authorized to access this restaurant portal');
                }
            } else {
                // First-timer (no restaurant yet) — must NOT be logging into a restaurant-specific portal
                if (currentClientId && currentClientId !== 'super-admin') {
                    console.error(`[Auth Debug] First-timer Error: New lead tried to login to a specific restaurant portal: ${currentClientId}`);
                    throw new ForbiddenException('You are not authorized to access this restaurant portal');
                }
            }

            return existingLeadUser;
        } catch (error) {
            console.error('Error validating user:', error);
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new BadRequestException(error?.message);
        }
    }

    async generateTokens(user: IAdminUser | ILead) {
        const subject = 'adminId' in user ? user.adminId : user.leadId;
        const accessToken = this.jwtService.sign(
            { email: user.email, sub: subject, name: user.firstName, restaurantId: user.restaurantId, branchId: user.branchId },
            { expiresIn: '15m', secret: this.accessTokenSecret }
        );
        const refreshToken = this.jwtService.sign(
            { email: user.email, sub: subject, name: user.firstName, restaurantId: user.restaurantId, branchId: user.branchId },
            { expiresIn: '7d', secret: this.refreshTokenSecret }
        );
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        if ('adminId' in user) {
            await this.adminUsersService.updateRefreshToken(user.adminId, refreshTokenHash);
        } else {
            await this.dbServices.lead.findOneAndUpdate({ leadId: user.leadId }, { refreshToken: refreshTokenHash });
        }

        const adminUser = 'adminId' in user
            ? await this.adminUsersService.getAdminUserById(user.adminId)
            : await this.dbServices.lead.findOne({ leadId: user.leadId });

        const userObj = (adminUser as any)?.toObject?.() || adminUser;

        // Ensure abilities are populated if empty and restaurantId is present
        if (userObj && userObj.restaurantId && (!userObj.abilities || userObj.abilities.length === 0)) {
            const role = userObj.role;
            const abilities: any[] = [];
            if (role === AdminRoles.SUPER_ADMIN) {
                for (const attributeName of Object.values(AttributeNames)) {
                    abilities.push({
                        attributeName,
                        attributeAccess: [AttributeAccess.ALL],
                    });
                }
            } else if (role === AdminRoles.ADMIN || role === 'lead') {
                for (const attributeName of Object.values(AttributeNames)) {
                    abilities.push({
                        attributeName,
                        attributeAccess: [AttributeAccess.ALL],
                    });
                }
            }

            if (abilities.length > 0) {
                userObj.abilities = abilities;
                // Save to DB
                if ('adminId' in user) {
                    await this.dbServices.adminUser.findOneAndUpdate({ adminId: user.adminId }, { abilities });
                } else {
                    await this.dbServices.lead.findOneAndUpdate({ leadId: user.leadId }, { abilities });
                }
            }
        }

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            adminUser: userObj
        };
    }

    async refreshAccessToken(refreshToken: string) {
        try {
            const payload = await this.jwtService.verify(
                refreshToken,
                { secret: this.refreshTokenSecret }
            );

            const user = await this.adminUsersService.getAdminUserById(payload.sub);
            if (!user || !user?.['refreshToken']) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Verify stored refresh token
            const isValid = await bcrypt.compare(refreshToken, user?.['refreshToken']);
            if (!isValid) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            const tokens = await this.generateTokens(user);
            return tokens;
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async logout(accessToken: string) {
        try {
            const token = accessToken.startsWith('Bearer ') ? accessToken.split(' ')[1] : accessToken;

            const payload = this.jwtService.verify(token, {
                secret: this.accessTokenSecret,
                ignoreExpiration: true
            });

            if (payload && payload.sub) {
                await this.adminUsersService.updateRefreshToken(payload.sub, '');
            }
        }
        catch (err) {
            console.error('Logout error:', err.message);
        }
    }
}
