import React, { useRef } from 'react';
import { useAgentStore } from '../store/useAgentStore';
import { Plus, ToggleLeft, ToggleRight, Trash2, Image as ImageIcon } from 'lucide-react';

const AgentContextPanel = () => {
  const { contexts, addContext, toggleContext, removeContext, updateContext } = useAgentStore();
  const fileInputRefs = useRef({});

  const handleAddDemoContext = () => {
    addContext({
      id: Date.now().toString(),
      type: 'character',
      file: null,
      previewUrl: null,
      prompt: '20대 트렌디한 여성 모델, 활기찬 표정',
      isActive: true
    });
  };

  const handleImageUpload = (id, e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateContext(id, { file, previewUrl: url });
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">에이전트 요청 사항</h2>
        <p className="text-xs text-gray-500 mt-1">캐릭터 및 레퍼런스 이미지 고정</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {contexts.map((ctx) => (
          <div key={ctx.id} className="p-3 bg-gray-100 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded">
                {ctx.type === 'character' ? '캐릭터 고정' : '제품 고정'}
              </span>
              <div className="flex space-x-2">
                <button onClick={() => toggleContext(ctx.id)} className="text-gray-500 hover:text-blue-500">
                  {ctx.isActive ? <ToggleRight size={20} className="text-blue-500" /> : <ToggleLeft size={20} />}
                </button>
                <button onClick={() => removeContext(ctx.id)} className="text-gray-500 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="flex gap-3 mb-2">
              <div 
                className="w-16 h-16 bg-gray-200 dark:bg-zinc-800 rounded flex items-center justify-center cursor-pointer hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors flex-shrink-0 overflow-hidden"
                onClick={() => fileInputRefs.current[ctx.id]?.click()}
                title="레퍼런스 이미지 첨부"
              >
                {ctx.previewUrl ? (
                  <img src={ctx.previewUrl} alt="Reference" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={20} className="text-gray-400" />
                )}
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp" 
                  hidden 
                  ref={el => fileInputRefs.current[ctx.id] = el}
                  onChange={(e) => handleImageUpload(ctx.id, e)}
                />
              </div>
              <textarea
                className="flex-1 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded p-2 text-xs text-gray-800 dark:text-gray-200 resize-none focus:border-blue-500 focus:outline-none"
                rows="3"
                value={ctx.prompt}
                onChange={(e) => updateContext(ctx.id, { prompt: e.target.value })}
                placeholder="인물의 외모나 옷차림 등을 묘사하세요..."
              />
            </div>
          </div>
        ))}
        
        <button 
          onClick={handleAddDemoContext}
          className="w-full flex items-center justify-center py-2 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
        >
          <Plus size={16} className="mr-2" /> 캐릭터/레퍼런스 추가
        </button>
      </div>
    </div>
  );
};

export default AgentContextPanel;
