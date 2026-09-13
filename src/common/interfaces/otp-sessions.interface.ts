export interface IOtpSessions {
    otpSessionId: string;
    email: string;
    otpCode: string;
    expiresAt: Date;
}