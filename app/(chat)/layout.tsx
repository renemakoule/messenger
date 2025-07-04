"use client";

// import AuthGuard from "@/components/auth/auth-guard"; // CETTE LIGNE EST SUPPRIMÉE
import ChatSidebar from "@/components/chat/chat-sidebar";
//import LeftNavbar from "@/components/layout/left-navbar";
//import RightNavbar from "@/components/layout/right-navbar";
//mport TopNavbar from "@/components/layout/top-navbar";
import { useState, useEffect } from "react";
import { Users, MessageSquare } from "lucide-react";

function isMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 768;
}

function MobileTabBar({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  return (
    <div className="fixed bottom-0 left-0 w-full h-16 bg-white/80 backdrop-blur-md border-t flex z-[100] md:hidden shadow-lg rounded-t-2xl">
      <button
        className={`flex-1 flex flex-col items-center justify-center transition-colors ${tab === "chats" ? "text-primary scale-110 font-bold" : "text-gray-400"}`}
        onClick={() => setTab("chats")}
      >
        <Users className="w-7 h-7 mb-0.5" />
        <span className="text-xs">Chats</span>
      </button>
      <button
        className={`flex-1 flex flex-col items-center justify-center transition-colors ${tab === "chat" ? "text-primary scale-110 font-bold" : "text-gray-400"}`}
        onClick={() => setTab("chat")}
      >
        <MessageSquare className="w-7 h-7 mb-0.5" />
        <span className="text-xs">Conversation</span>
      </button>
    </div>
  );
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [tab, setTab] = useState("chats");

  useEffect(() => {
    const handleResize = () => setMobile(isMobile());
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mobile layout: tab bar + full screen content
  if (mobile) {
    const handleChatClick = () => setTab("chat");
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-background">
        <div className="h-full w-full pb-14"> {/* pb-14 pour laisser la place à la tabbar */}
          {tab === "chats" ? (
            <div className="w-full h-full"><ChatSidebar onChatClick={handleChatClick} /></div>
          ) : (
            <div className="w-full h-full">{children}</div>
          )}
        </div>
        <MobileTabBar tab={tab} setTab={setTab} />
      </div>
    );
  }

  // Desktop layout (inchangé)
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* AuthGuard a été supprimé d'ici */}
      {/* Left Navbar - Sticky */}
      {/* <div className="h-full">
        <LeftNavbar />
      </div> */}
      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-full">
        {/* Top Navbar - Sticky */}
        {/* <div className="flex-shrink-0">
          <TopNavbar />
        </div> */}
        {/* Middle Section: ChatSidebar, Main Content, RightNavbar */}
        <div className="flex flex-1 h-full overflow-hidden">
          {/* Chat Sidebar - Sticky with proper scrolling */}
          <div className="h-full w-[300px] flex-shrink-0  hide-scrollbar">
            <ChatSidebar />
          </div>
          {/* Main Content - Scrollable */}
          <div className="flex-1 h-full overflow-y-auto hide-scrollbar">{children}</div>
          {/* Right Navbar - Sticky */}
          {/* <div className="h-full">
            <RightNavbar />
          </div> */}
        </div>
      </div>
    </div>
  );
}