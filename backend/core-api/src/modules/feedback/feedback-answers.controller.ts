import { Roles } from '@finance-crm/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { CreateFeedbackAnswerDto } from './dto/create-feedback-answer.dto';
import { UpdateFeedbackAnswerDto } from './dto/update-feedback-answer.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('Feedback Answers')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('feedback-answers')
export class FeedbackAnswersController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @ApiOperation({ summary: 'List feedback answer options' })
  list() {
    return this.feedbackService.listAnswers();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new feedback answer option' })
  create(@Body() dto: CreateFeedbackAnswerDto) {
    return this.feedbackService.createAnswer(dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Feedback answer ID', type: Number })
  @ApiOperation({ summary: 'Get a feedback answer option by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.feedbackService.findAnswerById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Feedback answer ID', type: Number })
  @ApiOperation({ summary: 'Update a feedback answer option' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeedbackAnswerDto,
  ) {
    return this.feedbackService.updateAnswer(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Feedback answer ID', type: Number })
  @ApiOperation({ summary: 'Delete a feedback answer option' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.feedbackService.removeAnswer(id);
  }
}
