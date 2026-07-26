import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Settings, Plus, Trash2, ArrowUp, ArrowDown, ExternalLink, Save } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface CustomLink {
    id: number;
    title: string;
    url: string;
    order_index: number;
}

let customMenuCache: {
    selectedLink: CustomLink | null;
} = {
    selectedLink: null
};

export default function CustomMenu() {
    const [links, setLinks] = useState<CustomLink[]>([]);
    const [selectedLink, setSelectedLinkState] = useState<CustomLink | null>(customMenuCache.selectedLink);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const setSelectedLink = (val: CustomLink | null) => {
        customMenuCache.selectedLink = val;
        setSelectedLinkState(val);
    };

    // Dialog State
    const [editingLinks, setEditingLinks] = useState<CustomLink[]>([]);
    const [newTitle, setNewTitle] = useState("");
    const [newUrl, setNewUrl] = useState("");

    useEffect(() => {
        fetchLinks();
    }, []);

    const fetchLinks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/custom-links`);
            if (res.ok) {
                const data = await res.json();
                setLinks(data);
                // Select first link if none selected and links exist
                if (!customMenuCache.selectedLink && data.length > 0) {
                    setSelectedLink(data[0]);
                }
            }
        } catch (error) {
            console.error("Failed to fetch links:", error);
        }
    };

    const handleOpenDialog = () => {
        setEditingLinks([...links]);
        setIsDialogOpen(true);
    };

    const handleSaveDialog = async () => {
        // Save reordering
        const orderedIds = editingLinks.map(l => l.id);
        try {
            await fetch(`${API_BASE_URL}/custom-links/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderedIds)
            });
            await fetchLinks();
        } catch (error) {
            console.error("Failed to reorder links:", error);
        } finally {
            setIsDialogOpen(false);
        }
    };

    const handleAddLink = async () => {
        if (!newTitle || !newUrl) return;
        try {
            const res = await fetch(`${API_BASE_URL}/custom-links`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, url: newUrl })
            });
            if (res.ok) {
                const newLink = await res.json();
                setEditingLinks([...editingLinks, newLink]);
                setNewTitle("");
                setNewUrl("");
                // Refresh main list in background
                fetchLinks();
            }
        } catch (error) {
            console.error("Failed to add link:", error);
        }
    };

    const handleDeleteLink = async (id: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/custom-links/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setEditingLinks(editingLinks.filter(l => l.id !== id));
                fetchLinks();
            }
        } catch (error) {
            console.error("Failed to delete link:", error);
        }
    };

    // Update local state immediately for smooth typing
    const handleUpdateLink = (id: number, title: string, url: string) => {
        setEditingLinks(editingLinks.map(l => l.id === id ? { ...l, title, url } : l));
    };

    // Save to server on blur
    const handleBlurLink = async (link: CustomLink) => {
        try {
            await fetch(`${API_BASE_URL}/custom-links/${link.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: link.title, url: link.url })
            });
            fetchLinks();
        } catch (error) {
            console.error("Failed to update link:", error);
        }
    };

    const moveLink = (index: number, direction: 'up' | 'down') => {
        const newLinks = [...editingLinks];
        if (direction === 'up' && index > 0) {
            [newLinks[index], newLinks[index - 1]] = [newLinks[index - 1], newLinks[index]];
        } else if (direction === 'down' && index < newLinks.length - 1) {
            [newLinks[index], newLinks[index + 1]] = [newLinks[index + 1], newLinks[index]];
        }
        setEditingLinks(newLinks);
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Zone 1: Top Bar */}
            <div className="flex items-center border-b p-2 gap-2 bg-card shadow-sm z-10">
                <ScrollArea className="flex-1 whitespace-nowrap">
                    <div className="flex w-max space-x-2 p-1">
                        {links.map((link) => (
                            <Button
                                key={link.id}
                                variant={selectedLink?.id === link.id ? "default" : "ghost"}
                                onClick={() => setSelectedLink(link)}
                                className="h-9"
                            >
                                {link.title}
                            </Button>
                        ))}
                        {links.length === 0 && (
                            <span className="text-sm text-muted-foreground px-2 py-2">
                                등록된 메뉴가 없습니다. 설정에서 추가해주세요.
                            </span>
                        )}
                    </div>
                </ScrollArea>
                {selectedLink && (
                    <Button variant="ghost" size="icon" title="새 탭에서 열기" onClick={() => window.open(selectedLink.url, '_blank')}>
                        <ExternalLink className="h-5 w-5" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" onClick={handleOpenDialog}>
                    <Settings className="h-5 w-5" />
                </Button>
            </div>

            {/* Zone 2: Center Content */}
            <div className="flex-1 bg-muted/20 relative">
                {selectedLink ? (
                    <iframe
                        src={selectedLink.url}
                        className="w-full h-full border-none"
                        title={selectedLink.title}
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <ExternalLink className="h-12 w-12 mb-4 opacity-20" />
                        <p>메뉴를 선택하거나 새로운 링크를 추가하세요.</p>
                    </div>
                )}
            </div>

            {/* Zone 3: Management Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>커스텀 메뉴 관리</DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
                        {editingLinks.map((link, index) => (
                            <div key={link.id} className="flex items-center gap-2 bg-muted/30 p-2 rounded-md border">
                                <div className="flex flex-col gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveLink(index, 'up')} disabled={index === 0}>
                                        <ArrowUp className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveLink(index, 'down')} disabled={index === editingLinks.length - 1}>
                                        <ArrowDown className="h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                    <Input
                                        value={link.title}
                                        onChange={(e) => handleUpdateLink(link.id, e.target.value, link.url)}
                                        onBlur={() => handleBlurLink(link)}
                                        placeholder="제목"
                                    />
                                    <Input
                                        value={link.url}
                                        onChange={(e) => handleUpdateLink(link.id, link.title, e.target.value)}
                                        onBlur={() => handleBlurLink(link)}
                                        placeholder="URL (https://...)"
                                    />
                                </div>
                                <Button variant="destructive" size="icon" onClick={() => handleDeleteLink(link.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}

                        {/* Add New Section */}
                        <div className="flex items-center gap-2 border-t pt-4 mt-4">
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <Input
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="새 메뉴 제목"
                                />
                                <Input
                                    value={newUrl}
                                    onChange={(e) => setNewUrl(e.target.value)}
                                    placeholder="새 URL (https://...)"
                                />
                            </div>
                            <Button onClick={handleAddLink} disabled={!newTitle || !newUrl}>
                                <Plus className="h-4 w-4 mr-2" />
                                추가
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={handleSaveDialog}>저장 및 닫기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
