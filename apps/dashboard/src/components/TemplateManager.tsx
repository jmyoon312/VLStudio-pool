import React from 'react';
import { useEditorStore, Template } from '../hooks/useEditorStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, LayoutTemplate, Trash2 } from 'lucide-react';

const TemplateManager = () => {
    const { templates, saveTemplateRemote, applyTemplate, fetchTemplates, deleteTemplateRemote } = useEditorStore();

    React.useEffect(() => {
        fetchTemplates();
    }, []);

    const handleSave = async () => {
        const name = prompt("Enter template name:");
        if (name) {
            await saveTemplateRemote(name);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this template?")) {
            await deleteTemplateRemote(id);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <LayoutTemplate className="w-4 h-4" /> Templates
                </h3>
                <Button size="sm" variant="outline" onClick={handleSave}>
                    <Plus className="w-4 h-4 mr-1" /> Save Current
                </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3">
                    {templates.map((template) => (
                        <Card key={template.id} className="overflow-hidden group cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all" onClick={() => applyTemplate(template.id)}>
                            <div className="aspect-video bg-slate-100 flex items-center justify-center relative">
                                {template.thumbnail ? (
                                    <img src={template.thumbnail} className="w-full h-full object-cover" />
                                ) : (
                                    <LayoutTemplate className="w-8 h-8 text-slate-700" />
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <span className="text-white font-medium text-xs bg-black/50 px-2 py-1 rounded">Apply</span>
                                </div>
                            </div>
                            <div className="p-2 bg-white flex items-center justify-between">
                                <span className="text-xs font-medium truncate flex-1">{template.name}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-600 hover:text-red-500" onClick={(e) => handleDelete(e, template.id)}>
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        </Card>
                    ))}

                    {templates.length === 0 && (
                        <div className="col-span-2 py-8 text-center text-slate-600 text-sm">
                            No templates saved yet.
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default TemplateManager;
