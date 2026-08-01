import { IsString, MinLength } from 'class-validator';

export class CreateDataSourceDto {
  @IsString()
  @MinLength(1)
  name: string;

  /** Required: legacy declares `master_data_source.data_source_code` NOT NULL. */
  @IsString()
  @MinLength(1)
  code: string;
}
