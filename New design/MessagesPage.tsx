import { Search, MoreVertical, Send, Smile, Image as ImageIcon, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  online: boolean;
}

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: string;
  read: boolean;
}


export function MessagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const selectedConv = selectedConversation 
    ? conversations.find(c => c.id === selectedConversation)
    : null;

  const handleSend = () => {
    if (messageText.trim()) {
      // Handle send message
      setMessageText("");
    }
  };

  // Mobile: Show conversation list OR chat view
  // Desktop: Show both side by side
  const showList = !selectedConversation;

  return (
    <div className="flex h-screen bg-black">
      {/* Conversation List */}
      <div className={`flex flex-col border-white/10 bg-black ${
        showList ? 'w-full' : 'hidden'
      } md:flex md:w-96 md:border-r`}>
        {/* Header */}
        <div className="border-b border-white/10 p-4">
          <h1 className="mb-4 text-white">Messages</h1>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/50 focus:border-[#FF8C00] focus:bg-white/10 focus:outline-none"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv.id)}
              className={`flex w-full items-center gap-3 border-b border-white/5 p-4 transition-all hover:bg-white/5 ${
                selectedConversation === conv.id ? 'bg-white/10' : ''
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <ImageWithFallback
                  src={conv.avatar}
                  alt={conv.name}
                  className="h-12 w-12 rounded-full object-cover sm:h-14 sm:w-14"
                />
                {conv.online && (
                  <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-black bg-green-500" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 text-left">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="truncate text-sm text-white sm:text-base">{conv.name}</h3>
                  <span className="ml-2 text-xs text-white/50">{conv.timestamp}</span>
                </div>
                <p className="truncate text-xs text-white/60 sm:text-sm">{conv.lastMessage}</p>
              </div>

              {/* Unread Badge */}
              {conv.unread > 0 && (
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#FF8C00] text-xs text-white">
                  {conv.unread}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat View */}
      {selectedConv && (
        <div className={`flex flex-1 flex-col ${showList ? 'hidden' : 'flex'} md:flex`}>
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 md:hidden"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              
              <div className="relative">
                <ImageWithFallback
                  src={selectedConv.avatar}
                  alt={selectedConv.name}
                  className="h-10 w-10 rounded-full object-cover sm:h-12 sm:w-12"
                />
                {selectedConv.online && (
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-black bg-green-500" />
                )}
              </div>

              <div>
                <h3 className="text-sm text-white sm:text-base">{selectedConv.name}</h3>
                <p className="text-xs text-white/60">
                  {selectedConv.online ? 'Active now' : 'Offline'}
                </p>
              </div>
            </div>

            <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10">
              <MoreVertical className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 sm:max-w-[60%] ${
                    message.sender === 'me'
                      ? 'bg-[#FF8C00] text-white'
                      : 'border border-white/10 bg-white/5 text-white'
                  }`}
                >
                  <p className="text-sm sm:text-base">{message.text}</p>
                  <p className={`mt-1 text-xs ${
                    message.sender === 'me' ? 'text-white/70' : 'text-white/50'
                  }`}>
                    {message.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="border-t border-white/10 p-4">
            <div className="flex items-end gap-2">
              <button className="mb-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10">
                <ImageIcon className="h-4 w-4 text-white sm:h-5 sm:w-5" />
              </button>
              
              <div className="relative flex-1">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  className="hide-scrollbar max-h-32 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-[#FF8C00] focus:bg-white/10 focus:outline-none sm:text-base"
                />
                <button className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-white/10">
                  <Smile className="h-4 w-4 text-white/50 sm:h-5 sm:w-5" />
                </button>
              </div>

              <button
                onClick={handleSend}
                disabled={!messageText.trim()}
                className="mb-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#FF8C00] transition-all hover:bg-[#FF9D1A] disabled:opacity-50 disabled:hover:bg-[#FF8C00]"
              >
                <Send className="h-4 w-4 text-white sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State (Desktop only) */}
      {!selectedConversation && (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <Send className="h-8 w-8 text-white/30" />
            </div>
            <h3 className="mb-2 text-white">Select a conversation</h3>
            <p className="text-sm text-white/60">
              Choose from your existing conversations or start a new one
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
