# Test posts-create Edge Function Deployment

## Quick Test in Browser Console

1. Open your app: http://localhost:8080
2. Open DevTools (F12) → Console
3. Paste this code:

```javascript
// Test posts-create Edge Function
const testPost = await fetch('https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/posts-create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    event_id: '28309929-28e7-4bda-af28-6e0b47485ce1',  // Liventix Official Event
    text: 'Deployment test - feed optimization',
    media_urls: []
  })
});

const result = await testPost.json();
console.log('Edge Function Response:', result);

// Check response structure
console.log('Has success?', result.success);
console.log('Has post?', result.post);
console.log('Post type?', result.post?.item_type);
console.log('Has author?', result.post?.author);
console.log('Has metrics?', result.post?.metrics);
```

## Expected Output:

```json
{
  "success": true,
  "post": {
    "item_type": "post",
    "item_id": "uuid...",
    "author": {
      "id": "...",
      "display_name": "Your Name"
    },
    "content": {
      "text": "Deployment test - feed optimization",
      "media": []
    },
    "metrics": {
      "likes": 0,
      "comments": 0,
      "shares": 0,
      "views": 0,
      "viewer_has_liked": false
    },
    "event": {
      "id": "...",
      "title": "Liventix Official Event!"
    }
  },
  "event_title": "Liventix Official Event!"
}
```

## ✅ Success Criteria:

- [ ] Response has `success: true`
- [ ] Response has `post` object
- [ ] `post.item_type === 'post'`
- [ ] `post.author` object exists
- [ ] `post.content` object exists
- [ ] `post.metrics` object exists
- [ ] No errors in console

## If Test Passes:

✅ Edge Function working correctly!  
✅ Ready to test in app UI

## If Test Fails:

❌ Check Edge Function logs in Supabase Dashboard  
❌ Verify function code was deployed correctly  
❌ Check for syntax errors

