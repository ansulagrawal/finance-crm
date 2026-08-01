import { PartialType } from '@nestjs/swagger';
import { CreateBreRuleDto } from './create-bre-rule.dto';

export class UpdateBreRuleDto extends PartialType(CreateBreRuleDto) {}
