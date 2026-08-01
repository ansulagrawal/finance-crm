import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  filePath: string;

  @IsOptional()
  @IsInt()
  documentTypeId?: number;
}
