import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt } from 'class-validator';

export class ValidateEmailDto {
  @ApiProperty()
  @IsInt()
  leadId: number;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '1 = personal email, 2 = alternate email',
    enum: [1, 2],
  })
  @IsIn([1, 2])
  emailType: number;
}
