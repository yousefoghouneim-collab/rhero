import { Link } from 'react-router-dom';
import { BadgeCheck, BarChart3, ChevronRight, ClipboardList, FileText, Lock, Settings, Users } from 'lucide-react';
import { useAuth, useMe } from '../../auth/AuthProvider';
import { useRequests, usePasses } from '../../lib/data';
import { Avatar, Badge, Card } from '../../components/ui';
import { PageBody, PageTop } from './common';

export default function More() {
  const { me, org } = useMe();
  const { signOut } = useAuth();
  const reqs = useRequests();
  const passes = usePasses();
  const links = [
    { to: '/m/requests', icon: ClipboardList, label: 'Requests & orders', sub: 'Monitors, desks, chairs, docks…', badge: (reqs.data ?? []).filter((r) => r.status === 'new').length },
    { to: '/m/passes', icon: BadgeCheck, label: 'Gate passes', sub: 'Visitors & interviewees', badge: (passes.data ?? []).filter((p) => p.status === 'pending').length },
    { to: '/m/forms', icon: FileText, label: 'Forms & templates', sub: 'Shopping list & gate pass forms, QR codes' },
    { to: '/m/reports', icon: BarChart3, label: 'Daily reports', sub: 'The 4 PM summary, history & sharing' },
    { to: '/m/team', icon: Users, label: 'Team', sub: 'Cleaners, PINs, access' },
    { to: '/m/settings', icon: Settings, label: 'Settings', sub: 'Report time, shift, account, notifications' },
  ];
  const roadmap = ['Utility & supplier invoices', 'Budgets & spend tracking', 'Petty cash', 'Staff kits (SIM, roaming, laptops, headsets)', 'Security access cards', 'SAP & other systems (MCP)', 'Employee requests portal'];
  return (
    <div>
      <PageTop title="More" />
      <PageBody>
        <Card className="mb-4 flex items-center gap-3 p-4">
          <Avatar name={me.full_name} color="#af1615" size={46} />
          <div className="min-w-0 flex-1"><p className="font-semibold">{me.full_name}</p><p className="truncate text-sm text-muted">Office manager · {org.name}</p></div>
          <button onClick={() => void signOut()} className="text-sm font-semibold text-bad">Sign out</button>
        </Card>
        <Card className="divide-y divide-line">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="flex items-center gap-3 p-4 hover:bg-sunken/60">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700"><l.icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{l.label}</span><span className="block truncate text-[13px] text-muted">{l.sub}</span></span>
              {!!l.badge && <Badge tone="red">{l.badge}</Badge>}
              <ChevronRight className="h-5 w-5 text-navy-200" />
            </Link>
          ))}
        </Card>
        <h2 className="mb-2 mt-6 text-[13px] font-semibold uppercase tracking-wider text-muted">Coming in the next phases</h2>
        <Card className="divide-y divide-line">
          {roadmap.map((r) => (
            <div key={r} className="flex items-center gap-3 p-3.5 text-muted"><Lock className="h-4 w-4" /><span className="flex-1">{r}</span><Badge>Soon</Badge></div>
          ))}
        </Card>
      </PageBody>
    </div>
  );
}
