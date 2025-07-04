"use client";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, Plus, Settings, X } from "lucide-react";
import { FaFilter } from "react-icons/fa";
import { IoCreate } from "react-icons/io5";

export function ChatSidebarHeader({ activeFilter, onNewFilter, onNewChat, onSettings, onClearFilter }) {
  return (
    <div className="flex h-16 flex-shrink-0 items-center justify-between border-b bg-background px-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-1 text-sm">
            <FaFilter className="h-3 w-3" />
            {activeFilter ? activeFilter.name : "Custom Filters"}
            {activeFilter && <X className="ml-1 h-3 w-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); onClearFilter(); }} />}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem onClick={onNewFilter} className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            Create New Filter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex items-center space-x-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onNewChat}>
              <IoCreate className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>New Chat</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onSettings}>
              <Settings className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Settings</p></TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}