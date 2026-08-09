import type { AuthenticatedUser } from '@finance-crm/common';
import { CollectionExportsController } from './collection-exports.controller';

function fakeResponse() {
  const res: Record<string, jest.Mock> = {
    set: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res as unknown as import('express').Response;
}

function userWithRoles(roles: string[]): AuthenticatedUser {
  return { sub: 1, email: 'user@example.com', roles };
}

describe('CollectionExportsController', () => {
  let service: Record<string, jest.Mock>;
  let controller: CollectionExportsController;

  beforeEach(() => {
    service = {
      loanClosed: jest.fn().mockResolvedValue([]),
      pendingRecovery: jest.fn().mockResolvedValue([]),
      collection: jest.fn().mockResolvedValue([]),
      totalRecovery: jest.fn().mockResolvedValue([]),
    };
    controller = new CollectionExportsController(service as never);
  });

  describe('collection — role-gated contact-detail columns', () => {
    it('honors includeContactDetails=true for an SA user', async () => {
      const res = fakeResponse();

      await controller.collection(
        { includeContactDetails: 'true' },
        userWithRoles(['SA']),
        res,
      );

      expect(service.collection).toHaveBeenCalledWith(
        { includeContactDetails: 'true' },
        true,
      );
    });

    it('honors includeContactDetails=true for a CA user', async () => {
      const res = fakeResponse();

      await controller.collection(
        { includeContactDetails: 'true' },
        userWithRoles(['CA']),
        res,
      );

      expect(service.collection).toHaveBeenCalledWith(
        { includeContactDetails: 'true' },
        true,
      );
    });

    it('ignores includeContactDetails=true for a non-SA/CA role (untrusted flag, not honored from the query string alone)', async () => {
      const res = fakeResponse();

      await controller.collection(
        { includeContactDetails: 'true' },
        userWithRoles(['CO1']),
        res,
      );

      expect(service.collection).toHaveBeenCalledWith(
        { includeContactDetails: 'true' },
        false,
      );
    });

    it('treats includeContactDetails="false" as false even for an SA user', async () => {
      const res = fakeResponse();

      await controller.collection(
        { includeContactDetails: 'false' },
        userWithRoles(['SA']),
        res,
      );

      expect(service.collection).toHaveBeenCalledWith(
        { includeContactDetails: 'false' },
        false,
      );
    });

    it('defaults to false when the flag is omitted entirely', async () => {
      const res = fakeResponse();

      await controller.collection({}, userWithRoles(['SA']), res);

      expect(service.collection).toHaveBeenCalledWith({}, false);
    });
  });

  describe('plain pass-through exports', () => {
    it('loanClosed delegates to the service and streams a CSV response', async () => {
      const rows = [{ leadId: 1 }];
      service.loanClosed.mockResolvedValue(rows);
      const res = fakeResponse();

      await controller.loanClosed({ fromDate: '2026-07-01' }, res);

      expect(service.loanClosed).toHaveBeenCalledWith({
        fromDate: '2026-07-01',
      });
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Disposition': expect.stringContaining('loan-closed.csv'),
        }),
      );
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('leadId'));
    });

    it('totalRecovery delegates to the service and names the file correctly', async () => {
      const res = fakeResponse();

      await controller.totalRecovery({}, res);

      expect(service.totalRecovery).toHaveBeenCalledWith({});
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Disposition': expect.stringContaining('total-recovery.csv'),
        }),
      );
    });
  });
});
