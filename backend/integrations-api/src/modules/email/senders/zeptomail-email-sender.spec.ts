import { ZeptoMailEmailSender } from './zeptomail-email-sender';

describe('ZeptoMailEmailSender', () => {
  it('maps to ZeptoMail SDK request shape matching legacy common_send_email()', async () => {
    const sendMail = jest.fn().mockResolvedValue({ message: 'OK' });
    const sender = new ZeptoMailEmailSender({ sendMail } as never);

    await sender.send({
      from: 'no-reply@financecrm.co.in',
      to: 'customer@example.com',
      subject: 'Thank You. - salaryontime',
      html: '<p>Hi</p>',
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: { address: 'no-reply@financecrm.co.in' },
      to: [{ email_address: { address: 'customer@example.com' } }],
      subject: 'Thank You. - salaryontime',
      htmlbody: '<p>Hi</p>',
    });
  });
});
