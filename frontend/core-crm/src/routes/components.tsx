import { createFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { type ReactNode, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DatePicker } from '@/components/ui/date-picker';
import { FileUpload } from '@/components/ui/file-upload';
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
import { MultiSelect } from '@/components/ui/multi-select';
import { NumberInput } from '@/components/ui/number-input';
import { OtpInput } from '@/components/ui/otp-input';
import { PasswordInput } from '@/components/ui/password-input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { VirtualList } from '@/components/ui/virtual-list';

export const Route = createFileRoute('/components')({
  component: ComponentsPage,
});

type Row = { id: string; name: string; amount: number };

const tableRows: Row[] = [
  { id: 'R-1', name: 'Asha Verma', amount: 15000 },
  { id: 'R-2', name: 'Ravi Kumar', amount: 8000 },
  { id: 'R-3', name: 'Priya Nair', amount: 25000 },
];

const tableColumns: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'amount', header: 'Amount' },
];

const multiSelectOptions = [
  { label: 'CR1', value: 'cr1' },
  { label: 'CR2', value: 'cr2' },
  { label: 'CO1', value: 'co1' },
  { label: 'CA', value: 'ca' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='flex flex-col gap-4 rounded-md border border-border p-6'>
      <h2 className='font-semibold text-lg'>{title}</h2>
      {children}
    </section>
  );
}

function ComponentsPage() {
  const [otp, setOtp] = useState('');
  const [multiValue, setMultiValue] = useState<string[]>(['cr1']);
  const [selectValue, setSelectValue] = useState('new');
  const [checked, setChecked] = useState(true);
  const [number, setNumber] = useState(10);
  const [date, setDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  return (
    <>
      <h1 className='font-semibold text-xl'>Component Library</h1>

      <Section title='Buttons'>
        <div className='flex flex-wrap items-center gap-3'>
          <Button type='primary'>Primary</Button>
          <Button type='secondary'>Secondary</Button>
          <Button type='destructive'>Destructive</Button>
          <Button type='ghost'>Ghost</Button>
          <Button size='sm'>Small</Button>
          <Button size='lg'>Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title='Badges'>
        <div className='flex flex-wrap items-center gap-3'>
          <Badge variant='default'>Default</Badge>
          <Badge variant='success'>Success</Badge>
          <Badge variant='warning'>Warning</Badge>
          <Badge variant='destructive'>Destructive</Badge>
          <Badge variant='muted'>Muted</Badge>
        </div>
      </Section>

      <Section title='Alerts'>
        <div className='flex flex-col gap-3'>
          <Alert variant='info'>
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>An informational message.</AlertDescription>
          </Alert>
          <Alert variant='success'>
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Something went well.</AlertDescription>
          </Alert>
          <Alert variant='warning'>
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>Proceed with caution.</AlertDescription>
          </Alert>
          <Alert variant='destructive'>
            <AlertTitle>Destructive</AlertTitle>
            <AlertDescription>Something went wrong.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title='Inputs'>
        <div className='grid max-w-xl grid-cols-2 gap-4'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='demo-input'>Text</Label>
            <Input id='demo-input' placeholder='Enter text' />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='demo-password'>Password</Label>
            <PasswordInput id='demo-password' placeholder='Enter password' />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='demo-number'>Number</Label>
            <NumberInput
              id='demo-number'
              value={number}
              onChange={setNumber}
              min={0}
              max={100}
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='demo-date'>Date</Label>
            <DatePicker
              id='demo-date'
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className='col-span-2 flex flex-col gap-1.5'>
            <Label htmlFor='demo-textarea'>Textarea</Label>
            <Textarea id='demo-textarea' placeholder='Enter a longer note' />
          </div>
        </div>
      </Section>

      <Section title='Select & Multi-select'>
        <div className='grid max-w-xl grid-cols-2 gap-4'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='demo-select'>Select</Label>
            <Select value={selectValue} onValueChange={setSelectValue}>
              <SelectTrigger id='demo-select'>
                <SelectValue placeholder='Select an option' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='new'>New</SelectItem>
                <SelectItem value='reviewing'>Reviewing</SelectItem>
                <SelectItem value='approved'>Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label>Multi-select</Label>
            <MultiSelect
              options={multiSelectOptions}
              value={multiValue}
              onChange={setMultiValue}
              placeholder='Select roles'
            />
          </div>
        </div>
      </Section>

      <Section title='Checkbox & OTP'>
        <div className='flex flex-col gap-4'>
          <div className='flex items-center gap-2'>
            <Checkbox
              id='demo-checkbox'
              checked={checked}
              onCheckedChange={(value) => setChecked(value === true)}
            />
            <Label htmlFor='demo-checkbox'>Accept terms</Label>
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label>OTP</Label>
            <OtpInput value={otp} onChange={setOtp} />
          </div>
        </div>
      </Section>

      <Section title='File upload'>
        <FileUpload
          value={files}
          onChange={setFiles}
          accept='image/*,.pdf'
          className='max-w-xl'
        />
      </Section>

      <Section title='Tabs'>
        <Tabs defaultValue='application' className='max-w-xl'>
          <TabsList>
            <TabsTrigger value='application'>Application</TabsTrigger>
            <TabsTrigger value='documents'>Documents</TabsTrigger>
            <TabsTrigger value='banking'>Banking</TabsTrigger>
          </TabsList>
          <TabsContent value='application'>Application details.</TabsContent>
          <TabsContent value='documents'>Uploaded documents.</TabsContent>
          <TabsContent value='banking'>Banking information.</TabsContent>
        </Tabs>
      </Section>

      <Section title='Accordion'>
        <Accordion type='single' collapsible className='max-w-xl'>
          <AccordionItem value='personal'>
            <AccordionTrigger>Personal details</AccordionTrigger>
            <AccordionContent>Name, DOB, PAN, address.</AccordionContent>
          </AccordionItem>
          <AccordionItem value='banking'>
            <AccordionTrigger>Banking details</AccordionTrigger>
            <AccordionContent>
              Account number, IFSC, bank name.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value='verification'>
            <AccordionTrigger>Verification</AccordionTrigger>
            <AccordionContent>
              KYC and sanctions screening status.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title='Modal & Toast'>
        <div className='flex flex-wrap gap-3'>
          <Modal>
            <ModalTrigger asChild>
              <Button type='secondary'>Open modal</Button>
            </ModalTrigger>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>Confirm action</ModalTitle>
                <ModalDescription>
                  This is a demo modal from the component library.
                </ModalDescription>
              </ModalHeader>
              <ModalFooter>
                <ModalClose asChild>
                  <Button type='ghost'>Cancel</Button>
                </ModalClose>
                <ModalClose asChild>
                  <Button>Confirm</Button>
                </ModalClose>
              </ModalFooter>
            </ModalContent>
          </Modal>
          <Button
            type='secondary'
            onClick={() =>
              toast({ title: 'Saved', description: 'Your changes were saved.' })
            }
          >
            Fire toast
          </Button>
        </div>
      </Section>

      <Section title='Spinner'>
        <div className='flex items-center gap-4'>
          <Spinner size='sm' />
          <Spinner size='md' />
          <Spinner size='lg' />
        </div>
      </Section>

      <Section title='Table & DataTable'>
        <div className='flex flex-col gap-4'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataTable columns={tableColumns} data={tableRows} />
        </div>
      </Section>

      <Section title='Virtual list'>
        <VirtualList
          items={Array.from({ length: 1000 }, (_, i) => `Row ${i + 1}`)}
          itemHeight={36}
          height={200}
          renderItem={(item) => (
            <div className='border-border border-b px-3 py-2 text-sm'>
              {item}
            </div>
          )}
        />
      </Section>
    </>
  );
}
