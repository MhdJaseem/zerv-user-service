export default () => ({
  email: {
    microsoft: {
      clientId: process.env.MS_CLIENT_ID,
      clientSecret: process.env.MS_CLIENT_SECRET,
      tenantId: process.env.MS_TENANT_ID,
      senderEmail: process.env.MS_SENDER_EMAIL,
      graphBase: 'https://graph.microsoft.com/v1.0'
    },
  },
});
