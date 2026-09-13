export const getBaseUrl = () => {
  const env = process.env.NODE_ENV || 'dev';

  const baseUrls = {
    local: 'http://localhost',
    dev: 'https://api.dev.zervfoods.com',
    prod: 'https://api.zervfoods.com',
  };

  const services = {
    USER_SERVICE: '/api/zerv-user-service',
    MENU_SERVICE: '/api/zerv-menu-service',
    ADMIN_OPERATION_SERVICE: '/api/zerv-admin-operation-service',
    PAYMENT_SERVICE: '/api/zerv-payment-service'
  };

  const localPorts = {
    USER_SERVICE: 3004,
    MENU_SERVICE: 3001,
    PAYMENT_SERVICE: 3002
  };

  const isLocal = env === 'local';

  return Object.keys(services).reduce((acc, service) => {
    const portSuffix = isLocal ? `:${localPorts[service]}` : '';
    acc[service] = `${baseUrls[env]}${portSuffix}${services[service]}`;
    return acc;
  }, {});
};
