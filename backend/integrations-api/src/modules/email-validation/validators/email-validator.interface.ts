export interface EmailValidationResult {
  isValid: boolean;
  verdict: string | null;
  requestJson: string;
  responseJson: string;
  errorMessage: string | null;
}

export interface EmailValidator {
  validate(email: string): Promise<EmailValidationResult>;
}
