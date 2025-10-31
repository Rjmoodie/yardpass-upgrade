import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MoreVertical, Send, Smile, Image as ImageIcon, ArrowLeft, X, UserPlus, Users } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useAuth } from "@/contexts/AuthContext";
import { transformConversations, transformMessages, getTimeAgo } from "@/lib/dataTransformers";
import { UserSearchModal } from "@/components/follow/UserSearchModal";

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

export function MessagesPageIntegrated() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showUserSearch, setShowUserSearch] = useState(false);

  // Load conversations
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        // TODO: Implement real conversation loading from messaging schema
        // For now, show empty state
        setConversations([]);
        setLoading(false);
      } catch (error) {
        console.error('Error loading conversations:', error);
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user?.id]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const loadMessages = async () => {
      // Load messages from messaging schema
      // Integration with real-time subscriptions
    };

    loadMessages();
  }, [selectedConversation]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      await sendMessage(selectedConversation, newMessage);
      setNewMessage("");
      // Optimistically add message to UI
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border/10 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Conversations List */}
      <div className={`${selectedConversation ? 'hidden sm:flex' : 'flex'} flex-col border-r border-border/10 bg-background w-full sm:w-80 md:w-96`}>
        {/* Header */}
        <div className="border-b border-border/10 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">Messages</h2>
            <button
              onClick={() => setShowUserSearch(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-foreground transition-all hover:bg-primary/90 active:scale-95"
              title="New Message"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-full border border-border/10 bg-white/5 pl-9 pr-9 text-sm text-foreground placeholder:text-foreground/50 focus:border-primary focus:bg-white/10 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv.id)}
              className={`w-full border-b border-border/5 p-3 text-left transition-all hover:bg-white/5 sm:p-4 ${
                selectedConversation === conv.id ? 'bg-white/10' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ImageWithFallback
                    src={conv.avatar}
                    alt={conv.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  {conv.online && (
                    <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-black bg-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-foreground truncate">{conv.name}</p>
                    <span className="text-xs text-foreground/50">{conv.timestamp}</span>
                  </div>
                  <p className="text-xs text-foreground/60 truncate">{conv.lastMessage}</p>
                </div>
                {conv.unread > 0 && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-foreground">
                    {conv.unread}
                  </div>
                )}
              </div>
            </button>
          ))}

          {/* Empty State */}
          {filteredConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                <Search className="h-8 w-8 text-foreground/30" />
              </div>
              <p className="text-sm font-semibold text-foreground">No conversations found</p>
              <p className="mt-1 text-xs text-foreground/60">
                {searchQuery ? 'Try a different search' : 'Start a conversation'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Message View */}
      {selectedConversation ? (
        <div className="flex flex-1 flex-col bg-background">
          {/* Chat Header */}
          <div className="border-b border-border/10 p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="sm:hidden flex h-9 w-9 items-center justify-center rounded-full border border-border/10 bg-white/5 transition-all hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </button>
              
              {conversations.find(c => c.id === selectedConversation) && (
                <>
                  <ImageWithFallback
                    src={conversations.find(c => c.id === selectedConversation)!.avatar}
                    alt={conversations.find(c => c.id === selectedConversation)!.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {conversations.find(c => c.id === selectedConversation)!.name}
                    </p>
                    <p className="text-xs text-foreground/60">
                      {conversations.find(c => c.id === selectedConversation)!.online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </>
              )}
              
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-border/10 bg-white/5 transition-all hover:bg-white/10">
                <MoreVertical className="h-5 w-5 text-foreground" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      message.sender === 'me'
                        ? 'bg-primary text-foreground'
                        : 'border border-border/10 bg-white/5 text-foreground'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <p className={`mt-1 text-xs ${
                      message.sender === 'me' ? 'text-foreground/70' : 'text-foreground/50'
                    }`}>
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div className="border-t border-border/10 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-border/10 bg-white/5 transition-all hover:bg-white/10">
                <ImageIcon className="h-5 w-5 text-foreground" />
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="h-10 w-full rounded-full border border-border/10 bg-white/5 px-4 pr-10 text-sm text-foreground placeholder:text-foreground/50 focus:border-primary focus:bg-white/10 focus:outline-none"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground">
                  <Smile className="h-5 w-5" />
                </button>
              </div>
              <button 
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-5 w-5 text-foreground" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* No Conversation Selected */
        <div className="hidden sm:flex flex-1 items-center justify-center bg-background">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <Send className="h-8 w-8 text-foreground/30" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-foreground">Select a conversation</h3>
            <p className="text-sm text-foreground/60">
              Choose a conversation from the list to start messaging
            </p>
          </div>
        </div>
      )}
      
      {/* User Search Modal for New Message */}
      <UserSearchModal
        open={showUserSearch}
        onOpenChange={setShowUserSearch}
        onSelectUser={(userId) => {
          // Navigate to messages with the selected user
          navigate(`/messages?to=${userId}`);
          setShowUserSearch(false);
        }}
      />
    </div>
  );
}

export default MessagesPageIntegrated;

