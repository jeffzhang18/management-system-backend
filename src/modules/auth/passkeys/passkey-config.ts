import { ServiceUnavailableException } from '@nestjs/common';

export function getPasskeyConfig() {
  const production = process.env.NODE_ENV === 'production';
  const origin =
    process.env.WEBAUTHN_ORIGIN || (production ? '' : 'http://localhost:3001');
  const rpID = process.env.WEBAUTHN_RP_ID || (production ? '' : 'localhost');
  try {
    const url = new URL(origin);
    if (
      !rpID ||
      rpID.includes('/') ||
      rpID.includes(':') ||
      url.origin !== origin ||
      (url.hostname !== rpID && !url.hostname.endsWith(`.${rpID}`)) ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && url.hostname === 'localhost'))
    )
      throw new Error('Invalid configuration');
    return {
      origin,
      rpID,
      rpName: process.env.WEBAUTHN_RP_NAME || 'AGGREGATE',
    };
  } catch {
    throw new ServiceUnavailableException(
      'Passkey authentication is not configured',
    );
  }
}
