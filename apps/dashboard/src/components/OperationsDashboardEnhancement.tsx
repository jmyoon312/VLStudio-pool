/**
 * Operations Dashboard Enhancement
 * Shows system health, metrics, and alerts from new Phase 7-10 services
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, AlertTriangle, Server, Database, Zap, Clock,
  CheckCircle, XCircle, RefreshCw, BarChart3, TrendingUp
} from 'lucide-react';

// Use the new API endpoints
const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'http://127.0.0.1:8000/api' : '/api';

export const OperationsDashboardEnhancement = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30초마다 새로고침
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 병렬로 데이터 로드
      const [healthRes, metricsRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE}/health`),
        fetch(`${API_BASE}/metrics/dashboard`),
        fetch(`${API_BASE}/health/alerts`)
      ]);
      
      const health = await healthRes.json();
      const metrics = await metricsRes.json();
      const alertsData = await alertsRes.json();
      
      setHealthData(health);
      setMetricsData(metrics);
      setAlerts(alertsData.data || []);
    } catch (error) {
      console.error('Failed to load operations data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">System Status</p>
                <p className={`text-2xl font-bold capitalize ${getStatusColor(healthData?.overall_status)}`}>
                  {healthData?.overall_status || 'loading...'}
                </p>
              </div>
              <Activity className={`w-8 h-8 ${getStatusColor(healthData?.overall_status)}`} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">CPU Usage</p>
                <p className="text-2xl font-bold">
                  {healthData?.system_metrics?.cpu_percent || 0}%
                </p>
              </div>
              <Zap className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Memory Usage</p>
                <p className="text-2xl font-bold">
                  {healthData?.system_metrics?.memory_percent || 0}%
                </p>
              </div>
              <Database className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Alerts</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {alerts.length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Service Status</span>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {healthData?.service_health?.services && 
              Object.entries(healthData.service_health.services).map(([name, service]: [string, any]) => (
                <div key={name} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  {getStatusIcon(service.status)}
                  <div>
                    <p className="font-medium capitalize">{name}</p>
                    <p className="text-xs text-slate-600">{service.endpoint}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Today's Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-3xl font-bold">
                {metricsData?.kpis?.daily_uploads?.value || 0}
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Queue Depth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <span className="text-3xl font-bold">
                {metricsData?.kpis?.queue_depth?.value || 0}
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">SLA Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-3xl font-bold">
                {metricsData?.kpis?.upload_success_rate?.value 
                  ? (metricsData.kpis.upload_success_rate.value * 100).toFixed(1) 
                  : 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="w-5 h-5" />
              Active Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-xs text-slate-600">
                      {alert.service_name} • {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={alert.level === 'critical' ? 'destructive' : 'outline'}>
                    {alert.level}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OperationsDashboardEnhancement;