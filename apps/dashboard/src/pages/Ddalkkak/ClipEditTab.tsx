import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

export const ClipEditTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>새 클립편집 작업 추가</CardTitle>
          <CardDescription>영상 클립들을 불러오고 편집하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button>새 클립 커터 열기</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>클립편집 작업 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>클립 이름</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>진행률</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  작업 내역이 없습니다. (API 연동 대기 중)
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
