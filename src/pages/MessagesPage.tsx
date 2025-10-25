import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Image as ImageIcon, MoreVertical, Search, Send, Smile } from 'lucide-react';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';

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


export default function MessagesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const conversationId = params.get('conversation');
    if (conversationId) {
      setSelectedConversation(conversationId);
    }
  }, [location.search]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      conversation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery, conversations]);

  const selectedConversationDetails =
    selectedConversation && filteredConversations.find((conversation) => conversation.id === selectedConversation);

  const handleSend = () => {
    if (messageText.trim()) {
      setMessageText('');
    }
  };

  const showList = !selectedConversationDetails;

  return (
    <div className="flex h-screen bg-black text-white">
      <div
        className={`flex flex-col border-white/10 bg-black ${
          showList ? 'w-full' : 'hidden'
        } md:flex md:w-96 md:border-r`}
      >
        <div className="border-b border-white/10 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-lg">Messages</h1>
            <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/50 focus:border-[#FF8C00] focus:bg-white/10 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation.id)}
              className={`flex w-full items-center gap-3 border-b border-white/5 p-4 text-left transition hover:bg-white/5 ${
                selectedConversation === conversation.id ? 'bg-white/10' : ''
              }`}
            >
              <div className="relative flex-shrink-0">
                <ImageWithFallback
                  src={conversation.avatar}
                  alt={conversation.name}
                  className="h-12 w-12 rounded-full object-cover sm:h-14 sm:w-14"
                />
                {conversation.online && (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-black bg-green-500" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="truncate text-sm sm:text-base">{conversation.name}</h3>
                  <span className="ml-2 text-xs text-white/50">{conversation.timestamp}</span>
                </div>
                <p className="truncate text-xs text-white/60 sm:text-sm">{conversation.lastMessage}</p>
              </div>

              {conversation.unread > 0 && (
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#FF8C00] text-xs">
                  {conversation.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedConversationDetails && (
        <div className={`flex flex-1 flex-col ${showList ? 'hidden' : 'flex'} md:flex`}>
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 md:hidden"
                aria-label="Back to conversations"
              >
                <ArrowLeftIcon />
              </button>
              <div className="relative">
                <ImageWithFallback
                  src={selectedConversationDetails.avatar}
                  alt={selectedConversationDetails.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
                {selectedConversationDetails.online && (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-black bg-green-500" />
                )}
              </div>
              <div>
                <h2 className="text-base sm:text-lg">{selectedConversationDetails.name}</h2>
                <p className="text-xs text-white/60">Active now</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10">
                <ImageIcon className="h-4 w-4" />
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-black p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    message.sender === 'me'
                      ? 'rounded-br-sm bg-[#FF8C00] text-white'
                      : 'rounded-bl-sm border border-white/10 bg-white/5 text-white'
                  }`}
                >
                  <p>{message.text}</p>
                  <span className="mt-1 block text-[10px] text-white/60">{message.timestamp}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 bg-black/80 p-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10">
                <Smile className="h-5 w-5" />
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-4 pr-12 text-sm text-white placeholder:text-white/50 focus:border-[#FF8C00] focus:bg-white/10 focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[#FF8C00] p-2 text-white hover:bg-[#FF9D1A]"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10">
                <ImageIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!showList && !selectedConversationDetails && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-white/60">
          <p>Select a conversation to start messaging.</p>
          <button
            onClick={() => navigate(-1)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            Go Back
          </button>
        </div>
      )}
    </div>
  );
}

function ArrowLeftIcon() {
  return <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M15.75 19.5 8.25 12l7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
