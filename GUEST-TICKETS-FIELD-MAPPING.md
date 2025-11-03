# 🎫 Guest Tickets Field Mapping Reference

## ✅ **Fixed: Field Name Mismatch**

The `tickets-list-guest` Edge Function returns different field names than what the frontend initially expected.

---

## 📊 **Edge Function Returns (`tickets_enhanced` view):**

```typescript
{
  // Ticket fields
  id: string,
  event_id: string,
  tier_id: string,
  order_id: string,
  status: 'issued' | 'transferred' | 'redeemed',
  qr_code: string,
  wallet_pass_url: string,
  created_at: string,
  redeemed_at: string | null,
  owner_email: string,
  owner_name: string,
  owner_phone: string,
  
  // Event fields (flat structure)
  event_title: string,
  event_date: string,          // ← Date only (YYYY-MM-DD)
  event_time: string,           // ← Time only (HH:MM:SS)
  event_location: string,
  organizer_name: string,
  cover_image: string,
  
  // Tier fields (flat structure)
  ticket_type: string,          // ← e.g., "General Admission", "VIP"
  badge: string | null,
  price: string,                // ← Already formatted as "$XX.XX" or "Free"
  
  // Order fields (flat structure)
  order_date: string
}
```

---

## 🔧 **Frontend Mapping (TicketsPage.tsx):**

### **Before (❌ Broken):**
```typescript
const mappedTickets = data.tickets.map(ticket => ({
  date: new Date(ticket.event_start_at).toLocaleDateString(),  // ❌ Wrong field
  ticketType: ticket.tier_name,                                // ❌ Wrong field
  price: `$${(ticket.tier_price_cents / 100).toFixed(2)}`,    // ❌ Wrong field
  image: ticket.event_cover_image_url,                         // ❌ Wrong field
  organizer: ticket.event_organizer_name,                      // ❌ Wrong field
}));
```

### **After (✅ Fixed):**
```typescript
const mappedTickets = data.tickets.map(ticket => {
  // Combine event_date and event_time
  let eventDate: Date;
  let dateString = 'Date TBA';
  
  if (ticket.event_date) {
    const dateTimeString = ticket.event_time 
      ? `${ticket.event_date}T${ticket.event_time}`
      : ticket.event_date;
    eventDate = new Date(dateTimeString);
    
    if (!isNaN(eventDate.getTime())) {
      dateString = eventDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
  }

  const isPast = eventDate && eventDate < new Date();

  return {
    id: ticket.id,
    status: isPast || ticket.status === 'redeemed' ? 'used' : 'active',
    title: ticket.event_title,              // ✅ Correct
    date: dateString,                        // ✅ Combined date + time
    location: ticket.event_location,         // ✅ Correct
    ticketType: ticket.ticket_type || ticket.badge,  // ✅ Correct
    price: ticket.price,                     // ✅ Already formatted
    image: ticket.cover_image,               // ✅ Correct
    qrCode: ticket.qr_code,                  // ✅ Correct
    organizer: ticket.organizer_name,        // ✅ Correct
  };
});
```

---

## 🎨 **Visual Consistency Checklist:**

### **✅ Fixed:**
- [x] Date format matches member tickets (e.g., "Nov 2, 2025")
- [x] Ticket type displayed correctly ("General Admission", "VIP")
- [x] Price formatting matches ("$10.00", "Free")
- [x] Organizer name shows correctly
- [x] Event location displays properly
- [x] QR code available for scanning
- [x] Status badge ("ACTIVE", "USED") works correctly

### **Matches Member Experience:**
- [x] Same card layout
- [x] Same date formatting
- [x] Same ticket type labels
- [x] Same price display
- [x] Same action buttons (Download, Share)
- [x] Same status indicators
- [x] Same tabs (Upcoming/Past)

---

## 🐛 **Common Issues & Solutions:**

### **Issue: "Invalid Date"**
**Cause**: Using `ticket.event_start_at` (doesn't exist)  
**Solution**: Use `ticket.event_date` and `ticket.event_time`

### **Issue: Ticket type shows "undefined"**
**Cause**: Using `ticket.tier_name` (doesn't exist)  
**Solution**: Use `ticket.ticket_type` or `ticket.badge`

### **Issue: Price shows "$NaN"**
**Cause**: Trying to divide `ticket.tier_price_cents` (doesn't exist)  
**Solution**: Use `ticket.price` (already formatted)

### **Issue: Organizer shows "Organizer"**
**Cause**: Using `ticket.event_organizer_name` (doesn't exist)  
**Solution**: Use `ticket.organizer_name`

### **Issue: Image not loading**
**Cause**: Using `ticket.event_cover_image_url` (doesn't exist)  
**Solution**: Use `ticket.cover_image`

---

## 📝 **Quick Reference Table:**

| Field Needed | ❌ Wrong Name | ✅ Correct Name |
|-------------|--------------|----------------|
| Event date | `event_start_at` | `event_date` + `event_time` |
| Ticket type | `tier_name` | `ticket_type` or `badge` |
| Price | `tier_price_cents` | `price` (pre-formatted) |
| Image | `event_cover_image_url` | `cover_image` |
| Organizer | `event_organizer_name` | `organizer_name` |
| Location | `event_venue` | `event_location` |
| Status | `status === 'used'` | `status === 'redeemed'` |

---

## 🧪 **Testing:**

After the fix, guest tickets should display:
- ✅ Proper date (e.g., "Jan 31, 2025" not "Invalid Date")
- ✅ Proper ticket type (e.g., "General Admission" not "undefined")
- ✅ Proper price (e.g., "$50.00" or "Free")
- ✅ Proper organizer name
- ✅ Event image loads
- ✅ QR code available
- ✅ Status badge shows correctly

---

## 🚀 **Deploy:**

After editing `TicketsPage.tsx`:
1. Refresh browser to see updated mapping
2. Check console for: `[TicketsPage] Guest tickets response:`
3. Verify all fields display correctly
4. Compare visually with authenticated member tickets

---

**All fields now match between guest and member tickets!** ✨

