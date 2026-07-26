import React from 'react';

const DdalkkakUI: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border bg-card shadow-sm flex-shrink-0">
        <h1 className="text-2xl font-bold text-foreground">딸깍 자동 생성</h1>
        <p className="text-sm text-muted-foreground mt-1">
          기존 딸깍 인터페이스를 그대로 활용하여 미디어를 일괄 생성합니다.
        </p>
      </div>
      <div className="flex-1 w-full bg-white relative">
        <iframe 
          src="/api/ddalkkak/" 
          className="w-full h-full border-none absolute inset-0"
          title="Ddalkkak Studio"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
        />
      </div>
    </div>
  );
};

export default DdalkkakUI;
