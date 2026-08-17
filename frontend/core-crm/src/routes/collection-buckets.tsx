import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  createCollectionBucket,
  grantCollectionBucketPermission,
  listCollectionBucketPermissions,
  listCollectionBuckets,
  removeCollectionBucket,
  revokeCollectionBucketPermission,
} from '@/lib/collection-buckets';
import { listRoleTypes } from '@/lib/lookups';
import { useHasRole } from '@/lib/roles';
import { listUsers } from '@/lib/users';

export const Route = createFileRoute('/collection-buckets')({
  component: CollectionBucketsPage,
});

function onMutationError(error: unknown, title: string) {
  toast({
    title,
    description:
      error instanceof ApiError ? error.message : 'Something went wrong.',
    variant: 'destructive',
  });
}

function BucketsSection() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [startDpd, setStartDpd] = useState('');
  const [endDpd, setEndDpd] = useState('');

  const { data: buckets, isLoading } = useQuery({
    queryKey: ['collection-buckets'],
    queryFn: listCollectionBuckets,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createCollectionBucket({
        name: name.trim(),
        startDpd: Number(startDpd),
        endDpd: Number(endDpd),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-buckets'] });
      setName('');
      setStartDpd('');
      setEndDpd('');
      toast({ title: 'Bucket added' });
    },
    onError: (error) => onMutationError(error, 'Could not add bucket'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeCollectionBucket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-buckets'] });
      toast({ title: 'Bucket removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove bucket'),
  });

  const canSubmit = name.trim() && startDpd.trim() && endDpd.trim();

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div>
        <h2 className='font-semibold text-lg'>DPD Buckets</h2>
        <p className='text-foreground/60 text-sm'>
          Named days-past-due ranges (e.g. "0-30 DPD") used to scope which
          overdue loans a collection agent can see.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) createMutation.mutate();
        }}
        className='flex flex-wrap gap-2'
      >
        <Input
          placeholder='Name (e.g. 0-30 DPD)'
          value={name}
          onChange={(event) => setName(event.target.value)}
          className='flex-1'
        />
        <Input
          type='number'
          placeholder='Start DPD'
          value={startDpd}
          onChange={(event) => setStartDpd(event.target.value)}
          className='w-32'
        />
        <Input
          type='number'
          placeholder='End DPD'
          value={endDpd}
          onChange={(event) => setEndDpd(event.target.value)}
          className='w-32'
        />
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!canSubmit || createMutation.isPending}
        >
          Add
        </Button>
      </form>

      {isLoading ? (
        <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
      ) : buckets?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>DPD range</TableHead>
              <TableHead className='w-10' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((bucket) => (
              <TableRow key={bucket.id}>
                <TableCell className='font-medium'>{bucket.name}</TableCell>
                <TableCell className='text-foreground/60'>
                  {bucket.startDpd}–{bucket.endDpd}
                </TableCell>
                <TableCell>
                  <button
                    type='button'
                    aria-label={`Remove ${bucket.name}`}
                    onClick={() => removeMutation.mutate(bucket.id)}
                    disabled={removeMutation.isPending}
                    className='text-destructive/70 hover:text-destructive disabled:opacity-50'
                  >
                    <Trash2 className='size-4' />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className='py-2 text-foreground/50 text-sm'>No buckets yet.</p>
      )}
    </div>
  );
}

/** Search-then-pick, same pattern as `users.tsx`'s `SupervisorPicker` — the
 * user catalog is admin-gated and too large for a plain `<Select>`. */
function PermissionsSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [bucketId, setBucketId] = useState('');
  const [userRoleId, setUserRoleId] = useState('');

  const { data: buckets } = useQuery({
    queryKey: ['collection-buckets'],
    queryFn: listCollectionBuckets,
  });

  const { data: roleTypes } = useQuery({
    queryKey: ['role-types'],
    queryFn: listRoleTypes,
  });

  const { data: userResults } = useQuery({
    queryKey: ['users-search', search],
    queryFn: () => listUsers({ search, limit: 10 }),
    enabled: search.trim().length > 1,
  });

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['collection-bucket-permissions'],
    queryFn: () => listCollectionBucketPermissions(),
  });

  const grantMutation = useMutation({
    mutationFn: () =>
      grantCollectionBucketPermission({
        userId: Number(userId),
        bucketId: Number(bucketId),
        userRoleId: userRoleId ? Number(userRoleId) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collection-bucket-permissions'],
      });
      setUserId('');
      setBucketId('');
      setUserRoleId('');
      setSearch('');
      toast({ title: 'Bucket granted' });
    },
    onError: (error) => onMutationError(error, 'Could not grant bucket'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => revokeCollectionBucketPermission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collection-bucket-permissions'],
      });
      toast({ title: 'Bucket permission revoked' });
    },
    onError: (error) => onMutationError(error, 'Could not revoke permission'),
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div>
        <h2 className='font-semibold text-lg'>Bucket Permissions</h2>
        <p className='text-foreground/60 text-sm'>
          Grants a collection agent visibility into a specific DPD bucket.
        </p>
      </div>

      <div className='flex flex-wrap items-end gap-2'>
        <Combobox
          value={userId}
          onValueChange={setUserId}
          search={search}
          onSearchChange={(next) => {
            setSearch(next);
            setUserId('');
          }}
          options={
            userResults?.data.map((u) => ({
              value: String(u.id),
              label: u.name,
            })) ?? []
          }
          placeholder='Select user'
          searchPlaceholder='Search user by name…'
          emptyText={
            search.trim().length > 1
              ? 'No matching users.'
              : 'Type at least 2 characters…'
          }
          className='h-9 flex-1 text-sm'
        />

        <Select value={bucketId} onValueChange={setBucketId}>
          <SelectTrigger className='h-9 w-44 text-sm'>
            <SelectValue placeholder='Bucket' />
          </SelectTrigger>
          <SelectContent>
            {buckets?.map((bucket) => (
              <SelectItem key={bucket.id} value={String(bucket.id)}>
                {bucket.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={userRoleId} onValueChange={setUserRoleId}>
          <SelectTrigger className='h-9 w-44 text-sm'>
            <SelectValue placeholder='Role (optional)' />
          </SelectTrigger>
          <SelectContent>
            {roleTypes?.map((role) => (
              <SelectItem key={role.id} value={String(role.id)}>
                {role.code} — {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type='primary'
          size='sm'
          disabled={!userId || !bucketId || grantMutation.isPending}
          onClick={() => grantMutation.mutate()}
        >
          Grant
        </Button>
      </div>

      {isLoading ? (
        <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
      ) : permissions?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead className='w-10' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((permission) => (
              <TableRow key={permission.id}>
                <TableCell className='font-medium'>
                  {permission.user.name}
                </TableCell>
                <TableCell>
                  {permission.userRole ? (
                    <Badge variant='muted' className='font-mono'>
                      {permission.userRole.code}
                    </Badge>
                  ) : (
                    <span className='text-foreground/40'>—</span>
                  )}
                </TableCell>
                <TableCell className='text-foreground/60'>
                  {permission.bucket.name}
                </TableCell>
                <TableCell>
                  <button
                    type='button'
                    aria-label={`Revoke ${permission.bucket.name} from ${permission.user.name}`}
                    onClick={() => revokeMutation.mutate(permission.id)}
                    disabled={revokeMutation.isPending}
                    className='text-destructive/70 hover:text-destructive disabled:opacity-50'
                  >
                    <Trash2 className='size-4' />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className='py-2 text-foreground/50 text-sm'>
          No bucket permissions granted yet.
        </p>
      )}
    </div>
  );
}

function CollectionBucketsPage() {
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
          Collection Buckets
        </h1>
        <p className='text-foreground/60 text-sm'>
          DPD ranges and which collection agents can see each one.
        </p>
      </div>
      <BucketsSection />
      <PermissionsSection />
    </>
  );
}
