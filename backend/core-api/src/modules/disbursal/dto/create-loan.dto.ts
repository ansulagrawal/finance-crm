import { IsString, MinLength } from 'class-validator';

export class CreateLoanDto {
  @IsString()
  @MinLength(1)
  loanNumber: string;
}
