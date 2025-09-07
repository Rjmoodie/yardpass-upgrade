import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PaymentSuccessHelper() {
  const [sessionId, setSessionId] = useState('');
  const navigate = useNavigate();

  const handleViewSuccess = () => {
    if (sessionId.trim()) {
      navigate(`/ticket-success?session_id=${sessionId.trim()}`);
    }
  };

  // Your recent session ID from the purchase
  const recentSessionId = 'cs_test_a14HJYKS6KetC8L22aBAGA8k0UI9rCMnvM2U3XMACyTYb2UoUVhM01JrzP';

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          Payment Success Helper
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 mb-2">
            It looks like you completed a payment but weren't redirected properly. 
            Click below to view your ticket confirmation:
          </p>
          <Button 
            onClick={() => navigate(`/ticket-success?session_id=${recentSessionId}`)}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Your Recent Purchase
          </Button>
        </div>

        <div className="pt-4 border-t">
          <Label htmlFor="sessionId">Or enter a Stripe session ID:</Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="sessionId"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="cs_test_..."
              className="flex-1"
            />
            <Button 
              onClick={handleViewSuccess}
              disabled={!sessionId.trim()}
              variant="outline"
            >
              Go
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}