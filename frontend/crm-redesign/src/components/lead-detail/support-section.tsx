import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCog } from 'lucide-react';
import { useState } from 'react';
import { STAGE_LABEL, STAGE_ROLE } from '@/components/lead-detail/shared';
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
import { ApiError } from '@/lib/api';
import type { Gender, IncomeType, LeadAssignmentStage } from '@/lib/leads';
import { listUsersByRole } from '@/lib/lookups';
import { useHasRole } from '@/lib/roles';
import {
  overrideAllocation,
  overrideBankDetail,
  overrideCamDetail,
  overrideEmploymentDetail,
  overridePersonalDetail,
  resetAccountAggregator,
  resetEkyc,
  resetEsign,
} from '@/lib/support';

function SupportResetCard({
  leadId,
  title,
  description,
  action,
  successTitle,
}: {
  leadId: number;
  title: string;
  description: string;
  action: (leadId: number) => Promise<void>;
  successTitle: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => action(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: successTitle });
    },
    onError: (error) => {
      toast({
        title: 'Reset failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div
      className='flex flex-col gap-2 rounded-lg border border-border bg-white p-4'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h3 className='font-medium text-sm'>{title}</h3>
      <p className='text-foreground/50 text-xs'>{description}</p>
      <Button
        type='secondary'
        size='sm'
        htmlType='button'
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className='self-start'
      >
        {mutation.isPending ? <Spinner size='sm' /> : 'Reset'}
      </Button>
    </div>
  );
}

function SupportAllocationAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<LeadAssignmentStage | ''>('');
  const [userId, setUserId] = useState('');
  const [remarks, setRemarks] = useState('');
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['users-by-role', stage],
    queryFn: () => listUsersByRole(STAGE_ROLE[stage as LeadAssignmentStage]),
    enabled: Boolean(stage),
  });

  const mutation = useMutation({
    mutationFn: () =>
      overrideAllocation(leadId, {
        stage: stage as LeadAssignmentStage,
        userId: Number(userId),
        remarks: remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'Allocation overridden' });
      setOpen(false);
      setStage('');
      setUserId('');
      setRemarks('');
    },
    onError: (error) => {
      toast({
        title: 'Override failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          <UserCog className='size-4' />
          Override allocation
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Override allocation</ModalTitle>
          <ModalDescription>
            Reassign ownership outside the normal workflow, bypassing the usual
            stage/role rules. Also clears any rejection metadata on this lead.
          </ModalDescription>
        </ModalHeader>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>Stage</Label>
            <Select
              value={stage}
              onValueChange={(value) => {
                setStage(value as LeadAssignmentStage);
                setUserId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select a stage' />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STAGE_LABEL) as LeadAssignmentStage[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {STAGE_LABEL[key]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Assign to</Label>
            <Select value={userId} onValueChange={setUserId} disabled={!stage}>
              <SelectTrigger>
                <SelectValue placeholder='Select a user' />
              </SelectTrigger>
              <SelectContent>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={2}
              placeholder='Optional'
            />
          </div>
        </div>
        <ModalFooter>
          <ModalClose asChild>
            <Button type='secondary' htmlType='button'>
              Cancel
            </Button>
          </ModalClose>
          <Button
            type='primary'
            disabled={!stage || !userId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function SupportPersonalOverrideAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [surName, setSurName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [pancard, setPancard] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const queryClient = useQueryClient();

  const reset = () => {
    setFirstName('');
    setSurName('');
    setMobile('');
    setEmail('');
    setPancard('');
    setAadhaarNumber('');
    setDob('');
    setGender('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      overridePersonalDetail(leadId, {
        firstName: firstName || undefined,
        surName: surName || undefined,
        mobile: mobile || undefined,
        email: email || undefined,
        pancard: pancard || undefined,
        aadhaarNumber: aadhaarNumber || undefined,
        dob: dob || undefined,
        gender: gender || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-customer', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'Personal detail overridden' });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast({
        title: 'Override failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          Override personal detail
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Override personal detail</ModalTitle>
          <ModalDescription>
            Only fields filled in below are changed — leave the rest blank. For
            full-field edits, use the Customer (KYC) section instead.
          </ModalDescription>
        </ModalHeader>
        <div className='grid grid-cols-2 gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>First name</Label>
            <Input
              placeholder='e.g. Ramesh'
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Surname</Label>
            <Input
              placeholder='e.g. Kumar'
              value={surName}
              onChange={(e) => setSurName(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Mobile</Label>
            <Input
              placeholder='10-digit mobile number'
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Email</Label>
            <Input
              placeholder='name@example.com'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>PAN</Label>
            <Input
              placeholder='ABCDE1234F'
              value={pancard}
              onChange={(e) => setPancard(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Aadhaar</Label>
            <Input
              placeholder='12-digit Aadhaar number'
              value={aadhaarNumber}
              onChange={(e) => setAadhaarNumber(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Date of birth</Label>
            <DatePicker value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Gender</Label>
            <Select
              value={gender}
              onValueChange={(value) => setGender(value as Gender)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select' />
              </SelectTrigger>
              <SelectContent>
                {(['MALE', 'FEMALE', 'OTHER'] as Gender[]).map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ModalFooter>
          <ModalClose asChild>
            <Button type='secondary' htmlType='button'>
              Cancel
            </Button>
          </ModalClose>
          <Button
            type='primary'
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function SupportEmploymentOverrideAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [incomeType, setIncomeType] = useState<IncomeType | ''>('');
  const [monthlyIncome, setMonthlyIncome] = useState<number | undefined>();
  const [employerName, setEmployerName] = useState('');
  const [designation, setDesignation] = useState('');
  const [salaryMode, setSalaryMode] = useState('');
  const queryClient = useQueryClient();

  const reset = () => {
    setIncomeType('');
    setMonthlyIncome(undefined);
    setEmployerName('');
    setDesignation('');
    setSalaryMode('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      overrideEmploymentDetail(leadId, {
        incomeType: incomeType as 'SALARIED' | 'SELF_EMPLOYED',
        monthlyIncome,
        employerName: employerName || undefined,
        designation: designation || undefined,
        salaryMode: salaryMode || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-employment', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'Employment detail overridden' });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast({
        title: 'Override failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          Override employment detail
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Override employment detail</ModalTitle>
          <ModalDescription>
            Income type is required; leave other fields blank to leave them
            unchanged. For full-field edits, use the Employment section instead.
          </ModalDescription>
        </ModalHeader>
        <div className='grid grid-cols-2 gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>Income type</Label>
            <Select
              value={incomeType}
              onValueChange={(value) => setIncomeType(value as IncomeType)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='SALARIED'>Salaried</SelectItem>
                <SelectItem value='SELF_EMPLOYED'>Self employed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Monthly income</Label>
            <NumberInput
              value={monthlyIncome ?? 0}
              onChange={setMonthlyIncome}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Employer name</Label>
            <Input
              placeholder='e.g. Infosys Ltd'
              value={employerName}
              onChange={(e) => setEmployerName(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Designation</Label>
            <Input
              placeholder='e.g. Senior Executive'
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Salary mode</Label>
            <Input
              placeholder='e.g. Bank transfer'
              value={salaryMode}
              onChange={(e) => setSalaryMode(e.target.value)}
            />
          </div>
        </div>
        <ModalFooter>
          <ModalClose asChild>
            <Button type='secondary' htmlType='button'>
              Cancel
            </Button>
          </ModalClose>
          <Button
            type='primary'
            disabled={!incomeType || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function SupportBankOverrideAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [branch, setBranch] = useState('');
  const queryClient = useQueryClient();

  const reset = () => {
    setBankName('');
    setIfscCode('');
    setAccountNumber('');
    setConfirmAccountNumber('');
    setBeneficiaryName('');
    setBranch('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      overrideBankDetail(leadId, {
        bankName,
        ifscCode,
        accountNumber,
        confirmAccountNumber,
        beneficiaryName,
        branch: branch || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-banking', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'Bank detail added' });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast({
        title: 'Override failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const valid =
    bankName.trim() &&
    ifscCode.trim() &&
    accountNumber.trim() &&
    confirmAccountNumber.trim() === accountNumber.trim() &&
    beneficiaryName.trim();

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          Override bank detail
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add/correct bank detail</ModalTitle>
          <ModalDescription>
            Adds a new banking record for this lead, same as the Verification
            section's banking form.
          </ModalDescription>
        </ModalHeader>
        <div className='grid grid-cols-2 gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>Bank name</Label>
            <Input
              placeholder='e.g. HDFC Bank'
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>IFSC code</Label>
            <Input
              placeholder='e.g. HDFC0001234'
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Account number</Label>
            <Input
              placeholder='Bank account number'
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Confirm account number</Label>
            <Input
              placeholder='Re-enter the account number'
              value={confirmAccountNumber}
              onChange={(e) => setConfirmAccountNumber(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Beneficiary name</Label>
            <Input
              placeholder='Name as per bank records'
              value={beneficiaryName}
              onChange={(e) => setBeneficiaryName(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Branch</Label>
            <Input
              placeholder='e.g. Jaipur Main'
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>
        </div>
        {accountNumber.trim() &&
          confirmAccountNumber.trim() &&
          accountNumber.trim() !== confirmAccountNumber.trim() && (
            <p className='text-destructive text-xs'>
              Account numbers don't match.
            </p>
          )}
        <ModalFooter>
          <ModalClose asChild>
            <Button type='secondary' htmlType='button'>
              Cancel
            </Button>
          </ModalClose>
          <Button
            type='primary'
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function SupportCamOverrideAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [recommendedLoanAmount, setRecommendedLoanAmount] = useState(0);
  const [roi, setRoi] = useState(0);
  const [tenureDays, setTenureDays] = useState(0);
  const [netDisbursalAmount, setNetDisbursalAmount] = useState(0);
  const [repaymentAmount, setRepaymentAmount] = useState(0);
  const [appraisedMonthlyIncome, setAppraisedMonthlyIncome] = useState(0);
  const [appraisedObligations, setAppraisedObligations] = useState(0);
  const [remarks, setRemarks] = useState('');
  const queryClient = useQueryClient();

  const reset = () => {
    setRecommendedLoanAmount(0);
    setRoi(0);
    setTenureDays(0);
    setNetDisbursalAmount(0);
    setRepaymentAmount(0);
    setAppraisedMonthlyIncome(0);
    setAppraisedObligations(0);
    setRemarks('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      overrideCamDetail(leadId, {
        recommendedLoanAmount,
        roi,
        tenureDays,
        netDisbursalAmount,
        repaymentAmount,
        appraisedMonthlyIncome,
        appraisedObligations,
        remarks: remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-cam', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'CAM detail overridden' });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast({
        title: 'Override failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          Override CAM detail
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Override CAM detail</ModalTitle>
          <ModalDescription>
            Overwrites the full CAM record (same required fields as the CAM
            section). For fee/FOIR/risk fields, use the CAM section instead.
          </ModalDescription>
        </ModalHeader>
        <div className='grid grid-cols-2 gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>Recommended loan amount</Label>
            <NumberInput
              value={recommendedLoanAmount}
              onChange={setRecommendedLoanAmount}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>ROI (%)</Label>
            <NumberInput value={roi} onChange={setRoi} />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Tenure (days)</Label>
            <NumberInput value={tenureDays} onChange={setTenureDays} />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Net disbursal amount</Label>
            <NumberInput
              value={netDisbursalAmount}
              onChange={setNetDisbursalAmount}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Repayment amount</Label>
            <NumberInput
              value={repaymentAmount}
              onChange={setRepaymentAmount}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Appraised monthly income</Label>
            <NumberInput
              value={appraisedMonthlyIncome}
              onChange={setAppraisedMonthlyIncome}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Appraised obligations</Label>
            <NumberInput
              value={appraisedObligations}
              onChange={setAppraisedObligations}
            />
          </div>
          <div className='col-span-2 flex flex-col gap-1'>
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder='Optional'
            />
          </div>
        </div>
        <ModalFooter>
          <ModalClose asChild>
            <Button type='secondary' htmlType='button'>
              Cancel
            </Button>
          </ModalClose>
          <Button
            type='primary'
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function SupportSection({ leadId }: { leadId: number }) {
  // Legacy grants `ST` (Support Tech) the eKYC/eSign resets specifically,
  // not the rest of this toolkit — see `support.controller.ts`'s
  // `@Roles('ST')` overrides on just those two endpoints.
  const canUse = useHasRole('SA', 'CA', 'ST');
  const canOverride = useHasRole('SA', 'CA');
  if (!canUse) return null;

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-4 rounded-lg border border-warning/40 bg-warning/5 p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div>
        <h2 className='font-display font-semibold text-lg text-primary'>
          Support toolkit — fix a stuck lead
        </h2>
        <p className='text-foreground/60 text-xs'>
          Ops-only overrides that bypass the normal per-stage workflow. Every
          write here is logged as a followup on this lead. Overrides other than
          the resets below only work while the lead is active and not yet
          disbursed.
        </p>
      </div>
      <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
        <SupportResetCard
          leadId={leadId}
          title='Reset eKYC link'
          description='Deactivates the latest eKYC log so the customer can restart it.'
          action={resetEkyc}
          successTitle='eKYC link reset'
        />
        <SupportResetCard
          leadId={leadId}
          title='Reset eSign link'
          description='Deactivates the latest eSign log so the customer can restart it.'
          action={resetEsign}
          successTitle='eSign link reset'
        />
        {canOverride && (
          <SupportResetCard
            leadId={leadId}
            title='Reset Account Aggregator consent'
            description='Deactivates the latest AA consent so the customer can restart it.'
            action={resetAccountAggregator}
            successTitle='AA consent reset'
          />
        )}
      </div>
      {canOverride && (
        <div className='flex flex-wrap gap-2'>
          <SupportAllocationAction leadId={leadId} />
          <SupportPersonalOverrideAction leadId={leadId} />
          <SupportEmploymentOverrideAction leadId={leadId} />
          <SupportBankOverrideAction leadId={leadId} />
          <SupportCamOverrideAction leadId={leadId} />
        </div>
      )}
    </div>
  );
}
