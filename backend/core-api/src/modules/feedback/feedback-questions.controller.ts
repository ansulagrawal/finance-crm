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
import { CreateFeedbackQuestionDto } from './dto/create-feedback-question.dto';
import { UpdateFeedbackQuestionDto } from './dto/update-feedback-question.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('Feedback Questions')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('feedback-questions')
export class FeedbackQuestionsController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @ApiOperation({ summary: 'List feedback questions' })
  list() {
    return this.feedbackService.listQuestions();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new feedback question' })
  create(@Body() dto: CreateFeedbackQuestionDto) {
    return this.feedbackService.createQuestion(dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Feedback question ID', type: Number })
  @ApiOperation({ summary: 'Get a feedback question by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.feedbackService.findQuestionById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Feedback question ID', type: Number })
  @ApiOperation({ summary: 'Update a feedback question' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeedbackQuestionDto,
  ) {
    return this.feedbackService.updateQuestion(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Feedback question ID', type: Number })
  @ApiOperation({ summary: 'Delete a feedback question' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.feedbackService.removeQuestion(id);
  }
}
