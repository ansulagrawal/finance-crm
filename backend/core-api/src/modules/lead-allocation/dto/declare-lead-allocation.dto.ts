import {
  UserLeadAllocationCaseType,
  UserLeadAllocationStatus,
} from '@finance-crm/database';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class DeclareLeadAllocationDto {
  @ApiProperty({
    enum: UserLeadAllocationStatus,
    description: '1=Active, 2=Inactive',
  })
  @IsEnum(UserLeadAllocationStatus)
  userStatus: UserLeadAllocationStatus;

  @ApiProperty({
    enum: UserLeadAllocationCaseType,
    description: '1=Fresh, 2=Repeat',
  })
  @IsEnum(UserLeadAllocationCaseType)
  userCaseType: UserLeadAllocationCaseType;
}
