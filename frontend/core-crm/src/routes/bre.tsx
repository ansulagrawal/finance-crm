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
  type BreCategory,
  createBreCategory,
  createBreRule,
  listBreCategories,
  listBreRules,
  removeBreCategory,
  removeBreRule,
} from '@/lib/bre';
import { useHasRole } from '@/lib/roles';

export const Route = createFileRoute('/bre')({
  component: BrePage,
});

function onMutationError(error: unknown, title: string) {
  toast({
    title,
    description:
      error instanceof ApiError ? error.message : 'Something went wrong.',
    variant: 'destructive',
  });
}

function CategoriesCard() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const { data: categories, isLoading } = useQuery({
    queryKey: ['bre-categories'],
    queryFn: listBreCategories,
  });

  const createMutation = useMutation({
    mutationFn: () => createBreCategory({ name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bre-categories'] });
      setName('');
      toast({ title: 'Category added' });
    },
    onError: (error) => onMutationError(error, 'Could not add category'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeBreCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bre-categories'] });
      queryClient.invalidateQueries({ queryKey: ['bre-rules'] });
      toast({ title: 'Category removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove category'),
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Categories
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
        className='flex gap-2'
      >
        <Input
          placeholder='New category name'
          value={name}
          onChange={(event) => setName(event.target.value)}
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
        ) : categories?.length ? (
          categories.map((category) => (
            <div
              key={category.id}
              className='flex items-center justify-between py-2'
            >
              <span className='text-sm'>{category.name}</span>
              <button
                type='button'
                aria-label={`Remove ${category.name}`}
                onClick={() => removeMutation.mutate(category.id)}
                className='text-destructive/70 hover:text-destructive'
              >
                <Trash2 className='size-4' />
              </button>
            </div>
          ))
        ) : (
          <p className='py-2 text-foreground/50 text-sm'>No categories yet.</p>
        )}
      </div>
    </div>
  );
}

const ALL = 'all';

function RulesCard({ categories }: { categories: BreCategory[] | undefined }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string>(ALL);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['bre-rules', filterCategoryId],
    queryFn: () =>
      listBreRules(
        filterCategoryId === ALL ? undefined : Number(filterCategoryId),
      ),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBreRule({ name: name.trim(), categoryId: Number(categoryId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bre-rules'] });
      setName('');
      setCategoryId('');
      toast({ title: 'Rule added' });
    },
    onError: (error) => onMutationError(error, 'Could not add rule'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeBreRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bre-rules'] });
      toast({ title: 'Rule removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove rule'),
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className='flex items-center justify-between'>
        <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
          Rules
        </h2>
        <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
          <SelectTrigger className='w-44'>
            <SelectValue placeholder='All categories' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && categoryId) createMutation.mutate();
        }}
        className='flex gap-2'
      >
        <Input
          placeholder='New rule name'
          value={name}
          onChange={(event) => setName(event.target.value)}
          className='flex-1'
        />
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className='w-44'>
            <SelectValue placeholder='Category' />
          </SelectTrigger>
          <SelectContent>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!name.trim() || !categoryId || createMutation.isPending}
        >
          Add
        </Button>
      </form>

      <div className='flex flex-col divide-y divide-border/60'>
        {isLoading ? (
          <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
        ) : rules?.length ? (
          rules.map((rule) => (
            <div
              key={rule.id}
              className='flex items-center justify-between py-2'
            >
              <div className='flex items-center gap-2'>
                <span className='text-sm'>{rule.name}</span>
                <Badge variant='muted'>{rule.category.name}</Badge>
              </div>
              <button
                type='button'
                aria-label={`Remove ${rule.name}`}
                onClick={() => removeMutation.mutate(rule.id)}
                className='text-destructive/70 hover:text-destructive'
              >
                <Trash2 className='size-4' />
              </button>
            </div>
          ))
        ) : (
          <p className='py-2 text-foreground/50 text-sm'>No rules yet.</p>
        )}
      </div>
    </div>
  );
}

function BrePage() {
  const isAdmin = useHasRole('SA', 'CA');
  const { data: categories } = useQuery({
    queryKey: ['bre-categories'],
    queryFn: listBreCategories,
    enabled: isAdmin,
  });

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
          Business Rule Engine
        </h1>
        <p className='text-foreground/60 text-sm'>
          Manage the underwriting rule categories and rules evaluated for every
          lead.
        </p>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <CategoriesCard />
        <RulesCard categories={categories} />
      </div>
    </>
  );
}
