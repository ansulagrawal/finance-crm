import { SmtpEmailSender } from './smtp-email-sender';

describe('SmtpEmailSender', () => {
  it('passes params straight through to nodemailer sendMail', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'test' });
    const sender = new SmtpEmailSender({ sendMail } as never);

    const params = {
      from: 'no-reply@financecrm.co.in',
      to: 'customer@example.com',
      subject: 'Thank You. - salaryontime',
      html: '<p>Hi</p>',
    };
    await sender.send(params);

    expect(sendMail).toHaveBeenCalledWith(params);
  });
});
