import { useI18n } from '../../i18n';
import { StockCountView } from '../../components/StockCountView';

export default function CleanerStock() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 px-5 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur">
        <h1 className="text-xl font-semibold">📦 {t('stockTitle')}</h1>
      </header>
      <StockCountView section="pantry" title={t('stockTitle')} />
    </div>
  );
}
