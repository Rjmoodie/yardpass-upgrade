// Proposal Negotiation System - Real-time proposal management
// Handles proposal creation, messaging, and negotiation workflows

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageSquare, 
  Send, 
  Paperclip, 
  DollarSign, 
  Calendar, 
  Users, 
  CheckCircle, 
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Image,
  Video,
  Download,
  Plus,
  Minus,
  Edit,
  Trash2
} from 'lucide-react';
import { sponsorshipClient, formatCurrency, formatDate } from '@/integrations/supabase/sponsorship-client';
import type { 
  ProposalThread, 
  ProposalMessage,
  CreateProposalRequest,
  ProposalNegotiationProps 
} from '@/types/sponsorship-complete';

export const ProposalNegotiation: React.FC<ProposalNegotiationProps> = ({
  threadId,
  onMessageSend,
  onAccept,
  onReject
}) => {
  const [thread, setThread] = useState<ProposalThread | null>(null);
  const [messages, setMessages] = useState<ProposalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newOffer, setNewOffer] = useState({
    amount_cents: 0,
    deliverables: [] as string[],
    timeline: '',
    terms: ''
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Don't auto-load if feature not deployed
    // if (threadId) {
    //   loadThread();
    // }
    setLoading(false);
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadThread = async () => {
    try {
      setLoading(true);
      const response = await sponsorshipClient.getProposalThreads(undefined, undefined);
      
      if (response.success && response.data) {
        const threadData = response.data.find(t => t.id === threadId);
        if (threadData) {
          setThread(threadData);
          setMessages(threadData.proposal_messages || []);
        }
      } else {
        setError(response.error || 'Failed to load proposal thread');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error loading thread:', err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !newOffer.amount_cents) return;

    try {
      setSending(true);
    
      const messageData = {
        body: newMessage.trim() || undefined,
      offer: newOffer.amount_cents ? newOffer : undefined,
      attachments: attachments.length > 0 ? attachments.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size
      })) : undefined
    };

    onMessageSend?.(newMessage, newOffer);
    
    // Add message to local state immediately for optimistic UI
    const tempMessage: ProposalMessage = {
      id: `temp-${Date.now()}`,
      thread_id: threadId!,
      sender_type: 'organizer', // This would be determined by current user
      sender_user_id: 'current-user-id',
      body: newMessage.trim() || null,
      offer: newOffer,
      attachments: messageData.attachments,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    setNewOffer({ amount_cents: 0, deliverables: [], timeline: '', terms: '' });
    setAttachments([]);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
    } finally {
      setSending(false);
    }
  };

  const handleAccept = () => {
    onAccept?.();
  };

  const handleReject = () => {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason) {
      onReject?.(reason);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.startsWith('video/')) return <Video className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const MessageBubble: React.FC<{ message: ProposalMessage }> = ({ message }) => {
    const isOrganizer = message.sender_type === 'organizer';
    const hasOffer = message.offer && Object.keys(message.offer).length > 0;

    return (
      <div className={`flex ${isOrganizer ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex max-w-[80%] ${isOrganizer ? 'flex-row-reverse' : 'flex-row'}`}>
          <Avatar className="h-8 w-8 mx-2">
            <AvatarFallback>
              {message.sender_type === 'organizer' ? 'O' : 'S'}
            </AvatarFallback>
          </Avatar>
          
          <div className={`space-y-2 ${isOrganizer ? 'text-right' : 'text-left'}`}>
            <div className={`rounded-lg p-3 ${
              isOrganizer 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted'
            }`}>
              {message.body && (
                <p className="text-sm whitespace-pre-wrap">{message.body}</p>
              )}
              
              {hasOffer && (
                <div className="mt-3 p-3 bg-background/20 rounded border">
                  <div className="flex items-center space-x-2 mb-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">Proposal Details</span>
                  </div>
                  
                  {message.offer.amount_cents && (
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(message.offer.amount_cents)}
                    </div>
                  )}
                  
                  {message.offer.deliverables && message.offer.deliverables.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium mb-1">Deliverables:</p>
                      <ul className="text-xs space-y-1">
                        {message.offer.deliverables.map((deliverable, index) => (
                          <li key={index} className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>{deliverable}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {message.offer.timeline && (
                    <div className="mt-2 flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span className="text-xs">{message.offer.timeline}</span>
                    </div>
                  )}
                  
                  {message.offer.terms && (
                    <div className="mt-2">
                      <p className="text-xs font-medium mb-1">Terms:</p>
                      <p className="text-xs">{message.offer.terms}</p>
                    </div>
                  )}
                </div>
              )}
              
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.attachments.map((attachment, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 bg-background/20 rounded">
                      {getFileIcon(attachment.type as string)}
                      <span className="text-xs">{attachment.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({formatFileSize(attachment.size as number)})
                      </span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground">
              {formatDate(message.created_at)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const OfferBuilder: React.FC = () => {
    const [showOfferBuilder, setShowOfferBuilder] = useState(false);

    if (!showOfferBuilder) {
      return (
        <Button 
          variant="outline" 
          onClick={() => setShowOfferBuilder(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Proposal Details
        </Button>
      );
    }

    return (
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Proposal Details</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowOfferBuilder(false)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Proposed Amount</label>
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="0"
                value={newOffer.amount_cents ? newOffer.amount_cents / 100 : ''}
                onChange={(e) => setNewOffer(prev => ({
                  ...prev,
                  amount_cents: e.target.value ? parseInt(e.target.value) * 100 : 0
                }))}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Timeline</label>
            <Input
              placeholder="e.g., 3 months, Q2 2024"
              value={newOffer.timeline}
              onChange={(e) => setNewOffer(prev => ({ ...prev, timeline: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Terms & Conditions</label>
            <Textarea
              placeholder="Additional terms, requirements, or conditions..."
              value={newOffer.terms}
              onChange={(e) => setNewOffer(prev => ({ ...prev, terms: e.target.value }))}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-red-600 mb-2">Error loading proposal</div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadThread}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!thread) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground mb-4">Proposal thread not found</div>
          <p className="text-sm text-muted-foreground">
            The requested proposal thread could not be loaded
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Proposal Negotiation</h2>
            <p className="text-muted-foreground">
              Status: <Badge className={getStatusColor(thread.status)}>
                {thread.status}
              </Badge>
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleReject}>
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button onClick={handleAccept}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Accept
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5" />
                <span>Conversation</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm">Start the conversation below</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message Input */}
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="space-y-4">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                
                <OfferBuilder />
                
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Attachments:</p>
                    <div className="space-y-1">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="flex items-center space-x-2">
                            {getFileIcon(file.type)}
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(file.size)})
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeAttachment(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label htmlFor="file-upload">
                      <Button variant="outline" size="sm" asChild>
                        <span>
                          <Paperclip className="h-4 w-4 mr-1" />
                          Attach
                        </span>
                      </Button>
                    </label>
                  </div>
                  
                  <Button 
                    onClick={handleSendMessage}
                    disabled={sending || (!newMessage.trim() && !newOffer.amount_cents)}
                  >
                    {sending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Generate Contract
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Meeting
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Add Team Member
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Proposal History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Created</span>
                  <span>{formatDate(thread.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Updated</span>
                  <span>{formatDate(thread.updated_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Messages</span>
                  <span>{messages.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'accepted': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    case 'sent': return 'bg-blue-100 text-blue-800';
    case 'counter': return 'bg-yellow-100 text-yellow-800';
    case 'expired': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default ProposalNegotiation;
