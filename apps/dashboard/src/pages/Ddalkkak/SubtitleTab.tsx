import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { toast } from 'sonner';

export const SubtitleTab: React.FC = () => {
  const [urlsInput, setUrlsInput] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch('/api/ddalkkak/jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
    const urls = urlsInput.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) {
      toast.error('URL을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch('/api/ddalkkak/jobs/upload-url', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ urls })
      });

      if (!res.ok) throw new Error('업로드 실패');
      
      toast.success('작업이 시작되었습니다.');
      setUrlsInput('');
      fetchJobs();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetail = async (job: any) => {
    setSelectedJob(job);
    setIsDetailOpen(true);
    // TODO: Fetch additional details if needed
  };

  const handleDelete = async (id: number) => {
    // API Call to delete
    toast.success('삭제 완료 (Mock)');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>새 자막 작업 추가</CardTitle>
          <CardDescription>유튜브, 틱톡 등 영상 URL을 줄바꿈으로 구분하여 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            placeholder="https://youtube.com/..." 
            className="min-h-[120px]"
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
          />
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? '요청 중...' : '작업 시작'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>자막 작업 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>URLs</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>진행률</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map(job => (
                <TableRow key={job.id}>
                  <TableCell>{job.id}</TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate text-xs">
                      {job.original_urls?.join(', ')}
                    </div>
                  </TableCell>
                  <TableCell>{job.status}</TableCell>
                  <TableCell>{job.progress}% - {job.progress_message}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDetail(job)}>상세/리뷰</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(job.id)}>삭제</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    작업 내역이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>작업 상세 내역 (ID: {selectedJob?.id})</DialogTitle>
            <DialogDescription>자막 텍스트 검토 및 YouTube 메타데이터를 확인하세요.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 p-4">
            <div className="space-y-2">
              <h3 className="font-bold">YouTube 메타데이터</h3>
              <Textarea 
                readOnly 
                className="h-24 bg-muted" 
                value="[생성된 메타데이터 API 데이터 연동 예정]" 
              />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold">자막 텍스트 리뷰</h3>
              <Textarea 
                className="h-48" 
                placeholder="여기에 SRT 자막 텍스트가 표시됩니다..."
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline">리뷰 완료 (저장)</Button>
                <Button>CapCut 내보내기</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
