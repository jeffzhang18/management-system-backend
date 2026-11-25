export type MailPurpose =
  | 'register'
  | 'reset-password'
  | 'login'
  | 'passkey-register';

export interface VerificationMailMessages {
  purposes: Record<MailPurpose, string>;
  subject: (purpose: string) => string;
  intro: (purpose: string) => string;
  validity: (ttlMinutes: number) => string;
  ignore: string;
}

export interface MailMessages {
  verification: VerificationMailMessages;
}

export interface Messages {
  mail: MailMessages;
}

export interface LocaleDefinition {
  language: string;
  messages: Messages;
}
