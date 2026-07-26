import React from 'react';
import { RadarChartComponent } from './RadarChart';
import { ChartCard } from './ChartCard';

interface DemographicsData {
    age_groups: Array<{
        age_group: string;
        percentage: number;
    }>;
    gender: Array<{
        gender: string;
        percentage: number;
    }>;
}

interface DemographicsChartProps {
    data: DemographicsData;
}

// Map age groups to radar chart format
const AGE_GROUP_NAMES: Record<string, string> = {
    'age18-24': '18-24세',
    'age25-34': '25-34세',
    'age35-44': '35-44세',
    'age45-54': '45-54세',
    'age55-64': '55-64세',
    'age65-': '65세 이상'
};

export const DemographicsChart: React.FC<DemographicsChartProps> = ({ data }) => {
    // Handle empty data
    if (!data || !data.age_groups || data.age_groups.length === 0) {
        return (
            <ChartCard title="시청자 연령대" subtitle="인구통계 분석" height={320}>
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                    <p>데이터가 없습니다</p>
                    <p className="text-xs mt-1">(Manager 권한 제한)</p>
                </div>
            </ChartCard>
        );
    }

    // Transform age group data for radar chart
    // RadarChartComponent expects 'category' as the axis key
    const radarData = data.age_groups.map(item => ({
        category: AGE_GROUP_NAMES[item.age_group] || item.age_group,
        value: item.percentage,
        fullMark: 100
    }));

    return (
        <ChartCard title="시청자 연령대" subtitle="인구통계 분석" height={320}>
            <RadarChartComponent
                data={radarData}
                dataKeys={[
                    { key: 'value', name: '시청 비율', color: '#6366f1' }
                ]}
            />
        </ChartCard>
    );
};
