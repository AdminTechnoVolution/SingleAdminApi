import { DEFAULT_SESSION_TTL_SECONDS, validationSchema } from './config';

describe('admin session configuration', () => {
  it('defaults the persistent session lifetime to 30 days', () => {
    const { value, error } = validationSchema.validate({
      MONGO_URI: 'mongodb://localhost:27017/single',
      GOOGLE_CLIENT_ID: 'admin@example.com',
      ADMIN_EMAILS: 'admin@example.com',
      ADMIN_PORTAL_ORIGIN: 'http://localhost:3000',
      SESSION_SECRET: 'a-session-secret-that-is-at-least-32-characters',
    });

    expect(error).toBeUndefined();
    expect(DEFAULT_SESSION_TTL_SECONDS).toBe(2_592_000);
    expect(value.SESSION_TTL).toBe(DEFAULT_SESSION_TTL_SECONDS);
  });
});
