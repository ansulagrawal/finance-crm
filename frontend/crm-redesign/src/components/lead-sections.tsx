import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { verifyDomain, verifyEmail } from '@/lib/integrations';
import {
  addReference,
  type Gender,
  getCustomer,
  getEmployment,
  type IncomeType,
  listReferences,
  removeReference,
  upsertCustomer,
  upsertEmployment,
} from '@/lib/leads';
import {
  listCitiesByState,
  listMaritalStatuses,
  listQualifications,
  listReligions,
  listStates,
} from '@/lib/lookups';

const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER'];
const INCOME_TYPES: IncomeType[] = ['SALARIED', 'SELF_EMPLOYED'];

/** Customer (KYC), Employment, and References editors for a lead — `PUT`/
 * `POST` against the lead's own sub-resources, independent of lead creation
 * itself (no atomic multi-step transaction on the backend). Shared between
 * the lead detail page (post-creation editing) and the new-lead intake
 * wizard (`routes/index.tsx`). */
function EmailVerificationRow({
  leadId,
  label,
  email,
  isPersonalEmail,
}: {
  leadId: number;
  label: string;
  email: string;
  isPersonalEmail: boolean;
}) {
  const domainMutation = useMutation({
    mutationFn: () => verifyDomain({ leadId, email }),
    onError: (error) => {
      toast({
        title: 'Domain verification failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const emailMutation = useMutation({
    mutationFn: () => verifyEmail({ leadId, email, isPersonalEmail }),
    onError: (error) => {
      toast({
        title: 'Email verification failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className='flex flex-wrap items-center gap-2 border-border/60 border-t pt-2'>
      <span className='text-sm'>
        {label}: <span className='text-foreground/60'>{email}</span>
      </span>
      <Button
        type='secondary'
        size='sm'
        htmlType='button'
        disabled={domainMutation.isPending}
        onClick={() => domainMutation.mutate()}
      >
        {domainMutation.isPending ? <Spinner size='sm' /> : 'Verify domain'}
      </Button>
      <Button
        type='secondary'
        size='sm'
        htmlType='button'
        disabled={emailMutation.isPending}
        onClick={() => emailMutation.mutate()}
      >
        {emailMutation.isPending ? <Spinner size='sm' /> : 'Verify email'}
      </Button>
      {domainMutation.data && (
        <Badge
          variant={
            domainMutation.data.status === 'SUCCESS' ? 'success' : 'destructive'
          }
        >
          Domain: {domainMutation.data.domain ?? domainMutation.data.status}
        </Badge>
      )}
      {emailMutation.data && (
        <Badge
          variant={
            emailMutation.data.isValid === true
              ? 'success'
              : emailMutation.data.isValid === false
                ? 'destructive'
                : 'muted'
          }
        >
          Email:{' '}
          {emailMutation.data.isValid === null
            ? emailMutation.data.status
            : emailMutation.data.isValid
              ? 'Valid'
              : 'Invalid'}
        </Badge>
      )}
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        {title}
      </h2>
      {children}
    </div>
  );
}

export function CustomerSection({ leadId }: { leadId: number }) {
  const queryClient = useQueryClient();
  const { data: customer, isLoading } = useQuery({
    queryKey: ['lead-customer', leadId],
    queryFn: () => getCustomer(leadId),
  });
  const { data: states } = useQuery({
    queryKey: ['states'],
    queryFn: listStates,
  });
  const { data: maritalStatuses } = useQuery({
    queryKey: ['marital-statuses'],
    queryFn: listMaritalStatuses,
  });
  const { data: qualifications } = useQuery({
    queryKey: ['qualifications'],
    queryFn: listQualifications,
  });
  const { data: religions } = useQuery({
    queryKey: ['religions'],
    queryFn: listReligions,
  });

  const [stateId, setStateId] = useState(
    customer?.state?.id ? String(customer.state.id) : '',
  );
  const { data: cities } = useQuery({
    queryKey: ['cities', stateId],
    queryFn: () => listCitiesByState(Number(stateId)),
    enabled: !!stateId,
  });

  const saveMutation = useMutation({
    mutationFn: (dto: Parameters<typeof upsertCustomer>[1]) =>
      upsertCustomer(leadId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-customer', leadId] });
      toast({ title: 'Customer details saved' });
    },
    onError: (error) => {
      toast({
        title: 'Could not save customer details',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const form = useForm({
    defaultValues: {
      firstName: customer?.firstName ?? '',
      middleName: customer?.middleName ?? '',
      surName: customer?.surName ?? '',
      fatherName: customer?.fatherName ?? '',
      gender: customer?.gender ?? '',
      dob: customer?.dob ?? '',
      mobile: customer?.mobile ?? '',
      email: customer?.email ?? '',
      pancard: customer?.pancard ?? '',
      aadhaarNumber: customer?.aadhaarNumber ?? '',
      currentAddressLine1: customer?.currentAddressLine1 ?? '',
      pincode: customer?.pincode ?? '',
      cityId: customer?.city?.id ? String(customer.city.id) : '',
      maritalStatusId: customer?.maritalStatus?.id
        ? String(customer.maritalStatus.id)
        : '',
      qualificationId: customer?.qualification?.id
        ? String(customer.qualification.id)
        : '',
      religionId: customer?.religion?.id ? String(customer.religion.id) : '',
    },
    onSubmit: ({ value }) => {
      saveMutation.mutate({
        firstName: value.firstName || undefined,
        middleName: value.middleName || undefined,
        surName: value.surName || undefined,
        fatherName: value.fatherName || undefined,
        gender: (value.gender || undefined) as Gender | undefined,
        dob: value.dob || undefined,
        mobile: value.mobile || undefined,
        email: value.email || undefined,
        pancard: value.pancard || undefined,
        aadhaarNumber: value.aadhaarNumber || undefined,
        currentAddressLine1: value.currentAddressLine1 || undefined,
        pincode: value.pincode || undefined,
        stateId: stateId ? Number(stateId) : undefined,
        cityId: value.cityId ? Number(value.cityId) : undefined,
        maritalStatusId: value.maritalStatusId
          ? Number(value.maritalStatusId)
          : undefined,
        qualificationId: value.qualificationId
          ? Number(value.qualificationId)
          : undefined,
        religionId: value.religionId ? Number(value.religionId) : undefined,
      });
    },
  });

  return (
    <SectionCard title='Customer (KYC)'>
      {isLoading ? (
        <div className='flex h-20 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className='flex flex-col gap-3'
        >
          <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
            <form.Field name='firstName'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>First name</Label>
                  <Input
                    placeholder='e.g. Ramesh'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='surName'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Surname</Label>
                  <Input
                    placeholder='e.g. Kumar'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='fatherName'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Father's name</Label>
                  <Input
                    placeholder='e.g. Suresh Kumar'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='gender'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Gender</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select' />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
            <form.Field name='dob'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Date of birth</Label>
                  <DatePicker
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='mobile'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Mobile</Label>
                  <Input
                    placeholder='10-digit mobile number'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='email'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Email</Label>
                  <Input
                    placeholder='name@example.com'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='pancard'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>PAN</Label>
                  <Input
                    placeholder='ABCDE1234F'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='aadhaarNumber'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Aadhaar</Label>
                  <Input
                    placeholder='12-digit Aadhaar number'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='currentAddressLine1'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Address</Label>
                  <Input
                    placeholder='House, street, area'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='pincode'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Pincode</Label>
                  <Input
                    placeholder='6-digit pincode'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <div className='flex flex-col gap-1'>
              <Label>State</Label>
              <Select value={stateId} onValueChange={setStateId}>
                <SelectTrigger>
                  <SelectValue placeholder='Select' />
                </SelectTrigger>
                <SelectContent>
                  {states?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <form.Field name='cityId'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>City</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    disabled={!stateId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select' />
                    </SelectTrigger>
                    <SelectContent>
                      {cities?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
            <form.Field name='maritalStatusId'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Marital status</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select' />
                    </SelectTrigger>
                    <SelectContent>
                      {maritalStatuses?.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
            <form.Field name='qualificationId'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Qualification</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select' />
                    </SelectTrigger>
                    <SelectContent>
                      {qualifications?.map((q) => (
                        <SelectItem key={q.id} value={String(q.id)}>
                          {q.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
            <form.Field name='religionId'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Religion</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select' />
                    </SelectTrigger>
                    <SelectContent>
                      {religions?.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          </div>
          <div>
            <Button
              type='primary'
              size='sm'
              htmlType='submit'
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Spinner size='sm' /> : 'Save'}
            </Button>
          </div>
          {customer?.email && (
            <EmailVerificationRow
              leadId={leadId}
              label='Personal email'
              email={customer.email}
              isPersonalEmail={true}
            />
          )}
          {customer?.alternateEmail && (
            <EmailVerificationRow
              leadId={leadId}
              label='Office email'
              email={customer.alternateEmail}
              isPersonalEmail={false}
            />
          )}
        </form>
      )}
    </SectionCard>
  );
}

export function EmploymentSection({ leadId }: { leadId: number }) {
  const queryClient = useQueryClient();
  const { data: employment, isLoading } = useQuery({
    queryKey: ['lead-employment', leadId],
    queryFn: () => getEmployment(leadId),
  });

  const saveMutation = useMutation({
    mutationFn: (dto: Parameters<typeof upsertEmployment>[1]) =>
      upsertEmployment(leadId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-employment', leadId] });
      toast({ title: 'Employment details saved' });
    },
    onError: (error) => {
      toast({
        title: 'Could not save employment details',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const form = useForm({
    defaultValues: {
      incomeType: employment?.incomeType ?? 'SALARIED',
      monthlyIncome: employment?.monthlyIncome
        ? Number(employment.monthlyIncome)
        : 0,
      employerName: employment?.employerName ?? '',
      designation: employment?.designation ?? '',
      employerType: employment?.employerType ?? '',
      addressLine1: employment?.addressLine1 ?? '',
      pincode: employment?.pincode ?? '',
    },
    onSubmit: ({ value }) => {
      saveMutation.mutate({
        incomeType: value.incomeType as IncomeType,
        monthlyIncome: value.monthlyIncome || undefined,
        employerName: value.employerName || undefined,
        designation: value.designation || undefined,
        employerType: value.employerType || undefined,
        addressLine1: value.addressLine1 || undefined,
        pincode: value.pincode || undefined,
      });
    },
  });

  return (
    <SectionCard title='Employment'>
      {isLoading ? (
        <div className='flex h-20 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className='flex flex-col gap-3'
        >
          <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
            <form.Field name='incomeType'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Income type</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as IncomeType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select income type' />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOME_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
            <form.Field name='monthlyIncome'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Monthly income</Label>
                  <NumberInput
                    value={field.state.value}
                    onChange={field.handleChange}
                    min={0}
                    step={500}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='employerName'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Employer name</Label>
                  <Input
                    placeholder='e.g. Infosys Ltd'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='designation'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Designation</Label>
                  <Input
                    placeholder='e.g. Senior Executive'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='employerType'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Employer type</Label>
                  <Input
                    placeholder='e.g. Private limited'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='addressLine1'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Employer address</Label>
                  <Input
                    placeholder='Office address'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='pincode'>
              {(field) => (
                <div className='flex flex-col gap-1'>
                  <Label>Pincode</Label>
                  <Input
                    placeholder='6-digit pincode'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
          </div>
          <div>
            <Button
              type='primary'
              size='sm'
              htmlType='submit'
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Spinner size='sm' /> : 'Save'}
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

export function ReferencesSection({ leadId }: { leadId: number }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [relationType, setRelationType] = useState('');

  const { data: references, isLoading } = useQuery({
    queryKey: ['lead-references', leadId],
    queryFn: () => listReferences(leadId),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      addReference(leadId, {
        name: name.trim(),
        mobile: mobile.trim(),
        relationType: relationType.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-references', leadId] });
      setName('');
      setMobile('');
      setRelationType('');
      toast({ title: 'Reference added' });
    },
    onError: (error) => {
      toast({
        title: 'Could not add reference',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (referenceId: number) => removeReference(leadId, referenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-references', leadId] });
      toast({ title: 'Reference removed' });
    },
    onError: (error) => {
      toast({
        title: 'Could not remove reference',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <SectionCard title='References'>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && mobile.trim()) addMutation.mutate();
        }}
        className='flex flex-wrap gap-2'
      >
        <Input
          placeholder='Name'
          value={name}
          onChange={(e) => setName(e.target.value)}
          className='flex-1'
        />
        <Input
          placeholder='Mobile'
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className='w-40'
        />
        <Input
          placeholder='Relation (optional)'
          value={relationType}
          onChange={(e) => setRelationType(e.target.value)}
          className='w-40'
        />
        <Button
          type='primary'
          htmlType='submit'
          disabled={!name.trim() || !mobile.trim() || addMutation.isPending}
        >
          Add
        </Button>
      </form>
      {isLoading ? (
        <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
      ) : references?.length ? (
        <Table containerClassName='max-h-80 overflow-y-auto'>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Relation</TableHead>
              <TableHead className='w-10' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {references.map((r) => (
              <TableRow key={r.id}>
                <TableCell className='font-medium'>{r.name}</TableCell>
                <TableCell className='text-foreground/60'>{r.mobile}</TableCell>
                <TableCell className='text-foreground/60'>
                  {r.relationType ?? '—'}
                </TableCell>
                <TableCell>
                  <button
                    type='button'
                    aria-label={`Remove ${r.name}`}
                    onClick={() => removeMutation.mutate(r.id)}
                    className='text-destructive/70 hover:text-destructive'
                  >
                    <Trash2 className='size-4' />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className='py-2 text-foreground/50 text-sm'>No references yet.</p>
      )}
    </SectionCard>
  );
}
