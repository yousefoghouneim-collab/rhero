import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { StockCountView } from '../../components/StockCountView';
import { PageTop } from './common';

export default function ManagerCount() {
  const { section } = useParams();
  const s = section === 'stationery' ? 'stationery' : 'pantry';
  const title = s === 'stationery' ? 'Stationery count' : 'Pantry & cleaning count';
  return (
    <div>
      <PageTop title={title} sub="Adjust what changed, then save" back={<Link to="/m/inventory" className="-ms-1 rounded-lg p-1.5 text-navy-700 hover:bg-navy-50" aria-label="Back"><ArrowLeft className="h-6 w-6" /></Link>} />
      <div className="mx-auto max-w-3xl">
        <StockCountView section={s} title={title} bottomClass="bottom-[calc(66px+env(safe-area-inset-bottom))] lg:bottom-4 lg:ps-[264px]" />
      </div>
    </div>
  );
}
