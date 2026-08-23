import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
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
import { listRoleTypes } from '@/lib/lookups';
import {
  createMenuItem,
  grantExportPermission,
  grantMisPermission,
  listExportPermissions,
  listMenuItemsGrouped,
  listMisPermissions,
  removeMenuItem,
  revokeExportPermission,
  revokeMisPermission,
} from '@/lib/menu-permissions';
import { useHasRole } from '@/lib/roles';

export const Route = createFileRoute('/menu-permissions')({
  component: MenuPermissionsPage,
});

function onMutationError(error: unknown, title: string) {
  toast({
    title,
    description:
      error instanceof ApiError ? error.message : 'Something went wrong.',
    variant: 'destructive',
  });
}

function MenuItemsCard() {
  const queryClient = useQueryClient();
  const [roleTypeId, setRoleTypeId] = useState('');
  const [sectionId, setSectionId] = useState(0);
  const [name, setName] = useState('');
  const [routeLink, setRouteLink] = useState('');

  const { data: roleTypes } = useQuery({
    queryKey: ['role-types'],
    queryFn: listRoleTypes,
  });
  const { data: sections, isLoading } = useQuery({
    queryKey: ['menu-items-grouped'],
    queryFn: () => listMenuItemsGrouped(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createMenuItem({
        roleTypeId: Number(roleTypeId),
        sectionId,
        name: name.trim(),
        routeLink: routeLink.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items-grouped'] });
      setRoleTypeId('');
      setSectionId(0);
      setName('');
      setRouteLink('');
      toast({ title: 'Menu item added' });
    },
    onError: (error) => onMutationError(error, 'Could not add menu item'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeMenuItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items-grouped'] });
      toast({ title: 'Menu item removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove menu item'),
  });

  const canSubmit =
    roleTypeId && sectionId > 0 && name.trim() && routeLink.trim();

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Menu items
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) createMutation.mutate();
        }}
        className='grid grid-cols-2 gap-2 md:grid-cols-5'
      >
        <Select value={roleTypeId} onValueChange={setRoleTypeId}>
          <SelectTrigger>
            <SelectValue placeholder='Role' />
          </SelectTrigger>
          <SelectContent>
            {roleTypes?.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.code} — {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <NumberInput
          value={sectionId}
          onChange={setSectionId}
          min={0}
          step={1}
          placeholder='Section ID'
        />
        <Input
          placeholder='Item name'
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          placeholder='Route link'
          value={routeLink}
          onChange={(event) => setRouteLink(event.target.value)}
        />
        <Button
          type='primary'
          htmlType='submit'
          disabled={!canSubmit || createMutation.isPending}
        >
          Add
        </Button>
      </form>

      <div className='flex flex-col gap-4'>
        {isLoading ? (
          <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
        ) : sections?.length ? (
          sections
            .sort((a, b) => a.sectionId - b.sectionId)
            .map((section) => (
              <div key={section.sectionId} className='flex flex-col gap-1'>
                <span className='font-medium text-foreground/60 text-xs uppercase'>
                  Section {section.sectionId}
                  {section.sectionLabel && ` — ${section.sectionLabel}`}
                </span>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Route link</TableHead>
                      <TableHead className='w-10' />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className='font-medium'>
                          {item.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant='muted'>{item.roleType.code}</Badge>
                        </TableCell>
                        <TableCell className='text-foreground/60'>
                          {item.routeLink}
                        </TableCell>
                        <TableCell>
                          <button
                            type='button'
                            aria-label={`Remove ${item.name}`}
                            onClick={() => removeMutation.mutate(item.id)}
                            className='text-destructive/70 hover:text-destructive'
                          >
                            <Trash2 className='size-4' />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
        ) : (
          <p className='py-2 text-foreground/50 text-sm'>No menu items yet.</p>
        )}
      </div>
    </div>
  );
}

function ExportPermissionsCard() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState(0);
  const [exportId, setExportId] = useState(0);

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['export-permissions'],
    queryFn: () => listExportPermissions(),
  });

  const grantMutation = useMutation({
    mutationFn: () => grantExportPermission({ userId, exportId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-permissions'] });
      setUserId(0);
      setExportId(0);
      toast({ title: 'Export permission granted' });
    },
    onError: (error) => onMutationError(error, 'Could not grant permission'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => revokeExportPermission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-permissions'] });
      toast({ title: 'Export permission revoked' });
    },
    onError: (error) => onMutationError(error, 'Could not revoke permission'),
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Export permissions
      </h2>
      <p className='text-foreground/50 text-xs'>
        Granted by numeric export ID — no export catalog picker yet, since
        reporting-api doesn't expose one.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (userId > 0 && exportId > 0) grantMutation.mutate();
        }}
        className='flex gap-2'
      >
        <NumberInput
          value={userId}
          onChange={setUserId}
          min={0}
          step={1}
          placeholder='User ID'
        />
        <NumberInput
          value={exportId}
          onChange={setExportId}
          min={0}
          step={1}
          placeholder='Export ID'
        />
        <Button
          type='primary'
          htmlType='submit'
          disabled={!(userId > 0 && exportId > 0) || grantMutation.isPending}
        >
          Grant
        </Button>
      </form>
      {isLoading ? (
        <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
      ) : permissions?.length ? (
        <Table containerClassName='max-h-80 overflow-y-auto'>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Export ID</TableHead>
              <TableHead className='w-10' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((p) => (
              <TableRow key={p.id}>
                <TableCell className='font-medium'>{p.user.name}</TableCell>
                <TableCell className='text-foreground/60'>
                  #{p.exportId}
                </TableCell>
                <TableCell>
                  <button
                    type='button'
                    aria-label={`Revoke export permission ${p.id}`}
                    onClick={() => revokeMutation.mutate(p.id)}
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
        <p className='py-2 text-foreground/50 text-sm'>
          No export permissions granted.
        </p>
      )}
    </div>
  );
}

function MisPermissionsCard() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState(0);
  const [misId, setMisId] = useState(0);

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['mis-permissions'],
    queryFn: () => listMisPermissions(),
  });

  const grantMutation = useMutation({
    mutationFn: () => grantMisPermission({ userId, misId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-permissions'] });
      setUserId(0);
      setMisId(0);
      toast({ title: 'MIS permission granted' });
    },
    onError: (error) => onMutationError(error, 'Could not grant permission'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => revokeMisPermission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-permissions'] });
      toast({ title: 'MIS permission revoked' });
    },
    onError: (error) => onMutationError(error, 'Could not revoke permission'),
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        MIS report permissions
      </h2>
      <p className='text-foreground/50 text-xs'>
        Granted by numeric MIS report ID — same no-catalog-yet caveat as export
        permissions.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (userId > 0 && misId > 0) grantMutation.mutate();
        }}
        className='flex gap-2'
      >
        <NumberInput
          value={userId}
          onChange={setUserId}
          min={0}
          step={1}
          placeholder='User ID'
        />
        <NumberInput
          value={misId}
          onChange={setMisId}
          min={0}
          step={1}
          placeholder='MIS report ID'
        />
        <Button
          type='primary'
          htmlType='submit'
          disabled={!(userId > 0 && misId > 0) || grantMutation.isPending}
        >
          Grant
        </Button>
      </form>
      {isLoading ? (
        <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
      ) : permissions?.length ? (
        <Table containerClassName='max-h-80 overflow-y-auto'>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>MIS report ID</TableHead>
              <TableHead className='w-10' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((p) => (
              <TableRow key={p.id}>
                <TableCell className='font-medium'>{p.user.name}</TableCell>
                <TableCell className='text-foreground/60'>#{p.misId}</TableCell>
                <TableCell>
                  <button
                    type='button'
                    aria-label={`Revoke MIS permission ${p.id}`}
                    onClick={() => revokeMutation.mutate(p.id)}
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
        <p className='py-2 text-foreground/50 text-sm'>
          No MIS permissions granted.
        </p>
      )}
    </div>
  );
}

function MenuPermissionsPage() {
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
        <h1 className='font-display font-semibold text-2xl text-primary'>
          Menu &amp; Permissions
        </h1>
        <p className='text-foreground/60 text-sm'>
          Manage per-role navigation items and per-user export/MIS report
          permissions.
        </p>
      </div>

      <MenuItemsCard />
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <ExportPermissionsCard />
        <MisPermissionsCard />
      </div>
    </>
  );
}
