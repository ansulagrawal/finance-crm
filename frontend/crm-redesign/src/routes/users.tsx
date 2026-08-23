import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DataTable } from '@/components/ui/data-table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  type Branch,
  listBranches,
  listCitiesByStateAdmin,
  listStatesAdmin,
} from '@/lib/company-geography';
import { listRoleTypes } from '@/lib/lookups';
import { useHasRole } from '@/lib/roles';
import {
  activateUser,
  assignUserRole,
  type CreateUserInput,
  createUser,
  createUserRoleLocation,
  deactivateUser,
  listUserRoleLocations,
  listUserRoles,
  listUsers,
  removeUserRole,
  removeUserRoleLocation,
  USER_ROLE_LOCATION_TYPE,
  USER_ROLE_LOCATION_TYPE_LABEL,
  type User,
  type UserRoleAssignment,
  type UserRoleLocation,
  type UserRoleLocationType,
  unlockUser,
  updateUserRole,
} from '@/lib/users';

export const Route = createFileRoute('/users')({
  component: UsersPage,
});

/** Backend's `UserRole.level` accepts only these four string codes. */
const ROLE_LEVELS = ['L1', 'L2', 'L3', 'L4'] as const;

function onMutationError(error: unknown, title: string) {
  toast({
    title,
    description:
      error instanceof ApiError ? error.message : 'Something went wrong.',
    variant: 'destructive',
  });
}

function NewUserForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateUserInput>({
    name: '',
    email: '',
    password: '',
    mobile: '',
  });

  const mutation = useMutation({
    mutationFn: () => createUser(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User created' });
      onSuccess();
    },
    onError: (error) => onMutationError(error, 'Could not create user'),
  });

  const mobileDigits = (form.mobile ?? '').trim();
  const mobileValid = /^\d{10}$/.test(mobileDigits);
  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.password.trim().length >= 8 &&
    mobileValid;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
      className='flex flex-col gap-3'
    >
      <div className='flex flex-col gap-1'>
        <Label>Name</Label>
        <Input
          placeholder='Full name'
          value={form.name}
          onChange={(event) =>
            setForm((f) => ({ ...f, name: event.target.value }))
          }
        />
      </div>
      <div className='flex flex-col gap-1'>
        <Label>Email</Label>
        <Input
          placeholder='name@example.com'
          type='email'
          value={form.email}
          onChange={(event) =>
            setForm((f) => ({ ...f, email: event.target.value }))
          }
        />
      </div>
      <div className='flex flex-col gap-1'>
        <Label>Password</Label>
        <Input
          type='password'
          value={form.password}
          onChange={(event) =>
            setForm((f) => ({ ...f, password: event.target.value }))
          }
          placeholder='Min 8 chars, letters + numbers'
        />
      </div>
      <div className='flex flex-col gap-1'>
        <Label>Mobile</Label>
        <Input
          placeholder='10-digit mobile number'
          inputMode='numeric'
          maxLength={10}
          value={form.mobile ?? ''}
          onChange={(event) =>
            setForm((f) => ({
              ...f,
              mobile: event.target.value.replace(/\D/g, '').slice(0, 10),
            }))
          }
        />
        {mobileDigits.length > 0 && !mobileValid && (
          <p className='text-destructive text-xs'>
            Mobile must be exactly 10 digits.
          </p>
        )}
      </div>
      <ModalFooter>
        <Button
          type='primary'
          htmlType='submit'
          disabled={!canSubmit || mutation.isPending}
        >
          {mutation.isPending ? <Spinner size='sm' /> : 'Create user'}
        </Button>
      </ModalFooter>
    </form>
  );
}

/** Picks a supervisor by first searching for the supervising user, then
 * choosing which of that user's role assignments (`UserRole`) is the
 * supervisor — `supervisorRoleId` on the DTO points at a `UserRole`, not a
 * `User`, so a plain user picker isn't enough. */
function SupervisorPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (userRoleId: number | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [supervisorUserId, setSupervisorUserId] = useState('');

  const { data: userResults } = useQuery({
    queryKey: ['users-search', search],
    queryFn: () => listUsers({ search, limit: 10 }),
    enabled: search.trim().length > 1,
  });

  const { data: supervisorRoles } = useQuery({
    queryKey: ['user-roles', supervisorUserId],
    queryFn: () => listUserRoles(Number(supervisorUserId)),
    enabled: !!supervisorUserId,
  });

  return (
    <div className='flex flex-col gap-2'>
      <Combobox
        value={supervisorUserId}
        onValueChange={(next) => {
          setSupervisorUserId(next);
          onChange(null);
        }}
        search={search}
        onSearchChange={setSearch}
        options={
          userResults?.data.map((u) => ({
            value: String(u.id),
            label: u.name,
          })) ?? []
        }
        placeholder='Select their user account'
        searchPlaceholder='Search supervisor by name…'
        emptyText={
          search.trim().length > 1
            ? 'No matching users.'
            : 'Type at least 2 characters…'
        }
        className='h-8 text-xs'
      />
      {supervisorUserId ? (
        <Select
          value={value !== null ? String(value) : ''}
          onValueChange={(next) => onChange(Number(next))}
        >
          <SelectTrigger className='h-8 text-xs'>
            <SelectValue placeholder='Select their role assignment' />
          </SelectTrigger>
          <SelectContent>
            {supervisorRoles?.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.roleType.code} — {r.roleType.name}
                {r.level !== null ? ` (level ${r.level})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

function locationLabel(
  location: UserRoleLocation,
  branches: Branch[] | undefined,
  states: { id: number; name: string }[] | undefined,
): string {
  if (location.locationType === USER_ROLE_LOCATION_TYPE.BRANCH) {
    return (
      branches?.find((b) => b.id === location.locationId)?.name ??
      `Branch #${location.locationId}`
    );
  }
  if (location.locationType === USER_ROLE_LOCATION_TYPE.STATE) {
    return (
      states?.find((s) => s.id === location.locationId)?.name ??
      `State #${location.locationId}`
    );
  }
  return `City #${location.locationId}`;
}

/** Branch/territory scoping for a single role assignment. A role with no
 * scoping rows applies everywhere; each row narrows it to one city, state,
 * or branch. */
function RoleLocationsPanel({ userRoleId }: { userRoleId: number }) {
  const queryClient = useQueryClient();
  const [locationType, setLocationType] = useState('');
  const [stateId, setStateId] = useState('');
  const [locationId, setLocationId] = useState('');

  const { data: locations, isLoading } = useQuery({
    queryKey: ['user-role-locations', userRoleId],
    queryFn: () => listUserRoleLocations(userRoleId),
  });
  const { data: branches } = useQuery({
    queryKey: ['branches-admin'],
    queryFn: listBranches,
  });
  const { data: states } = useQuery({
    queryKey: ['states-admin'],
    queryFn: listStatesAdmin,
  });
  const { data: cities } = useQuery({
    queryKey: ['cities-admin', stateId],
    queryFn: () => listCitiesByStateAdmin(Number(stateId)),
    enabled: Number(locationType) === USER_ROLE_LOCATION_TYPE.CITY && !!stateId,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      createUserRoleLocation(userRoleId, {
        locationType: Number(locationType) as UserRoleLocationType,
        locationId: Number(locationId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['user-role-locations', userRoleId],
      });
      setLocationType('');
      setStateId('');
      setLocationId('');
      toast({ title: 'Location scope added' });
    },
    onError: (error) => onMutationError(error, 'Could not add location scope'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeUserRoleLocation(userRoleId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['user-role-locations', userRoleId],
      });
      toast({ title: 'Location scope removed' });
    },
    onError: (error) =>
      onMutationError(error, 'Could not remove location scope'),
  });

  return (
    <div className='ml-4 flex flex-col gap-2 border-border/40 border-l py-2 pl-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Select
          value={locationType}
          onValueChange={(next) => {
            setLocationType(next);
            setStateId('');
            setLocationId('');
          }}
        >
          <SelectTrigger className='h-8 w-28 text-xs'>
            <SelectValue placeholder='Type' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={String(USER_ROLE_LOCATION_TYPE.BRANCH)}>
              Branch
            </SelectItem>
            <SelectItem value={String(USER_ROLE_LOCATION_TYPE.STATE)}>
              State
            </SelectItem>
            <SelectItem value={String(USER_ROLE_LOCATION_TYPE.CITY)}>
              City
            </SelectItem>
          </SelectContent>
        </Select>
        {Number(locationType) === USER_ROLE_LOCATION_TYPE.BRANCH && (
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className='h-8 flex-1 text-xs'>
              <SelectValue placeholder='Branch' />
            </SelectTrigger>
            <SelectContent>
              {branches?.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {Number(locationType) === USER_ROLE_LOCATION_TYPE.STATE && (
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className='h-8 flex-1 text-xs'>
              <SelectValue placeholder='State' />
            </SelectTrigger>
            <SelectContent>
              {states?.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {Number(locationType) === USER_ROLE_LOCATION_TYPE.CITY && (
          <>
            <Select
              value={stateId}
              onValueChange={(next) => {
                setStateId(next);
                setLocationId('');
              }}
            >
              <SelectTrigger className='h-8 w-32 text-xs'>
                <SelectValue placeholder='State' />
              </SelectTrigger>
              <SelectContent>
                {states?.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={locationId}
              onValueChange={setLocationId}
              disabled={!stateId}
            >
              <SelectTrigger className='h-8 flex-1 text-xs'>
                <SelectValue placeholder='City' />
              </SelectTrigger>
              <SelectContent>
                {cities?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <Button
          type='secondary'
          size='sm'
          htmlType='button'
          disabled={!locationType || !locationId || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          Add scope
        </Button>
      </div>
      <div className='flex flex-col divide-y divide-border/60'>
        {isLoading ? (
          <p className='py-1 text-foreground/40 text-xs'>Loading…</p>
        ) : locations?.length ? (
          locations.map((location) => (
            <div
              key={location.id}
              className='flex items-center justify-between py-1'
            >
              <span className='flex items-center gap-2 text-xs'>
                <Badge variant='muted'>
                  {USER_ROLE_LOCATION_TYPE_LABEL[location.locationType]}
                </Badge>
                {locationLabel(location, branches, states)}
              </span>
              <button
                type='button'
                aria-label={`Remove location scope ${location.id}`}
                onClick={() => removeMutation.mutate(location.id)}
                className='text-destructive/70 hover:text-destructive'
              >
                <Trash2 className='size-3' />
              </button>
            </div>
          ))
        ) : (
          <p className='py-1 text-foreground/40 text-xs'>
            No location scoping — this role applies everywhere.
          </p>
        )}
      </div>
    </div>
  );
}

/** Edits the supervisor/level hierarchy fields on an existing role
 * assignment (`PATCH /users/:id/roles/:userRoleId`). */
function RoleEditForm({
  userId,
  role,
  onDone,
}: {
  userId: number;
  role: UserRoleAssignment;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState(role.level ?? '');
  const [supervisorRoleId, setSupervisorRoleId] = useState<number | null>(
    role.supervisorRole?.id ?? null,
  );

  const updateMutation = useMutation({
    mutationFn: () =>
      updateUserRole(userId, role.id, {
        level: level || undefined,
        supervisorRoleId: supervisorRoleId ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles', userId] });
      toast({ title: 'Role updated' });
      onDone();
    },
    onError: (error) => onMutationError(error, 'Could not update role'),
  });

  return (
    <div className='ml-4 flex flex-col gap-2 border-border/40 border-l py-2 pl-3'>
      <div className='flex items-center gap-2'>
        <Label className='text-xs'>Level</Label>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className='h-8 w-28 text-xs'>
            <SelectValue placeholder='Level' />
          </SelectTrigger>
          <SelectContent>
            {ROLE_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className='flex flex-col gap-1'>
        <Label className='text-xs'>Supervisor</Label>
        <SupervisorPicker
          value={supervisorRoleId}
          onChange={setSupervisorRoleId}
        />
      </div>
      <div className='flex gap-2'>
        <Button
          type='primary'
          size='sm'
          htmlType='button'
          disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate()}
        >
          Save
        </Button>
        <Button type='secondary' size='sm' htmlType='button' onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function UserRolesModal({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [roleTypeId, setRoleTypeId] = useState('');
  const [level, setLevel] = useState('');
  const [supervisorRoleId, setSupervisorRoleId] = useState<number | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [scopingRoleId, setScopingRoleId] = useState<number | null>(null);

  const { data: roles, isLoading } = useQuery({
    queryKey: ['user-roles', user.id],
    queryFn: () => listUserRoles(user.id),
  });
  const { data: roleTypes } = useQuery({
    queryKey: ['role-types'],
    queryFn: listRoleTypes,
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignUserRole(user.id, {
        roleTypeId: Number(roleTypeId),
        level: level || undefined,
        supervisorRoleId: supervisorRoleId ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles', user.id] });
      setRoleTypeId('');
      setLevel('');
      setSupervisorRoleId(null);
      toast({ title: 'Role assigned' });
    },
    onError: (error) => onMutationError(error, 'Could not assign role'),
  });

  const removeMutation = useMutation({
    mutationFn: (userRoleId: number) => removeUserRole(user.id, userRoleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles', user.id] });
      toast({ title: 'Role removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove role'),
  });

  return (
    <ModalContent>
      <ModalHeader>
        <ModalTitle>Roles for {user.name}</ModalTitle>
        <ModalDescription>
          A user can hold multiple roles. Each assignment can have its own
          supervisor, hierarchy level, and branch/territory scope.
        </ModalDescription>
      </ModalHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (roleTypeId) assignMutation.mutate();
        }}
        className='flex flex-col gap-2'
      >
        <div className='flex gap-2'>
          <Select value={roleTypeId} onValueChange={setRoleTypeId}>
            <SelectTrigger className='flex-1'>
              <SelectValue placeholder='Select role' />
            </SelectTrigger>
            <SelectContent>
              {roleTypes?.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.code} — {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className='w-28' aria-label='Level'>
              <SelectValue placeholder='Level' />
            </SelectTrigger>
            <SelectContent>
              {ROLE_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type='primary'
            size='sm'
            htmlType='submit'
            disabled={!roleTypeId || assignMutation.isPending}
          >
            Assign
          </Button>
        </div>
        <div className='flex flex-col gap-1'>
          <Label className='text-xs'>Supervisor (optional)</Label>
          <SupervisorPicker
            value={supervisorRoleId}
            onChange={setSupervisorRoleId}
          />
        </div>
      </form>
      <div className='flex flex-col divide-y divide-border/60'>
        {isLoading ? (
          <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
        ) : roles?.length ? (
          roles.map((r: UserRoleAssignment) => (
            <div key={r.id} className='flex flex-col py-2'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Badge variant='muted'>
                    {r.roleType.code} — {r.roleType.name}
                  </Badge>
                  {r.level !== null && (
                    <span className='text-foreground/50 text-xs'>
                      Level {r.level}
                    </span>
                  )}
                  {r.supervisorRole && (
                    <span className='text-foreground/50 text-xs'>
                      Reports to role #{r.supervisorRole.id}
                    </span>
                  )}
                </div>
                <div className='flex items-center gap-3'>
                  <button
                    type='button'
                    onClick={() =>
                      setScopingRoleId(scopingRoleId === r.id ? null : r.id)
                    }
                    className='text-primary text-xs hover:underline'
                  >
                    {scopingRoleId === r.id ? 'Hide locations' : 'Locations'}
                  </button>
                  <button
                    type='button'
                    onClick={() =>
                      setEditingRoleId(editingRoleId === r.id ? null : r.id)
                    }
                    className='text-primary text-xs hover:underline'
                  >
                    {editingRoleId === r.id ? 'Cancel edit' : 'Edit'}
                  </button>
                  <button
                    type='button'
                    aria-label={`Remove role ${r.roleType.code}`}
                    onClick={() => removeMutation.mutate(r.id)}
                    className='text-destructive/70 hover:text-destructive'
                  >
                    <Trash2 className='size-4' />
                  </button>
                </div>
              </div>
              {editingRoleId === r.id && (
                <RoleEditForm
                  userId={user.id}
                  role={r}
                  onDone={() => setEditingRoleId(null)}
                />
              )}
              {scopingRoleId === r.id && (
                <RoleLocationsPanel userRoleId={r.id} />
              )}
            </div>
          ))
        ) : (
          <p className='py-2 text-foreground/50 text-sm'>No roles assigned.</p>
        )}
      </div>
      <ModalFooter>
        <ModalClose asChild>
          <Button type='secondary' htmlType='button'>
            Close
          </Button>
        </ModalClose>
      </ModalFooter>
    </ModalContent>
  );
}

function UserRowActions({ user }: { user: User }) {
  const queryClient = useQueryClient();

  function useUserAction(
    mutationFn: () => Promise<User>,
    successTitle: string,
  ) {
    return useMutation({
      mutationFn,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['users'] });
        toast({ title: successTitle });
      },
      onError: (error) => onMutationError(error, 'Action failed'),
    });
  }

  const activateMutation = useUserAction(
    () => activateUser(user.id),
    'User activated',
  );
  const deactivateMutation = useUserAction(
    () => deactivateUser(user.id),
    'User deactivated',
  );
  const unlockMutation = useUserAction(
    () => unlockUser(user.id),
    'User unlocked',
  );

  return (
    <div
      className='flex items-center gap-2'
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Modal>
        <ModalTrigger asChild>
          <Button type='ghost' size='sm' htmlType='button'>
            Roles
          </Button>
        </ModalTrigger>
        <UserRolesModal user={user} />
      </Modal>
      {user.isActive ? (
        <Button
          type='secondary'
          size='sm'
          htmlType='button'
          disabled={deactivateMutation.isPending}
          onClick={() => deactivateMutation.mutate()}
        >
          Deactivate
        </Button>
      ) : (
        <Button
          type='secondary'
          size='sm'
          htmlType='button'
          disabled={activateMutation.isPending}
          onClick={() => activateMutation.mutate()}
        >
          Activate
        </Button>
      )}
      {user.failedLoginCount > 0 && (
        <Button
          type='secondary'
          size='sm'
          htmlType='button'
          disabled={unlockMutation.isPending}
          onClick={() => unlockMutation.mutate()}
        >
          Unlock
        </Button>
      )}
    </div>
  );
}

function UsersPage() {
  const isAdmin = useHasRole('SA', 'CA');
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', { page, search }],
    queryFn: () => listUsers({ page, limit, search: search || undefined }),
    placeholderData: (previous) => previous,
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <p className='py-10 text-center text-foreground/60 text-sm'>
        You don't have access to this page.
      </p>
    );
  }

  const columns: ColumnDef<User>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'mobile',
      header: 'Mobile',
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge variant={getValue<boolean>() ? 'success' : 'muted'}>
          {getValue<boolean>() ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessorKey: 'failedLoginCount',
      header: 'Failed logins',
      cell: ({ getValue }) => {
        const count = getValue<number>();
        return count > 0 ? (
          <Badge variant='warning'>{count}</Badge>
        ) : (
          <span className='text-foreground/50'>0</span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => <UserRowActions user={row.original} />,
    },
  ];

  return (
    <>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='font-display font-semibold text-2xl text-primary'>
            Users
          </h1>
          <p className='text-foreground/60 text-sm'>
            {data
              ? `${data.total} user${data.total === 1 ? '' : 's'}`
              : 'Loading…'}
          </p>
        </div>
        <Modal open={modalOpen} onOpenChange={setModalOpen}>
          <ModalTrigger asChild>
            <Button type='primary'>New user</Button>
          </ModalTrigger>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>New user</ModalTitle>
              <ModalDescription>
                Create a staff account. Assign roles afterward from the Roles
                action.
              </ModalDescription>
            </ModalHeader>
            <NewUserForm onSuccess={() => setModalOpen(false)} />
          </ModalContent>
        </Modal>
      </div>

      <div
        className='flex items-center gap-3 rounded-lg border border-border bg-white p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <Input
          placeholder='Search by name, email, username, mobile…'
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className='max-w-xs'
        />
      </div>

      <div
        className='animate-fade-in-up rounded-lg border border-border bg-white p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {isLoading ? (
          <div className='flex h-40 items-center justify-center'>
            <Spinner className='text-primary' />
          </div>
        ) : isError ? (
          <p className='py-10 text-center text-destructive text-sm'>
            Couldn't load users. Try refreshing.
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            emptyMessage='No users match these filters.'
            manualPagination={{
              pageIndex: page - 1,
              pageCount: data ? Math.max(1, Math.ceil(data.total / limit)) : 1,
              onPageChange: (pageIndex) => setPage(pageIndex + 1),
            }}
          />
        )}
      </div>
    </>
  );
}
