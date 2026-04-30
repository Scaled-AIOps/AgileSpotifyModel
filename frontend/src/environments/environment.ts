export const environment = {
  production: false,
  // Same-origin path. The Angular dev-server proxy (proxy.conf.json) forwards
  // /api/* to localhost:3000 in dev; in production the platform's ingress
  // routes /api/* to the backend service.
  apiUrl: '/api/v1',
  featureFlags: {
    appRegistry: true,
  },
};
