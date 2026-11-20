import { getPasskeyConfig } from './passkey-config';

describe('Passkey relying party configuration', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });
  it('requires explicit configuration in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WEBAUTHN_ORIGIN;
    delete process.env.WEBAUTHN_RP_ID;
    expect(() => getPasskeyConfig()).toThrow();
  });
  it.each([
    ['http://example.com', 'example.com'],
    ['https://attacker.example', 'example.com'],
    ['https://example.com/path', 'example.com'],
    ['https://example.com/', 'example.com'],
    ['https://example.com', 'https://example.com'],
  ])('rejects unsafe or inconsistent configuration %s / %s', (origin, rpID) => {
    process.env.WEBAUTHN_ORIGIN = origin;
    process.env.WEBAUTHN_RP_ID = rpID;
    expect(() => getPasskeyConfig()).toThrow();
  });
  it('accepts a fixed secure frontend origin with a matching relying party', () => {
    process.env.WEBAUTHN_ORIGIN = 'https://app.example.com';
    process.env.WEBAUTHN_RP_ID = 'example.com';
    expect(getPasskeyConfig()).toMatchObject({
      rpID: 'example.com',
      origin: 'https://app.example.com',
    });
  });
});
