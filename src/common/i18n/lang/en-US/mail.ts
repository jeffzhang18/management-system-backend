import type { MailMessages } from '../../types';

export const mail: MailMessages = {
  verification: {
    purposes: {
      register: 'registration',
      'reset-password': 'password reset',
      login: 'login',
      'passkey-register': 'passkey binding',
    },
    subject: (purpose) => `Your ${purpose} verification code`,
    intro: (purpose) => `Your ${purpose} verification code is`,
    validity: (ttl) => `It is valid for ${ttl} minutes.`,
    ignore: 'If you did not request this, please ignore this email.',
  },
};
