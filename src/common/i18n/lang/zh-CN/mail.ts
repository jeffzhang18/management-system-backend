import type { MailMessages } from '../../types';

export const mail: MailMessages = {
  verification: {
    purposes: {
      register: '注册',
      'reset-password': '重置密码',
      login: '登录',
      'passkey-register': '绑定通行密钥',
    },
    subject: (purpose) => `${purpose}验证码`,
    intro: (purpose) => `您的${purpose}验证码是`,
    validity: (ttl) => `${ttl} 分钟内有效。`,
    ignore: '如非本人操作，请忽略此邮件。',
  },
};
