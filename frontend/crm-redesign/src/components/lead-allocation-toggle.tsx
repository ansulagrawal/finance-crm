import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDot } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  declareLeadAllocation,
  getTodayLeadAllocation,
  LEAD_ALLOCATION_CASE_TYPE,
  LEAD_ALLOCATION_STATUS,
  type LeadAllocationCaseType,
  type LeadAllocationStatus,
} from '@/lib/lead-allocation';
import { useHasRole } from '@/lib/roles';

const STATUS_LABEL: Record<LeadAllocationStatus, string> = {
  [LEAD_ALLOCATION_STATUS.ACTIVE]: 'Active',
  [LEAD_ALLOCATION_STATUS.INACTIVE]: 'Inactive',
};

const CASE_TYPE_LABEL: Record<LeadAllocationCaseType, string> = {
  [LEAD_ALLOCATION_CASE_TYPE.FRESH]: 'Fresh',
  [LEAD_ALLOCATION_CASE_TYPE.REPEAT]: 'Repeat',
};

/**
 * The daily "I'm active today, fresh or repeat cases" self-declaration a
 * CR1/CR2 user makes. Surfaced in the header so a screener/credit-manager
 * sees it every day without having to navigate anywhere.
 */
export function LeadAllocationToggle() {
  const canDeclare = useHasRole('CR1', 'CR2');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [userStatus, setUserStatus] = useState<LeadAllocationStatus>(
    LEAD_ALLOCATION_STATUS.ACTIVE,
  );
  const [userCaseType, setUserCaseType] = useState<LeadAllocationCaseType>(
    LEAD_ALLOCATION_CASE_TYPE.FRESH,
  );

  const { data: today } = useQuery({
    queryKey: ['lead-allocation-today'],
    queryFn: getTodayLeadAllocation,
    enabled: canDeclare,
  });

  const mutation = useMutation({
    mutationFn: () => declareLeadAllocation({ userStatus, userCaseType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-allocation-today'] });
      toast({ title: "Today's status saved" });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Could not save',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  if (!canDeclare) return null;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setUserStatus(today?.userStatus ?? LEAD_ALLOCATION_STATUS.ACTIVE);
          setUserCaseType(
            today?.userCaseType ?? LEAD_ALLOCATION_CASE_TYPE.FRESH,
          );
        }
      }}
    >
      <ModalTrigger asChild>
        <Button type='secondary' className='gap-2'>
          <CircleDot className='size-4' />
          {today
            ? `Today: ${STATUS_LABEL[today.userStatus]} · ${CASE_TYPE_LABEL[today.userCaseType]}`
            : "Set today's status"}
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Lead allocation status</ModalTitle>
          <ModalDescription>
            Declare whether you're active today and which case type you're
            taking, so today's allocation is counted correctly.
          </ModalDescription>
        </ModalHeader>

        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1'>
            <Select
              value={String(userStatus)}
              onValueChange={(next) =>
                setUserStatus(Number(next) as LeadAllocationStatus)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex flex-col gap-1'>
            <Select
              value={String(userCaseType)}
              onValueChange={(next) =>
                setUserCaseType(Number(next) as LeadAllocationCaseType)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='Case type' />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CASE_TYPE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ModalFooter>
          <Button
            type='primary'
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
