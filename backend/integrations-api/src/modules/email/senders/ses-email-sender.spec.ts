import { SesEmailSender } from './ses-email-sender';

describe('SesEmailSender', () => {
  it('maps to an SES SendEmailCommand', async () => {
    const send = jest.fn().mockResolvedValue({});
    const sender = new SesEmailSender({ send } as never);

    await sender.send({
      from: 'no-reply@financecrm.co.in',
      to: 'customer@example.com',
      subject: 'Thank You. - salaryontime',
      html: '<p>Hi</p>',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const [command] = send.mock.calls[0];
    expect(command.input).toEqual({
      Source: 'no-reply@financecrm.co.in',
      Destination: { ToAddresses: ['customer@example.com'] },
      Message: {
        Subject: { Data: 'Thank You. - salaryontime' },
        Body: { Html: { Data: '<p>Hi</p>' } },
      },
    });
  });
});
