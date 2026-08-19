import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  type AdminCompany,
  createBlacklistedPincode,
  createBranch,
  createCity,
  createCompany,
  createDataSource,
  createPincode,
  createProduct,
  createState,
  listBlacklistedPincodes,
  listBranches,
  listCitiesByStateAdmin,
  listCompaniesAdmin,
  listDataSourcesAdmin,
  listPincodesByCity,
  listProductsAdmin,
  listStatesAdmin,
  removeBlacklistedPincode,
  removeBranch,
  removeCity,
  removeCompany,
  removeDataSource,
  removePincode,
  removeProduct,
  removeState,
} from '@/lib/company-geography';
import { useHasRole } from '@/lib/roles';

export const Route = createFileRoute('/company-geography')({
  component: CompanyGeographyPage,
});

function onMutationError(error: unknown, title: string) {
  toast({
    title,
    description:
      error instanceof ApiError ? error.message : 'Something went wrong.',
    variant: 'destructive',
  });
}

function ProductsList({ company }: { company: AdminCompany }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', company.id],
    queryFn: () => listProductsAdmin(company.id),
  });

  const createMutation = useMutation({
    mutationFn: () => createProduct(company.id, { name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', company.id] });
      setName('');
      toast({ title: 'Product added' });
    },
    onError: (error) => onMutationError(error, 'Could not add product'),
  });

  const removeMutation = useMutation({
    mutationFn: (productId: number) => removeProduct(company.id, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', company.id] });
      toast({ title: 'Product removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove product'),
  });

  return (
    <div className='ml-4 flex flex-col gap-1 border-border/40 border-l pl-3'>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
        className='flex gap-2'
      >
        <Input
          placeholder='New product'
          value={name}
          onChange={(event) => setName(event.target.value)}
          className='h-8 flex-1 text-xs'
        />
        <Button
          type='secondary'
          size='sm'
          htmlType='submit'
          disabled={!name.trim() || createMutation.isPending}
        >
          Add
        </Button>
      </form>
      {isLoading ? (
        <p className='text-foreground/40 text-xs'>Loading…</p>
      ) : products?.length ? (
        products.map((p) => (
          <div key={p.id} className='flex items-center justify-between'>
            <span className='text-xs'>{p.name}</span>
            <button
              type='button'
              aria-label={`Remove ${p.name}`}
              onClick={() => removeMutation.mutate(p.id)}
              className='text-destructive/70 hover:text-destructive'
            >
              <Trash2 className='size-3' />
            </button>
          </div>
        ))
      ) : (
        <p className='text-foreground/40 text-xs'>No products yet.</p>
      )}
    </div>
  );
}

function CompaniesCard() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies-admin'],
    queryFn: listCompaniesAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createCompany({ name: name.trim(), code: code.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies-admin'] });
      setName('');
      setCode('');
      toast({ title: 'Company added' });
    },
    onError: (error) => onMutationError(error, 'Could not add company'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies-admin'] });
      toast({ title: 'Company removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove company'),
  });

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Companies &amp; products
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
        className='flex gap-2'
      >
        <Input
          placeholder='Company name'
          value={name}
          onChange={(event) => setName(event.target.value)}
          className='flex-1'
        />
        <Input
          placeholder='Code (optional)'
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className='w-28'
        />
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!name.trim() || createMutation.isPending}
        >
          Add
        </Button>
      </form>
      <div className='flex flex-col divide-y divide-border/60'>
        {isLoading ? (
          <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
        ) : companies?.length ? (
          companies.map((company) => (
            <div key={company.id} className='flex flex-col gap-2 py-2'>
              <div className='flex items-center justify-between'>
                <button
                  type='button'
                  onClick={() => toggle(company.id)}
                  className='flex items-center gap-2 text-left text-sm hover:underline'
                >
                  {company.name}
                  {company.code && (
                    <Badge variant='muted'>{company.code}</Badge>
                  )}
                </button>
                <button
                  type='button'
                  aria-label={`Remove ${company.name}`}
                  onClick={() => removeMutation.mutate(company.id)}
                  className='text-destructive/70 hover:text-destructive'
                >
                  <Trash2 className='size-4' />
                </button>
              </div>
              {expanded.has(company.id) && <ProductsList company={company} />}
            </div>
          ))
        ) : (
          <p className='py-2 text-foreground/50 text-sm'>No companies yet.</p>
        )}
      </div>
    </div>
  );
}

function CitiesList({ stateId }: { stateId: number }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const { data: cities, isLoading } = useQuery({
    queryKey: ['cities-admin', stateId],
    queryFn: () => listCitiesByStateAdmin(stateId),
  });

  const createMutation = useMutation({
    mutationFn: () => createCity(stateId, name.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities-admin', stateId] });
      setName('');
      toast({ title: 'City added' });
    },
    onError: (error) => onMutationError(error, 'Could not add city'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeCity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities-admin', stateId] });
      toast({ title: 'City removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove city'),
  });

  return (
    <div className='flex flex-col gap-2'>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
        className='flex gap-2'
      >
        <Input
          placeholder='New city'
          value={name}
          onChange={(event) => setName(event.target.value)}
          className='flex-1'
        />
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!name.trim() || createMutation.isPending}
        >
          Add
        </Button>
      </form>
      <div className='flex max-h-64 flex-col divide-y divide-border/60 overflow-y-auto'>
        {isLoading ? (
          <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
        ) : cities?.length ? (
          cities.map((city) => (
            <div
              key={city.id}
              className='flex items-center justify-between py-1.5'
            >
              <span className='text-sm'>{city.name}</span>
              <button
                type='button'
                aria-label={`Remove ${city.name}`}
                onClick={() => removeMutation.mutate(city.id)}
                className='text-destructive/70 hover:text-destructive'
              >
                <Trash2 className='size-4' />
              </button>
            </div>
          ))
        ) : (
          <p className='py-2 text-foreground/50 text-sm'>No cities yet.</p>
        )}
      </div>
    </div>
  );
}

function StatesCitiesCard() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedStateId, setSelectedStateId] = useState('');

  const { data: states, isLoading } = useQuery({
    queryKey: ['states-admin'],
    queryFn: listStatesAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createState({ name: name.trim(), code: code.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['states-admin'] });
      setName('');
      setCode('');
      toast({ title: 'State added' });
    },
    onError: (error) => onMutationError(error, 'Could not add state'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeState(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['states-admin'] });
      toast({ title: 'State removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove state'),
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        States &amp; cities
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
        className='flex gap-2'
      >
        <Input
          placeholder='State name'
          value={name}
          onChange={(event) => setName(event.target.value)}
          className='flex-1'
        />
        <Input
          placeholder='Code (optional)'
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className='w-24'
        />
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!name.trim() || createMutation.isPending}
        >
          Add
        </Button>
      </form>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='flex max-h-80 flex-col divide-y divide-border/60 overflow-y-auto'>
          {isLoading ? (
            <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
          ) : states?.length ? (
            states.map((state) => (
              <div
                key={state.id}
                className={`flex items-center justify-between py-1.5 ${
                  selectedStateId === String(state.id) ? 'font-medium' : ''
                }`}
              >
                <button
                  type='button'
                  onClick={() => setSelectedStateId(String(state.id))}
                  className='text-left text-sm hover:underline'
                >
                  {state.name}
                  {state.code && ` (${state.code})`}
                </button>
                <button
                  type='button'
                  aria-label={`Remove ${state.name}`}
                  onClick={() => removeMutation.mutate(state.id)}
                  className='text-destructive/70 hover:text-destructive'
                >
                  <Trash2 className='size-4' />
                </button>
              </div>
            ))
          ) : (
            <p className='py-2 text-foreground/50 text-sm'>No states yet.</p>
          )}
        </div>
        <div>
          {selectedStateId ? (
            <CitiesList stateId={Number(selectedStateId)} />
          ) : (
            <p className='text-foreground/50 text-sm'>
              Select a state to manage its cities.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PincodesCard() {
  const queryClient = useQueryClient();
  const { data: statesList } = useQuery({
    queryKey: ['states-admin'],
    queryFn: listStatesAdmin,
  });
  const [selectedStateId, setSelectedStateId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [value, setValue] = useState('');

  const { data: cities } = useQuery({
    queryKey: ['cities-admin', selectedStateId],
    queryFn: () => listCitiesByStateAdmin(Number(selectedStateId)),
    enabled: !!selectedStateId,
  });

  const { data: pincodes, isLoading } = useQuery({
    queryKey: ['pincodes-admin', selectedCityId],
    queryFn: () => listPincodesByCity(Number(selectedCityId)),
    enabled: !!selectedCityId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createPincode({
        value: value.trim(),
        cityId: selectedCityId ? Number(selectedCityId) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['pincodes-admin', selectedCityId],
      });
      setValue('');
      toast({ title: 'Pincode added' });
    },
    onError: (error) => onMutationError(error, 'Could not add pincode'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removePincode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['pincodes-admin', selectedCityId],
      });
      toast({ title: 'Pincode removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove pincode'),
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Pincodes
      </h2>
      <p className='text-foreground/50 text-xs'>
        ~7,900 seeded rows — always browsed by city, never fetched unfiltered.
      </p>
      <div className='flex gap-2'>
        <Select
          value={selectedStateId}
          onValueChange={(value) => {
            setSelectedStateId(value);
            setSelectedCityId('');
          }}
        >
          <SelectTrigger className='flex-1'>
            <SelectValue placeholder='State' />
          </SelectTrigger>
          <SelectContent>
            {statesList?.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedCityId}
          onValueChange={setSelectedCityId}
          disabled={!selectedStateId}
        >
          <SelectTrigger className='flex-1'>
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
      </div>

      {selectedCityId ? (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (value.trim()) createMutation.mutate();
            }}
            className='flex gap-2'
          >
            <Input
              placeholder='New pincode'
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className='flex-1'
            />
            <Button
              type='primary'
              size='sm'
              htmlType='submit'
              disabled={!value.trim() || createMutation.isPending}
            >
              Add
            </Button>
          </form>
          <div className='flex max-h-64 flex-col divide-y divide-border/60 overflow-y-auto'>
            {isLoading ? (
              <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
            ) : pincodes?.length ? (
              pincodes.map((p) => (
                <div
                  key={p.id}
                  className='flex items-center justify-between py-1.5'
                >
                  <span className='font-mono text-sm'>{p.value}</span>
                  <button
                    type='button'
                    aria-label={`Remove ${p.value}`}
                    onClick={() => removeMutation.mutate(p.id)}
                    className='text-destructive/70 hover:text-destructive'
                  >
                    <Trash2 className='size-4' />
                  </button>
                </div>
              ))
            ) : (
              <p className='py-2 text-foreground/50 text-sm'>
                No pincodes for this city yet.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className='text-foreground/50 text-sm'>
          Select a state and city to manage pincodes.
        </p>
      )}
    </div>
  );
}

function SimpleListCard({
  title,
  queryKey,
  listFn,
  createFn,
  removeFn,
  renderLabel,
}: {
  title: string;
  queryKey: string;
  listFn: () => Promise<{ id: number; name?: string; pincode?: string }[]>;
  createFn: (value: string) => Promise<unknown>;
  removeFn: (id: number) => Promise<unknown>;
  renderLabel: (item: {
    id: number;
    name?: string;
    pincode?: string;
  }) => string;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');

  const { data: items, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: listFn,
  });

  const createMutation = useMutation({
    mutationFn: () => createFn(value.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setValue('');
      toast({ title: `${title.slice(0, -1)} added` });
    },
    onError: (error) => onMutationError(error, `Could not add`),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeFn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: `${title.slice(0, -1)} removed` });
    },
    onError: (error) => onMutationError(error, `Could not remove`),
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        {title}
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) createMutation.mutate();
        }}
        className='flex gap-2'
      >
        <Input
          placeholder={`New ${title.toLowerCase().slice(0, -1)}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className='flex-1'
        />
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!value.trim() || createMutation.isPending}
        >
          Add
        </Button>
      </form>
      <div className='flex max-h-56 flex-col divide-y divide-border/60 overflow-y-auto'>
        {isLoading ? (
          <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
        ) : items?.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className='flex items-center justify-between py-1.5'
            >
              <span className='text-sm'>{renderLabel(item)}</span>
              <button
                type='button'
                aria-label={`Remove ${renderLabel(item)}`}
                onClick={() => removeMutation.mutate(item.id)}
                className='text-destructive/70 hover:text-destructive'
              >
                <Trash2 className='size-4' />
              </button>
            </div>
          ))
        ) : (
          <p className='py-2 text-foreground/50 text-sm'>Nothing here yet.</p>
        )}
      </div>
    </div>
  );
}

function CompanyGeographyPage() {
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
          Company &amp; Geography
        </h1>
        <p className='text-foreground/60 text-sm'>
          Reference data used across leads, disbursal, and collection.
        </p>
      </div>

      <CompaniesCard />
      <StatesCitiesCard />
      <PincodesCard />

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <SimpleListCard
          title='Branches'
          queryKey='branches-admin'
          listFn={listBranches}
          createFn={createBranch}
          removeFn={removeBranch}
          renderLabel={(item) => item.name ?? ''}
        />
        <SimpleListCard
          title='Data sources'
          queryKey='data-sources-admin'
          listFn={listDataSourcesAdmin}
          createFn={(name) => createDataSource({ name })}
          removeFn={removeDataSource}
          renderLabel={(item) => item.name ?? ''}
        />
        <SimpleListCard
          title='Blacklisted pincodes'
          queryKey='blacklisted-pincodes'
          listFn={listBlacklistedPincodes}
          createFn={createBlacklistedPincode}
          removeFn={removeBlacklistedPincode}
          renderLabel={(item) => item.pincode ?? ''}
        />
      </div>
    </>
  );
}
