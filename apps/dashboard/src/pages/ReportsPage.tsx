import { DailyReportList } from '@/components/Reports/DailyReportList';
// Layout is handled in App.tsx

export function ReportsPage() {
    return (
        <div className="h-full flex-1 flex-col space-y-8 p-8 md:flex">
            <DailyReportList />
        </div>
    );
}
