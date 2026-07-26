import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Cpu, HardDrive, Database } from 'lucide-react';

interface SystemStats {
    cpu: number;
    ram: number;
    gpu: number;
    disk: number;
}

const SystemMonitor = () => {
    const [stats, setStats] = useState<SystemStats>({ cpu: 0, ram: 0, gpu: 0, disk: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('/tools/system/stats');
                setStats(res.data);
            } catch (error) {
                console.error("Failed to fetch system stats", error);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 2000);
        return () => clearInterval(interval);
    }, []);

    const getColor = (val: number) => {
        if (val > 80) return 'bg-red-500';
        if (val > 50) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.cpu.toFixed(1)}%</div>
                    <div className="h-2 w-full bg-gray-100 rounded-full mt-2 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${getColor(stats.cpu)}`}
                            style={{ width: `${stats.cpu}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Memory (RAM)</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.ram.toFixed(1)}%</div>
                    <div className="h-2 w-full bg-gray-100 rounded-full mt-2 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${getColor(stats.ram)}`}
                            style={{ width: `${stats.ram}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Disk Usage (F:)</CardTitle>
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.disk.toFixed(1)}%</div>
                    <div className="h-2 w-full bg-gray-100 rounded-full mt-2 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${getColor(stats.disk)}`}
                            style={{ width: `${stats.disk}%` }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SystemMonitor;
