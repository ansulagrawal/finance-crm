import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency, InfoRow } from '@/components/lead-detail/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from '@/components/ui/modal';
import { NumberInput } from '@/components/ui/number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { ApiError, apiUrl } from '@/lib/api';
import {
  BRE_DECISION_LABEL,
  type BreDecision,
  type BreDecisionOrNone,
  type BreRuleResult,
  listBreResults,
  runBre,
  setBreManualDecision,
} from '@/lib/bre';
import {
  CAM_STATUS_LABEL,
  type Cam,
  type CamStatus,
  getCam,
  getFoirCapPercent,
  sanctionCam,
  sendBackCam,
  type UpsertCamInput,
  upsertCam,
} from '@/lib/cam';
import { getLead, type LeadUserType } from '@/lib/leads';
import { useHasRole } from '@/lib/roles';

export const Route = createFileRoute('/leads/$leadId/cam')({
  component: CamPage,
});

const CAM_STATUS_VARIANT: Record<CamStatus, 'muted' | 'success'> = {
  0: 'muted',
  1: 'success',
};

function CamReadOnlyView({ leadId, cam }: { leadId: number; cam: Cam }) {
  return (
    <>
      <InfoRow
        label='Recommended amount'
        value={formatCurrency(cam.recommendedLoanAmount)}
      />
      <InfoRow label='ROI' value={`${cam.roi}%`} />
      <InfoRow label='Tenure' value={`${cam.tenureDays} days`} />
      <InfoRow
        label='Net disbursal amount'
        value={formatCurrency(cam.netDisbursalAmount)}
      />
      <InfoRow
        label='Repayment amount'
        value={formatCurrency(cam.repaymentAmount)}
      />
      <InfoRow
        label='Final FOIR'
        value={cam.finalFoirPercentage ? `${cam.finalFoirPercentage}%` : '—'}
      />
      <InfoRow label='Risk profile' value={cam.riskProfile ?? '—'} />
      {cam.remarks && <InfoRow label='Remarks' value={cam.remarks} />}
      {cam.status === 1 && (
        <a
          href={apiUrl(`/api/v1/leads/${leadId}/sanction-letter`)}
          target='_blank'
          rel='noreferrer'
          className='mt-3 flex items-center gap-1.5 text-primary text-sm hover:underline'
        >
          <FileText className='size-4' />
          View sanction letter
        </a>
      )}
    </>
  );
}

function CamForm({
  leadId,
  cam,
  userType,
  appliedLoanAmount,
}: {
  leadId: number;
  cam: Cam | null;
  userType: LeadUserType;
  appliedLoanAmount: number | null;
}) {
  const queryClient = useQueryClient();
  const foirCapPercent = getFoirCapPercent(userType);
  const eligibleLoanAmount = (
    appraisedMonthlyIncome: number,
    appraisedObligations: number,
  ) =>
    Math.round(
      (appraisedMonthlyIncome - appraisedObligations) * (foirCapPercent / 100),
    );

  const saveMutation = useMutation({
    mutationFn: (dto: UpsertCamInput) => upsertCam(leadId, dto),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cam', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      form.setFieldValue('repaymentDate', data.repaymentDate ?? '');
      if (
        variables.repaymentDate &&
        data.repaymentDate &&
        variables.repaymentDate !== data.repaymentDate
      ) {
        toast({
          title: 'Repayment date adjusted',
          description: `Shifted to ${data.repaymentDate} (Sunday/holiday adjustment).`,
        });
      } else {
        toast({ title: 'CAM saved' });
      }
    },
    onError: (error) => {
      toast({
        title: 'Could not save CAM',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const sanctionMutation = useMutation({
    mutationFn: () => sanctionCam(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cam', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'CAM sanctioned' });
    },
    onError: (error) => {
      toast({
        title: 'Could not sanction CAM',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const sendBackMutation = useMutation({
    mutationFn: (remarks: string) => sendBackCam(leadId, remarks || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cam', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'CAM sent back' });
    },
    onError: (error) => {
      toast({
        title: 'Could not send back CAM',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const form = useForm({
    defaultValues: {
      recommendedLoanAmount: cam ? Number(cam.recommendedLoanAmount) : 0,
      roi: cam ? Number(cam.roi) : 0,
      penalRoi: cam?.penalRoi ? Number(cam.penalRoi) : 0,
      tenureDays: cam?.tenureDays ?? 0,
      processingFeePercent: cam?.processingFeePercent
        ? Number(cam.processingFeePercent)
        : 0,
      adminFee: cam?.adminFee ? Number(cam.adminFee) : 0,
      netDisbursalAmount: cam ? Number(cam.netDisbursalAmount) : 0,
      repaymentAmount: cam ? Number(cam.repaymentAmount) : 0,
      disbursalDate: cam?.disbursalDate ?? '',
      repaymentDate: cam?.repaymentDate ?? '',
      eligibleFoirPercentage: cam?.eligibleFoirPercentage
        ? Number(cam.eligibleFoirPercentage)
        : 0,
      finalFoirPercentage: cam?.finalFoirPercentage
        ? Number(cam.finalFoirPercentage)
        : 0,
      appraisedMonthlyIncome: cam?.appraisedMonthlyIncome
        ? Number(cam.appraisedMonthlyIncome)
        : 0,
      appraisedObligations: cam?.appraisedObligations
        ? Number(cam.appraisedObligations)
        : 0,
      riskProfile: cam?.riskProfile ?? '',
      riskScore: cam?.riskScore ? Number(cam.riskScore) : 0,
      remarks: cam?.remarks ?? '',
    },
    onSubmit: ({ value }) => {
      saveMutation.mutate({
        recommendedLoanAmount: value.recommendedLoanAmount,
        roi: value.roi,
        penalRoi: value.penalRoi || undefined,
        tenureDays: value.tenureDays,
        processingFeePercent: value.processingFeePercent || undefined,
        adminFee: value.adminFee || undefined,
        netDisbursalAmount: value.netDisbursalAmount,
        repaymentAmount: value.repaymentAmount,
        disbursalDate: value.disbursalDate || undefined,
        repaymentDate: value.repaymentDate || undefined,
        eligibleFoirPercentage: value.eligibleFoirPercentage || undefined,
        finalFoirPercentage: value.finalFoirPercentage || undefined,
        appraisedMonthlyIncome: value.appraisedMonthlyIncome || undefined,
        appraisedObligations: value.appraisedObligations || undefined,
        riskProfile: value.riskProfile || undefined,
        riskScore: value.riskScore || undefined,
        remarks: value.remarks || undefined,
      });
    },
  });

  const [sendBackRemarks, setSendBackRemarks] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className='flex flex-col gap-3'
    >
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        <form.Field
          name='recommendedLoanAmount'
          validators={{
            onChangeListenTo: [
              'appraisedMonthlyIncome',
              'appraisedObligations',
            ],
            onChange: ({ value, fieldApi }) => {
              if (appliedLoanAmount != null && value > appliedLoanAmount) {
                return `Cannot exceed the applied loan amount (${formatCurrency(appliedLoanAmount)})`;
              }
              const income = fieldApi.form.getFieldValue(
                'appraisedMonthlyIncome',
              );
              const obligations = fieldApi.form.getFieldValue(
                'appraisedObligations',
              );
              const eligible = eligibleLoanAmount(income, obligations);
              if (value > eligible) {
                return `Cannot exceed the eligible loan amount (${formatCurrency(eligible)})`;
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Recommended amount</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={1000}
              />
              {field.state.meta.errors.length > 0 && (
                <span className='text-destructive text-xs'>
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name='roi'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>ROI (%)</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                max={100}
                step={0.5}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='penalRoi'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Penal ROI (%)</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                max={100}
                step={0.5}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='tenureDays'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Tenure (days)</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={1}
                step={1}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='processingFeePercent'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Processing fee (%)</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                max={100}
                step={0.5}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='adminFee'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Admin fee</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={50}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='netDisbursalAmount'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Net disbursal amount</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={1000}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='repaymentAmount'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Repayment amount</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={1000}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='disbursalDate'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Disbursal date</Label>
              <DatePicker
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='repaymentDate'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Repayment date</Label>
              <DatePicker
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='eligibleFoirPercentage'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Eligible FOIR (%)</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                max={100}
                step={1}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='finalFoirPercentage'>
          {(field) => {
            const overCap = field.state.value >= foirCapPercent;
            return (
              <div className='flex flex-col gap-1'>
                <Label>Final FOIR (%)</Label>
                <NumberInput
                  value={field.state.value}
                  onChange={field.handleChange}
                  min={0}
                  max={100}
                  step={1}
                />
                {overCap && (
                  <p className='text-destructive text-xs'>
                    FOIR cannot be {foirCapPercent}% or above for a{' '}
                    {userType === 'NEW' ? 'new' : 'repeat'} customer — sanction
                    is blocked until this is brought down.
                  </p>
                )}
              </div>
            );
          }}
        </form.Field>
        <form.Field
          name='appraisedMonthlyIncome'
          validators={{
            onChange: ({ value }) =>
              value > 0 ? undefined : 'Appraised monthly income is required',
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Appraised monthly income</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={500}
              />
              {field.state.meta.errors.length > 0 && (
                <span className='text-destructive text-xs'>
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name='appraisedObligations'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Appraised obligations</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={500}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='riskProfile'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Risk profile</Label>
              <Input
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder='Low / Medium / High'
              />
            </div>
          )}
        </form.Field>
        <form.Field name='riskScore'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Risk score</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={1}
              />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name='remarks'>
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label>Remarks</Label>
            <Textarea
              placeholder='Add a note (optional)'
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              rows={2}
            />
          </div>
        )}
      </form.Field>

      <div className='flex flex-wrap items-center gap-2 border-border/60 border-t pt-3'>
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              type='primary'
              htmlType='submit'
              size='sm'
              disabled={!canSubmit || saveMutation.isPending}
            >
              {saveMutation.isPending ? <Spinner size='sm' /> : 'Save CAM'}
            </Button>
          )}
        </form.Subscribe>
        {cam && cam.status !== 1 && (
          <form.Subscribe
            selector={(state) => state.values.finalFoirPercentage}
          >
            {(finalFoirPercentage) => {
              const foirOverCap = finalFoirPercentage >= foirCapPercent;
              return (
                <Button
                  type='secondary'
                  size='sm'
                  htmlType='button'
                  disabled={sanctionMutation.isPending || foirOverCap}
                  title={
                    foirOverCap
                      ? `Final FOIR must be below ${foirCapPercent}% to sanction`
                      : undefined
                  }
                  onClick={() => sanctionMutation.mutate()}
                >
                  {sanctionMutation.isPending ? (
                    <Spinner size='sm' />
                  ) : (
                    'Sanction'
                  )}
                </Button>
              );
            }}
          </form.Subscribe>
        )}
        {cam && (
          <Modal>
            <ModalTrigger asChild>
              <Button type='destructive' size='sm' htmlType='button'>
                Send back
              </Button>
            </ModalTrigger>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>Send CAM back</ModalTitle>
                <ModalDescription>
                  Returns this CAM for revision. This doesn't currently change
                  the lead's own status — confirm that's the intended behavior
                  before relying on it.
                </ModalDescription>
              </ModalHeader>
              <Textarea
                value={sendBackRemarks}
                onChange={(event) => setSendBackRemarks(event.target.value)}
                rows={2}
                placeholder='Remarks (optional)'
              />
              <ModalFooter>
                <ModalClose asChild>
                  <Button type='secondary' htmlType='button'>
                    Cancel
                  </Button>
                </ModalClose>
                <ModalClose asChild>
                  <Button
                    type='destructive'
                    htmlType='button'
                    disabled={sendBackMutation.isPending}
                    onClick={() => sendBackMutation.mutate(sendBackRemarks)}
                  >
                    {sendBackMutation.isPending ? (
                      <Spinner size='sm' />
                    ) : (
                      'Send back'
                    )}
                  </Button>
                </ModalClose>
              </ModalFooter>
            </ModalContent>
          </Modal>
        )}
        {cam?.status === 1 && (
          <a
            href={apiUrl(`/api/v1/leads/${leadId}/sanction-letter`)}
            target='_blank'
            rel='noreferrer'
            className='flex items-center gap-1.5 text-primary text-sm hover:underline'
          >
            <FileText className='size-4' />
            View sanction letter
          </a>
        )}
      </div>
    </form>
  );
}

function CamSection({
  leadId,
  userType,
  appliedLoanAmount,
}: {
  leadId: number;
  userType: LeadUserType;
  appliedLoanAmount: number | null;
}) {
  const canEdit = useHasRole('CR2', 'CR3');

  const { data: cam, isLoading } = useQuery({
    queryKey: ['cam', leadId],
    queryFn: () => getCam(leadId),
  });

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className='flex items-center justify-between'>
        <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
          Credit analysis memo
        </h2>
        {cam && cam.status !== null && (
          <Badge variant={CAM_STATUS_VARIANT[cam.status]}>
            {CAM_STATUS_LABEL[cam.status]}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className='flex h-20 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : canEdit ? (
        <CamForm
          key={cam?.id ?? 'new'}
          leadId={leadId}
          cam={cam ?? null}
          userType={userType}
          appliedLoanAmount={appliedLoanAmount}
        />
      ) : cam ? (
        <CamReadOnlyView leadId={leadId} cam={cam} />
      ) : (
        <p className='text-foreground/50 text-sm'>No CAM yet.</p>
      )}
    </div>
  );
}

const BRE_DECISION_VARIANT: Record<
  BreDecisionOrNone,
  'muted' | 'success' | 'destructive' | 'warning'
> = {
  0: 'muted',
  1: 'success',
  2: 'warning',
  3: 'destructive',
};

const BRE_DECISIONS: BreDecision[] = [1, 2, 3];

function BreResultRow({
  leadId,
  result,
  canOverride,
}: {
  leadId: number;
  result: BreRuleResult;
  canOverride: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<string>(
    result.manualDecision ? String(result.manualDecision) : '',
  );
  const [remarks, setRemarks] = useState(result.manualDecisionRemarks ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      setBreManualDecision(leadId, result.id, {
        manualDecision: Number(decision) as BreDecision,
        manualDecisionRemarks: remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bre-results', leadId] });
      toast({ title: 'Decision overridden' });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Could not override decision',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className='flex flex-col gap-2 border-border/60 border-b py-2.5 last:border-0'>
      <div className='flex items-center justify-between'>
        <div className='flex flex-col'>
          <span className='font-medium text-sm'>{result.rule.name}</span>
          <span className='text-foreground/50 text-xs'>
            {result.rule.category.name}
            {result.cutoffValue && ` · cutoff ${result.cutoffValue}`}
            {result.actualValue && ` · actual ${result.actualValue}`}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant={BRE_DECISION_VARIANT[result.systemDecision]}>
            {BRE_DECISION_LABEL[result.systemDecision]}
          </Badge>
          {result.manualDecision !== 0 && (
            <Badge variant={BRE_DECISION_VARIANT[result.manualDecision]}>
              override: {BRE_DECISION_LABEL[result.manualDecision]}
            </Badge>
          )}
          {canOverride && (
            <Button
              type='ghost'
              size='sm'
              htmlType='button'
              onClick={() => setOpen((o) => !o)}
            >
              Override
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className='flex flex-wrap items-center gap-2 rounded-md bg-muted p-2'>
          <Select value={decision} onValueChange={setDecision}>
            <SelectTrigger className='w-40'>
              <SelectValue placeholder='Decision' />
            </SelectTrigger>
            <SelectContent>
              {BRE_DECISIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {BRE_DECISION_LABEL[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder='Remarks (optional)'
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            className='flex-1'
          />
          <Button
            type='primary'
            size='sm'
            htmlType='button'
            disabled={!decision || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}

function BreResultsSection({ leadId }: { leadId: number }) {
  // Confirmed against legacy: neither the old controller nor the current
  // backend endpoint gates this beyond requiring a logged-in session.
  const canOverride = true;
  const queryClient = useQueryClient();
  const { data: results, isLoading } = useQuery({
    queryKey: ['bre-results', leadId],
    queryFn: () => listBreResults(leadId),
  });

  const runMutation = useMutation({
    mutationFn: () => runBre(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bre-results', leadId] });
      toast({ title: 'BRE rule engine run' });
    },
    onError: (error) => {
      toast({
        title: 'Could not run BRE',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-1 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className='mb-2 flex items-center justify-between'>
        <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
          BRE results
        </h2>
        <Button
          type='secondary'
          size='sm'
          htmlType='button'
          disabled={runMutation.isPending}
          onClick={() => runMutation.mutate()}
        >
          {runMutation.isPending ? <Spinner size='sm' /> : 'Run BRE'}
        </Button>
      </div>
      {isLoading ? (
        <div className='flex h-16 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : results?.length ? (
        results.map((result) => (
          <BreResultRow
            key={result.id}
            leadId={leadId}
            result={result}
            canOverride={canOverride}
          />
        ))
      ) : (
        <p className='text-foreground/50 text-sm'>
          No BRE results recorded for this lead.
        </p>
      )}
    </div>
  );
}

function CamPage() {
  const { leadId } = Route.useParams();
  const id = Number(leadId);
  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => getLead(id),
  });

  if (isLoading || !lead) {
    return (
      <div className='flex h-40 items-center justify-center'>
        <Spinner className='text-primary' />
      </div>
    );
  }

  return (
    <>
      <CamSection
        leadId={id}
        userType={lead.userType}
        appliedLoanAmount={lead.loanAmount}
      />
      <BreResultsSection leadId={id} />
    </>
  );
}
