export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  cc?: string;
}

export interface EmailSender {
  send(params: SendEmailParams): Promise<void>;
}
