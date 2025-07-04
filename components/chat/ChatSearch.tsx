"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function ChatSearch({ searchTerm, onSearchChange }) {
  return (
    <div className="p-4 border-b">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="text" placeholder="Search chats..." className="pl-8" value={searchTerm} onChange={onSearchChange} />
      </div>
    </div>
  );
}