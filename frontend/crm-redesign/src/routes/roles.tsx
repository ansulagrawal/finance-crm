import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useHasRole } from '@/lib/roles';
import {
  createRoleType,
  listRoleTypesAdmin,
  removeRoleType,
} from '@/lib/users';

export const Route = createFileRoute('/roles')({
  component: RolesPage,
});

function RolesPage() {
  const isAdmin = useHasRole('SA', 'CA');
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [heading, setHeading] = useState('');
  const [code, setCode] = useState('');

  const { data: roleTypes, isLoading } = useQuery({
    queryKey: ['role-types-admin'],
    queryFn: listRoleTypesAdmin,
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createRoleType({
        name: name.trim(),
        heading: heading.trim() || undefined,
        code: code.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-types-admin'] });
      queryClient.invalidateQueries({ queryKey: ['role-types'] });
      setName('');
      setHeading('');
      setCode('');
      toast({ title: 'Role added' });
    },
    onError: (error) => {
      toast({
        title: 'Could not add role',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeRoleType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-types-admin'] });
      queryClient.invalidateQueries({ queryKey: ['role-types'] });
      toast({ title: 'Role removed' });
    },
    onError: (error) => {
      toast({
        title: 'Could not remove role',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  if (!isAdmin) {
    return (
      <p className='py-10 text-center text-foreground/60 text-sm'>
        You don't have access to this page.
      </p>
    );
  }

  const canSubmit = name.trim() && code.trim();

  return (
    <>
      <div>
        <h1 className='font-display font-semibold text-2xl text-primary'>
          Role types
        </h1>
        <p className='text-foreground/60 text-sm'>
          The role codes users can be assigned (e.g. CR1, DS1, SA).
        </p>
      </div>

      <div
        className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) createMutation.mutate();
          }}
          className='flex flex-wrap gap-2'
        >
          <Input
            placeholder='Code (e.g. CR4)'
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className='w-32 font-mono'
          />
          <Input
            placeholder='Name'
            value={name}
            onChange={(event) => setName(event.target.value)}
            className='flex-1'
          />
          <Input
            placeholder='Heading (optional)'
            value={heading}
            onChange={(event) => setHeading(event.target.value)}
            className='w-44'
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
        ) : roleTypes?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Heading</TableHead>
                <TableHead className='w-10' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleTypes.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <Badge variant='muted' className='font-mono'>
                      {role.code}
                    </Badge>
                  </TableCell>
                  <TableCell className='font-medium'>{role.name}</TableCell>
                  <TableCell className='text-foreground/60'>
                    {role.heading ?? '—'}
                  </TableCell>
                  <TableCell>
                    <button
                      type='button'
                      aria-label={`Remove ${role.code}`}
                      onClick={() => removeMutation.mutate(role.id)}
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
          <p className='py-2 text-foreground/50 text-sm'>No roles yet.</p>
        )}
      </div>
    </>
  );
}
