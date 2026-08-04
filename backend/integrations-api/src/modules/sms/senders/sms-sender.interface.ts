export interface SendSmsParams {
  mobile: string;
  message: string;
  templateId: string;
}

export interface SendSmsResult {
  success: boolean;
  responseBody: string;
  errorMessage: string | null;
  isNetworkError: boolean;
}

export interface SmsSender {
  send(params: SendSmsParams): Promise<SendSmsResult>;
}
