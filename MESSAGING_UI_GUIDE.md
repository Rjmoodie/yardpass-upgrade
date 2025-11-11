# 💬 Messaging UI Customization Guide

**Main File:** `src/components/messaging/MessagingCenter.tsx`

---

## 🎨 **Common Customizations**

### **1. Change "New Message" Button Style**
**Location:** `MessagingCenter.tsx` line ~500

```typescript
// Find this button:
<Button
  onClick={() => setShowComposer(true)}
  className="..." // Customize classes here
>
  <UserPlus /> New Message
</Button>
```

---

### **2. Add Message Search**
**Location:** `MessagingCenter.tsx` line ~96

```typescript
const loadConversations = async () => {
  // Add search filter:
  let query = supabase
    .from('direct_conversations')
    .select('...');
  
  if (searchTerm) {
    query = query.or(`subject.ilike.%${searchTerm}%`);
  }
  
  const { data } = await query;
  // ...
};
```

---

### **3. Add Typing Indicators**
**Location:** Create new hook `useTypingIndicator.ts`

```typescript
export function useTypingIndicator(conversationId: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  const channel = supabase
    .channel(`typing:${conversationId}`)
    .on('broadcast', { event: 'typing' }, (payload) => {
      setTypingUsers(prev => [...prev, payload.userId]);
      
      // Remove after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(id => id !== payload.userId));
      }, 3000);
    });
    
  const sendTyping = () => {
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id }
    });
  };
  
  return { typingUsers, sendTyping };
}
```

---

### **4. Add File Attachments**
**Location:** `MessagingCenter.tsx` line ~375 (sendMessage function)

```typescript
const sendMessage = async () => {
  // Upload file first
  const fileUrls = [];
  if (selectedFiles.length > 0) {
    for (const file of selectedFiles) {
      const { data } = await supabase.storage
        .from('message-attachments')
        .upload(`${conversationId}/${uuidv4()}`, file);
      
      fileUrls.push(data.path);
    }
  }
  
  // Then send message with attachments
  await supabase
    .from('direct_messages')
    .insert({
      conversation_id: selectedId,
      body: draft,
      attachments: fileUrls,
      // ...
    });
};
```

---

### **5. Show Unread Badge on Messages Tab**
**Location:** `NavigationNewDesign.tsx` line ~32

```typescript
// Use the unread count hook
import { useUnreadCount } from '@/hooks/useUnreadCount';

const { totalUnread } = useUnreadCount();

// In nav items:
{ 
  id: 'messages', 
  icon: MessageCircle, 
  label: 'Messages', 
  path: '/messages',
  badge: totalUnread > 0 ? totalUnread : undefined  // ✅ Add this
}
```

Then create `useUnreadCount.ts`:
```typescript
export function useUnreadCount() {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  
  useEffect(() => {
    if (!user) return;
    
    const { data } = await supabase
      .rpc('messaging.get_unread_count', { target_user_id: user.id });
    
    setTotalUnread(data?.reduce((sum, row) => sum + row.unread_count, 0) || 0);
  }, [user]);
  
  return { totalUnread };
}
```

---

### **6. Add Message Reactions (Emoji)**
**Location:** `MessagingCenter.tsx` - Add to message rendering

```typescript
// In message rendering section:
<div className="message-container">
  <p>{message.body}</p>
  
  {/* Add reactions */}
  <div className="reactions">
    {message.reactions?.map(r => (
      <span key={r.emoji}>{r.emoji} {r.count}</span>
    ))}
    <button onClick={() => addReaction(message.id, '👍')}>
      👍
    </button>
  </div>
</div>
```

Then create `message_reactions` table and add to schema.

---

### **7. Customize Conversation List Item**
**Location:** `MessagingCenter.tsx` line ~550

```typescript
// Find conversation list rendering:
{conversations.map(conv => (
  <div key={conv.id} className="...">
    {/* Customize avatar */}
    <Avatar>
      <AvatarImage src={conv.participants[0]?.avatarUrl} />
      <AvatarFallback>{conv.participants[0]?.displayName[0]}</AvatarFallback>
    </Avatar>
    
    {/* Add online status */}
    {isUserOnline(conv.participants[0].userId) && (
      <div className="online-indicator" />
    )}
    
    {/* Customize last message preview */}
    <p className="last-message">
      {conv.lastMessage || 'No messages yet'}
    </p>
  </div>
))}
```

---

### **8. Add Message Pagination**
**Location:** `MessagingCenter.tsx` line ~251 (loadMessages)

```typescript
const loadMessages = async (conversationId: string, offset = 0) => {
  const MESSAGES_PER_PAGE = 50;
  
  const { data } = await supabase
    .from('direct_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + MESSAGES_PER_PAGE - 1);  // ✅ Pagination
  
  setMessages(prev => [...data.reverse(), ...prev]);  // Prepend older messages
};

// Add "Load More" button at top of message list
```

---

## 🎨 **UI Styling**

### **Main Sections:**

**Conversation List (Left Panel):**
- Lines ~500-650
- Search bar, conversation items, new message button

**Message Thread (Right Panel):**
- Lines ~650-800
- Header, messages, input box

**Message Input:**
- Lines ~750-820
- Textarea, send button, emoji picker placeholder

---

## 📱 **Responsive Behavior**

**Mobile (<640px):**
- Shows conversation list OR message thread (not both)
- Back button to return to list

**Desktop (≥640px):**
- Split view (list + thread side-by-side)

**Controlled by:**
```typescript
className={`${selectedConversation ? 'hidden sm:flex' : 'flex'} ...`}
```

---

## 🔧 **Key Functions**

| Function | Location | Purpose |
|----------|----------|---------|
| `loadConversations()` | Line 96 | Fetch conversation list |
| `loadMessages()` | Line 251 | Fetch messages for conversation |
| `sendMessage()` | Line 375 | Send new message |
| `acceptRequest()` | Line 418 | Accept conversation request |
| `declineRequest()` | Line 432 | Decline conversation request |

---

## 🎯 **Quick Reference**

**To customize messaging UI:**
→ Edit `src/components/messaging/MessagingCenter.tsx`

**To add new messaging features:**
→ Create hooks in `src/hooks/`
→ Import and use in `MessagingCenter.tsx`

**To change routing:**
→ Edit `src/App.tsx` line 428

**To modify navigation tab:**
→ Edit `src/components/NavigationNewDesign.tsx` line 32

---

**Need help customizing any specific part?** 🎨


