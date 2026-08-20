import { apiFetch } from '@/lib/api';

export type FeedbackQuestion = { id: number; question: string };
export type FeedbackAnswer = { id: number; answer: string };

export type CustomerFeedback = {
  id: number;
  createdAt: string;
  customerName: string | null;
  email: string | null;
  mobile: string | null;
  remarks: string | null;
};

export type CustomerFeedbackResponse = {
  id: number;
  question: FeedbackQuestion;
  answer: FeedbackAnswer;
};

// Admin CRUD
export function listFeedbackQuestions() {
  return apiFetch<FeedbackQuestion[]>('/api/v1/feedback-questions');
}

export function createFeedbackQuestion(question: string) {
  return apiFetch<FeedbackQuestion>('/api/v1/feedback-questions', {
    method: 'POST',
    body: { question },
  });
}

export function removeFeedbackQuestion(id: number) {
  return apiFetch<void>(`/api/v1/feedback-questions/${id}`, {
    method: 'DELETE',
  });
}

export function listFeedbackAnswers() {
  return apiFetch<FeedbackAnswer[]>('/api/v1/feedback-answers');
}

export function createFeedbackAnswer(answer: string) {
  return apiFetch<FeedbackAnswer>('/api/v1/feedback-answers', {
    method: 'POST',
    body: { answer },
  });
}

export function removeFeedbackAnswer(id: number) {
  return apiFetch<void>(`/api/v1/feedback-answers/${id}`, {
    method: 'DELETE',
  });
}

// Staff-facing, per-lead
export function listFeedbackForLead(leadId: number) {
  return apiFetch<CustomerFeedback[]>(`/api/v1/leads/${leadId}/feedback`);
}

export function listFeedbackResponses(leadId: number, feedbackId: number) {
  return apiFetch<CustomerFeedbackResponse[]>(
    `/api/v1/leads/${leadId}/feedback/${feedbackId}/responses`,
  );
}
