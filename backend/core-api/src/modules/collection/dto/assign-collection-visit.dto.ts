import { IsInt } from 'class-validator';

export class AssignCollectionVisitDto {
  @IsInt()
  allocatedToUserId: number;
}
