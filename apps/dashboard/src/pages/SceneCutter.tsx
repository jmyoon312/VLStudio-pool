import React from 'react';

const SceneCutter: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col bg-background">
      <iframe
        src="/scene-cutter/index.html"
        className="w-full h-full border-none"
        title="Scene Cutter Pro"
        sandbox="allow-scripts allow-same-origin allow-downloads allow-modals allow-popups allow-forms"
        allow="cross-origin-isolated"
      />
    </div>
  );
};

export default SceneCutter;
