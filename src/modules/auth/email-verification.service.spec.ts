import { BadRequestException, HttpException } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service';

type Row = Record<string, any>;

const createRepo = (rows: Row[]) => ({
  rows,
  create: (value: Row) => ({ created_at: new Date(), ...value }),
  save: jest.fn(async (value: Row) => {
    const saved = { id: rows.length + 1, ...value };
    rows.push(saved);
    return saved;
  }),
  findOne: jest.fn(
    async ({ where }: { where: Row }) =>
      [...rows]
        .reverse()
        .find(
          (row) =>
            row.email === where.email &&
            row.purpose === where.purpose &&
            (!('used_at' in where) || row.used_at === null),
        ) ?? null,
  ),
  count: jest.fn(async () => rows.length),
  delete: jest.fn(async ({ id }: { id: number }) => {
    const index = rows.findIndex((row) => row.id === id);
    if (index >= 0) rows.splice(index, 1);
  }),
  increment: jest.fn(async ({ id }: { id: number }) => {
    rows.find((row) => row.id === id)!.attempts += 1;
  }),
  update: jest.fn(async ({ id }: { id: number }, patch: Row) => {
    const row = rows.find((item) => item.id === id && item.used_at === null);
    if (!row) return { affected: 0 };
    Object.assign(row, patch);
    return { affected: 1 };
  }),
});

describe('EmailVerificationService', () => {
  let rows: Row[];
  let sentCode = '';
  let userExists = false;
  let service: EmailVerificationService;
  const mail = {
    sendVerificationCode: jest.fn(async (_to: string, code: string) => {
      sentCode = code;
    }),
  };

  beforeEach(() => {
    rows = [];
    sentCode = '';
    userExists = false;
    mail.sendVerificationCode.mockClear();
    service = new EmailVerificationService(
      createRepo(rows) as any,
      mail as any,
      {
        findByEmail: async () => (userExists ? {} : null),
        findByEmailInsensitive: async () => (userExists ? {} : null),
      } as any,
    );
  });

  it('sends a code and accepts it once', async () => {
    await service.sendRegisterCode('A@b.com');
    expect(sentCode).toMatch(/^\d{6}$/);
    await expect(service.consume('a@b.com', sentCode)).resolves.toBeUndefined();
    await expect(service.consume('a@b.com', sentCode)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a wrong code and locks after too many attempts', async () => {
    await service.sendRegisterCode('a@b.com');
    const wrong = sentCode === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i += 1) {
      await expect(service.consume('a@b.com', wrong)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    await expect(service.consume('a@b.com', sentCode)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an expired code', async () => {
    await service.sendRegisterCode('a@b.com');
    rows[0].expires_at = new Date(Date.now() - 1000);
    await expect(service.consume('a@b.com', sentCode)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('enforces the resend interval', async () => {
    await service.sendRegisterCode('a@b.com');
    await expect(service.sendRegisterCode('a@b.com')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('does not send mail for an existing account', async () => {
    userExists = true;
    await expect(service.sendRegisterCode('a@b.com')).resolves.toEqual({
      sent: true,
    });
    expect(mail.sendVerificationCode).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });

  it('removes the record when sending fails', async () => {
    mail.sendVerificationCode.mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.sendRegisterCode('a@b.com')).rejects.toThrow();
    expect(rows).toHaveLength(0);
  });
  it('sends reset codes only for registered users without disclosing existence', async () => {
    await expect(service.sendResetPasswordCode('a@b.com')).resolves.toEqual({
      sent: true,
    });
    expect(mail.sendVerificationCode).not.toHaveBeenCalled();
    userExists = true;
    await service.sendResetPasswordCode(' A@b.com ');
    expect(mail.sendVerificationCode).toHaveBeenCalledWith(
      'a@b.com',
      sentCode,
      10,
      'reset-password',
    );
    await expect(service.consume('a@b.com', sentCode)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await service.consume('a@b.com', sentCode, 'reset-password');
    await expect(
      service.consume('a@b.com', sentCode, 'reset-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not accept a registration code for a password reset', async () => {
    await service.sendRegisterCode('a@b.com');
    await expect(
      service.consume('a@b.com', sentCode, 'reset-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not fall back to an older unused code after the latest code is consumed', async () => {
    await service.sendRegisterCode('a@b.com');
    const oldCode = sentCode;
    rows[0].created_at = new Date(Date.now() - 61000);
    await service.sendRegisterCode('a@b.com');
    await service.consume('a@b.com', sentCode);
    await expect(service.consume('a@b.com', oldCode)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('enforces hourly limits for password reset codes', async () => {
    userExists = true;
    for (let i = 0; i < 5; i++) {
      rows.forEach((row) => {
        row.created_at = new Date(Date.now() - 61000);
      });
      await service.sendResetPasswordCode('a@b.com');
    }
    rows.forEach((row) => {
      row.created_at = new Date(Date.now() - 61000);
    });
    await expect(
      service.sendResetPasswordCode('a@b.com'),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
