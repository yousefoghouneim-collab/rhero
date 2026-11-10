import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { Logo } from '../../components/Brand';
import { Button } from '../../components/ui';

function Line({ label, wide }: { label: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-6 border-b border-ink/40" />
    </div>
  );
}

export default function PrintTemplate() {
  const { kind } = useParams();
  const pass = kind === 'pass';
  return (
    <div className="min-h-dvh bg-white p-6 text-ink print:p-0">
      <div className="mx-auto max-w-[760px]">
        <div className="no-print mb-6 flex justify-end"><Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button></div>
        <div className="flex items-center justify-between">
          <Logo className="h-10" />
          <div className="text-end text-sm text-muted">RH Aero Systems · Dubai South<br />Office Management</div>
        </div>
        <div className="mt-3 h-1.5 rounded livery bg-navy-700" />
        <h1 className="mt-5 text-2xl font-semibold">{pass ? 'Visitor gate pass request' : 'Item request / shopping list'}</h1>
        <p className="text-sm text-muted">{pass ? 'Please hand to the office manager at least 24 hours before the visit.' : 'Please fill in one line per item and hand to the office manager.'}</p>

        {pass ? (
          <div className="mt-6 space-y-7">
            <section><h2 className="mb-3 font-semibold text-navy-700">Host (employee)</h2><div className="grid grid-cols-2 gap-x-8 gap-y-5"><Line label="Name" /><Line label="Team / department" /><Line label="Mobile" /><Line label="Email" /></div></section>
            <section><h2 className="mb-3 font-semibold text-navy-700">Visitor</h2><div className="grid grid-cols-2 gap-x-8 gap-y-5"><Line label="Full name (as on ID)" wide /><Line label="Emirates ID / passport no." /><Line label="Nationality" /><Line label="Company" /><Line label="Occupation / job title" /><Line label="Mobile" /><Line label="Email" /><Line label="Car plate (if driving)" /><Line label="Equipment / laptops brought in" /></div></section>
            <section><h2 className="mb-3 font-semibold text-navy-700">Visit</h2><div className="grid grid-cols-2 gap-x-8 gap-y-5"><Line label="Date" /><Line label="Arrival – leaving time" /><Line label="Reason for visit" wide /><Line label="Meeting (person & team)" wide /><Line label="Other visitors (name & ID)" wide /></div></section>
            <section className="grid grid-cols-2 gap-x-8 gap-y-5"><Line label="Requested by (signature)" /><Line label="Approved by office manager" /></section>
          </div>
        ) : (
          <div className="mt-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-5"><Line label="Your name" /><Line label="Department / team" /><Line label="Mobile / email" /><Line label="Date" /></div>
            <table className="mt-7 w-full border-collapse text-[13px]">
              <thead><tr className="bg-sunken text-start">{['#', 'Item needed', 'Qty', 'Specs (model, size, colour)', 'Why needed', 'Needed by', 'Link / example'].map((h) => <th key={h} className="border border-line p-2 text-start font-semibold">{h}</th>)}</tr></thead>
              <tbody>{Array.from({ length: 10 }).map((_, i) => <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j} className="h-10 border border-line p-2">{j === 0 ? i + 1 : ''}</td>)}</tr>)}</tbody>
            </table>
            <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5"><Line label="Requested by (signature)" /><Line label="Approved by office manager" /></div>
          </div>
        )}
        <p className="mt-10 text-center text-xs text-muted">Prefer your phone? Ask the office manager for the RHero form link or scan the QR code in the kitchen.</p>
      </div>
    </div>
  );
}
