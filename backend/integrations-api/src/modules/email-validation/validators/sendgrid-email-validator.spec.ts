import { SendGridEmailValidator } from './sendgrid-email-validator';

describe('SendGridEmailValidator', () => {
  it('posts to the real SendGrid validate-email endpoint and maps a Valid verdict', async () => {
    const request = jest
      .fn()
      .mockResolvedValue([{}, { result: { verdict: 'Valid' } }]);
    const validator = new SendGridEmailValidator({ request } as never);

    const result = await validator.validate('customer@example.com');

    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      url: '/v3/validations/email',
      body: { email: 'customer@example.com' },
    });
    expect(result.isValid).toBe(true);
    expect(result.verdict).toBe('Valid');
    expect(result.errorMessage).toBeNull();
  });

  it('marks isValid false for a non-Valid verdict', async () => {
    const request = jest
      .fn()
      .mockResolvedValue([{}, { result: { verdict: 'Invalid' } }]);
    const validator = new SendGridEmailValidator({ request } as never);

    const result = await validator.validate('bad@example.com');

    expect(result.isValid).toBe(false);
    expect(result.verdict).toBe('Invalid');
  });

  it('reports an error when the underlying call fails', async () => {
    const request = jest
      .fn()
      .mockRejectedValue(new Error('connect ECONNREFUSED'));
    const validator = new SendGridEmailValidator({ request } as never);

    const result = await validator.validate('customer@example.com');

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('connect ECONNREFUSED');
  });
});
