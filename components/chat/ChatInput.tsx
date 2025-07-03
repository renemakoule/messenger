"use client";
import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mic, Paperclip, Send, Smile, Loader2, Square, SendHorizonalIcon } from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";

interface ChatInputProps {
    newMessage: string;
    setNewMessage: (value: string) => void;
    onSendMessage: () => void;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onAttachClick: () => void; // <-- NOUVELLE PROP
    isRecording: boolean;
    isSending: boolean;
}

export function ChatInput({
    newMessage,
    setNewMessage,
    onSendMessage,
    onStartRecording,
    onStopRecording,
    onAttachClick, // <-- NOUVELLE PROP
    isRecording,
    isSending
}: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewMessage(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSendMessage();
        }
    };

    return (
        <footer className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg p-3 sm:p-4">
            <div className="relative flex items-end gap-2">
                {isRecording ? (
                    <div className="flex h-12 cursor-pointer items-center w-full bg-slate-100 dark:bg-slate-800 rounded-lg px-4">
                        <div className="text-red-500 animate-pulse mr-3"><Mic size={24} /></div>
                        <p className="text-lg font-mono text-slate-700 dark:text-slate-300">Recording...</p>
                        <div className="flex-grow"></div>
                        <Button variant="destructive" size="icon" onClick={onStopRecording}>
                            <Square size={20} />
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 relative w-[350px]">
                            <Textarea ref={textareaRef} value={newMessage} onChange={handleTextareaChange} onKeyDown={handleKeyDown} placeholder="Type a message..." className="min-h-[70px] max-h-48 w-full rounded-2xl bg-slate-100 dark:bg-slate-800 py-3 pl-4 pr-28 text-base focus:outline-none focus:ring-2 focus:ring-primary dark:text-white resize-none" rows={1} />
                            <div className="absolute bottom-2.5 right-2 flex items-center cursor-pointer">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            {/* CORRECTION: Ajout du onClick ici */}
                                            <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer text-slate-500 hover:text-primary" onClick={onAttachClick}>
                                                <Paperclip />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Attach file</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer text-slate-500 hover:text-primary" onClick={() => setShowEmojiPicker(p => !p)}>
                                                <Smile />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Emoji</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                {showEmojiPicker && <div className="absolute cursor-pointer bottom-12 right-0 z-10"><EmojiPicker onEmojiClick={(e) => setNewMessage(newMessage + e.emoji)} theme={Theme.DARK} /></div>}
                                <Button onClick={newMessage.trim() ? onSendMessage : onStartRecording} disabled={isSending} size="icon" className="h-8 w-8 cursor-pointer rounded-full flex-shrink-0 bg-primary hover:bg-primary/90 transition-transform active:scale-95">
                                    {isSending ? <Loader2 className="animate-spin" /> : (newMessage.trim() ? <SendHorizonalIcon /> : <Mic />)}
                                </Button>
                            </div>
                        </div>

                    </>
                )}
            </div>
        </footer>
    );
}