import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { User } from '@finance-crm/database';
import { JwtStrategy } from './jwt.strategy';

/**
 * `validate()` is the only per-request account check in the whole system.
 * Signature verification proves a token was minted by us; it says nothing
 * about whether the account still exists — so without this, deactivating a
 * user left their access token working for the rest of its 15-minute life
 * (2026-08-06 security review).
 */
function strategy(user: Partial<User> | null) {
  const configService = {
    getOrThrow: () => 'a'.repeat(64),
  } as unknown as ConfigService;
  const userRepository = {
    findOne: jest.fn().mockResolvedValue(user),
  } as unknown as Repository<User>;
  return {
    instance: new JwtStrategy(configService, userRepository),
    userRepository,
  };
}

const PAYLOAD = { sub: 7, email: 'staff@financecrm.com', roles: ['CR1'] };

describe('JwtStrategy.validate', () => {
  it('passes an active, non-deleted account through unchanged', async () => {
    const { instance } = strategy({ id: 7, isActive: true, isDeleted: false });

    await expect(instance.validate(PAYLOAD)).resolves.toEqual(PAYLOAD);
  });

  it('rejects a deactivated account', async () => {
    const { instance } = strategy({ id: 7, isActive: false, isDeleted: false });

    await expect(instance.validate(PAYLOAD)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a soft-deleted account', async () => {
    const { instance } = strategy({ id: 7, isActive: true, isDeleted: true });

    await expect(instance.validate(PAYLOAD)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token whose subject no longer exists', async () => {
    const { instance } = strategy(null);

    await expect(instance.validate(PAYLOAD)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('looks the account up by the token subject, not by anything client-supplied', async () => {
    const { instance, userRepository } = strategy({
      id: 7,
      isActive: true,
      isDeleted: false,
    });

    await instance.validate(PAYLOAD);

    expect(userRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 } }),
    );
  });

  it('returns the token payload, not the DB row — roles stay token-scoped', async () => {
    // A role change deliberately takes effect on the next refresh rather than
    // the next request; returning DB roles here would silently change that
    // contract.
    const { instance } = strategy({
      id: 7,
      isActive: true,
      isDeleted: false,
      email: 'changed@example.com',
    } as Partial<User>);

    await expect(instance.validate(PAYLOAD)).resolves.toEqual(PAYLOAD);
  });
});
