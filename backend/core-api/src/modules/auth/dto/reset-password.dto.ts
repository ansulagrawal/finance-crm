import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  resetToken: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  newPassword: string;
}
