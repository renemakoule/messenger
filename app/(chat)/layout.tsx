"use client";

// import AuthGuard from "@/components/auth/auth-guard"; // CETTE LIGNE EST SUPPRIMÉE
import ChatSidebar from "@/components/chat/chat-sidebar";
//import LeftNavbar from "@/components/layout/left-navbar";
//import RightNavbar from "@/components/layout/right-navbar";
//mport TopNavbar from "@/components/layout/top-navbar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
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