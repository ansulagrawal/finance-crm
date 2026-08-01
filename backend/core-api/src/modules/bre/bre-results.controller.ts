import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { BreService } from './bre.service';
import { BreEvaluationService } from './bre-evaluation.service';
import { CreateBreRuleResultDto } from './dto/create-bre-rule-result.dto';
import { ManualDecisionBreRuleResultDto } from './dto/manual-decision-bre-rule-result.dto';

@ApiTags('BRE Results')
@ApiCookieAuth()
@Controller('leads/:leadId/bre-results')
export class BreResultsController {
  constructor(
    private readonly breService: BreService,
    private readonly breEvaluationService: BreEvaluationService,
  ) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'List BRE rule evaluation results for a lead' })
  list(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.breService.listResultsForLead(leadId);
  }

  @Post('run')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Run the full BRE rule engine for a lead (ports bre_rule_engine()) and record every rule result',
  })
  run(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.breEvaluationService.evaluate(leadId);
  }

  @Post()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Record a BRE rule evaluation result for a lead' })
  create(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: CreateBreRuleResultDto,
  ) {
    return this.breService.createResult(leadId, dto);
  }

  @Patch(':resultId/manual-decision')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiParam({
    name: 'resultId',
    description: 'BRE rule result ID',
    type: Number,
  })
  @ApiOperation({
    summary: 'Manually override the decision of a BRE rule result',
  })
  setManualDecision(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Param('resultId', ParseIntPipe) resultId: number,
    @Body() dto: ManualDecisionBreRuleResultDto,
  ) {
    return this.breService.setManualDecision(leadId, resultId, dto);
  }
}
