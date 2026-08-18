import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  createFeedbackAnswer,
  createFeedbackQuestion,
  listFeedbackAnswers,
  listFeedbackQuestions,
  removeFeedbackAnswer,
  removeFeedbackQuestion,
} from '@/lib/feedback';
import { useHasRole } from '@/lib/roles';

export const Route = createFileRoute('/feedback')({
  component: FeedbackPage,
});

function onMutationError(error: unknown, title: string) {
  toast({
    title,
    description:
      error instanceof ApiError ? error.message : 'Something went wrong.',
    variant: 'destructive',
  });
}

function QuestionsCard() {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const { data: questions, isLoading } = useQuery({
    queryKey: ['feedback-questions'],
    queryFn: listFeedbackQuestions,
  });

  const createMutation = useMutation({
    mutationFn: () => createFeedbackQuestion(question.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-questions'] });
      setQuestion('');
      toast({ title: 'Question added' });
    },
    onError: (error) => onMutationError(error, 'Could not add question'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeFeedbackQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-questions'] });
      toast({ title: 'Question removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove question'),
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Questions
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim()) createMutation.mutate();
        }}
        className='flex gap-2'
      >
        <Input
          placeholder='New question'
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!question.trim() || createMutation.isPending}
        >
          Add
        </Button>
      </form>
      <div className='flex flex-col divide-y divide-border/60'>
        {isLoading ? (
          <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
        ) : questions?.length ? (
          questions.map((q) => (
            <div key={q.id} className='flex items-center justify-between py-2'>
              <span className='text-sm'>{q.question}</span>
              <button
                type='button'
                aria-label={`Remove ${q.question}`}
                onClick={() => removeMutation.mutate(q.id)}
                className='text-destructive/70 hover:text-destructive'
              >
                <Trash2 className='size-4' />
              </button>
            </div>
          ))
        ) : (
          <p className='py-2 text-foreground/50 text-sm'>No questions yet.</p>
        )}
      </div>
    </div>
  );
}

function AnswersCard() {
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState('');
  const { data: answers, isLoading } = useQuery({
    queryKey: ['feedback-answers'],
    queryFn: listFeedbackAnswers,
  });

  const createMutation = useMutation({
    mutationFn: () => createFeedbackAnswer(answer.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-answers'] });
      setAnswer('');
      toast({ title: 'Answer added' });
    },
    onError: (error) => onMutationError(error, 'Could not add answer'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeFeedbackAnswer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-answers'] });
      toast({ title: 'Answer removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove answer'),
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Answer options
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (answer.trim()) createMutation.mutate();
        }}
        className='flex gap-2'
      >
        <Input
          placeholder='New answer option'
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        />
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!answer.trim() || createMutation.isPending}
        >
          Add
        </Button>
      </form>
      <div className='flex flex-col divide-y divide-border/60'>
        {isLoading ? (
          <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
        ) : answers?.length ? (
          answers.map((a) => (
            <div key={a.id} className='flex items-center justify-between py-2'>
              <span className='text-sm'>{a.answer}</span>
              <button
                type='button'
                aria-label={`Remove ${a.answer}`}
                onClick={() => removeMutation.mutate(a.id)}
                className='text-destructive/70 hover:text-destructive'
              >
                <Trash2 className='size-4' />
              </button>
            </div>
          ))
        ) : (
          <p className='py-2 text-foreground/50 text-sm'>
            No answer options yet.
          </p>
        )}
      </div>
    </div>
  );
}

function FeedbackPage() {
  const isAdmin = useHasRole('SA', 'CA');

  if (!isAdmin) {
    return (
      <p className='py-10 text-center text-foreground/60 text-sm'>
        You don't have access to this page.
      </p>
    );
  }

  return (
    <>
      <div>
        <h1 className='font-semibold text-2xl text-primary'>
          Customer Feedback
        </h1>
        <p className='text-foreground/60 text-sm'>
          Manage the question/answer pairs shown on the customer feedback form.
        </p>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <QuestionsCard />
        <AnswersCard />
      </div>
    </>
  );
}
