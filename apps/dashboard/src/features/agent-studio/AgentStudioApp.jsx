import React from 'react';
import AgentContextPanel from './components/AgentContextPanel';
import AgentCopilot from './components/AgentCopilot';
import StoryboardCanvas from './components/StoryboardCanvas';
import { I18nProvider } from '../flow2capcut/hooks/useI18n';

const AgentStudioApp = () => {
  return (
    <I18nProvider>
      <div className="flex h-full w-full bg-gray-50 dark:bg-zinc-900 overflow-hidden text-sm min-h-0">
        {/* Left Panel: Context Manager */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col min-h-0">
          <AgentContextPanel />
        </div>

        {/* Center Panel: Agent Copilot (Chat & Prompt) */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex flex-col min-h-0 overflow-hidden relative">
          <AgentCopilot />
        </div>

        {/* Right Panel: Storyboard Canvas */}
        <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-950 min-h-0 flex flex-col">
          <StoryboardCanvas />
        </div>
      </div>
    </I18nProvider>
  );
};

export default AgentStudioApp;
