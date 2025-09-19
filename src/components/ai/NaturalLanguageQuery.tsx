import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Send,
  BarChart3,
  LineChart,
  PieChart,
  Table,
  Copy,
  Download,
  RefreshCw
} from 'lucide-react';

interface QueryResult {
  sql: string;
  explanation: string;
  chart_type: 'bar' | 'line' | 'pie' | 'table';
  x_axis?: string;
  y_axis?: string;
  data: any[];
  row_count: number;
  error?: string;
}

interface NaturalLanguageQueryProps {
  orgId: string;
}

export const NaturalLanguageQuery: React.FC<NaturalLanguageQueryProps> = ({ orgId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QueryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestedQueries = [
    "Which events had the highest ticket sales this month?",
    "Show me the conversion rate from views to ticket purchases",
    "What's the average revenue per attendee for VIP tickets?",
    "Compare engagement between indoor vs outdoor events",
    "Which day of the week performs best for event ticket sales?",
    "Show attendance trends over the last 90 days"
  ];

  const executeQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analytics-nl-query', {
        body: {
          query: queryText,
          org_id: orgId
        }
      });

      if (error) throw error;

      setResults(prev => [data, ...prev]);
      setQuery('');
      toast({ title: "Query executed successfully" });
    } catch (error) {
      console.error('Error executing query:', error);
      toast({ 
        title: "Query failed", 
        description: "Please try rephrasing your question",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const getChartIcon = (chartType: string) => {
    switch (chartType) {
      case 'bar': return <BarChart3 className="h-4 w-4" />;
      case 'line': return <LineChart className="h-4 w-4" />;
      case 'pie': return <PieChart className="h-4 w-4" />;
      case 'table': return <Table className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const copySQL = (sql: string) => {
    navigator.clipboard.writeText(sql);
    toast({ title: "SQL copied to clipboard" });
  };

  const downloadData = (data: any[], filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeQuery(query);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle>Ask Questions About Your Data</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your events... e.g., 'Which events had the highest attendance?'"
              className="flex-1"
            />
            <Button 
              onClick={() => executeQuery(query)}
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQueries.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuery(suggestion)}
                  className="text-xs"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {results.map((result, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getChartIcon(result.chart_type)}
                <CardTitle className="text-lg">Query Result</CardTitle>
                <Badge variant="outline">{result.chart_type}</Badge>
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copySQL(result.sql)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy SQL
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadData(result.data, `query_result_${index + 1}.json`)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Explanation:</p>
              <p className="text-sm text-muted-foreground">{result.explanation}</p>
            </div>

            {result.error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-700">Error: {result.error}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Results:</p>
                <Badge variant="secondary">{result.row_count} rows</Badge>
              </div>
              
              {result.data && result.data.length > 0 ? (
                <div className="border rounded-md overflow-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {Object.keys(result.data[0]).map(key => (
                          <th key={key} className="text-left p-2 font-medium">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.slice(0, 10).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t">
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex} className="p-2">
                              {typeof value === 'number' 
                                ? value.toLocaleString() 
                                : String(value)
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.data.length > 10 && (
                    <div className="p-2 text-center text-sm text-muted-foreground bg-muted">
                      Showing first 10 rows of {result.data.length}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Table className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No data returned from query</p>
                </div>
              )}
            </div>

            <details className="border rounded-md">
              <summary className="p-3 bg-muted cursor-pointer text-sm font-medium">
                View SQL Query
              </summary>
              <pre className="p-3 text-xs bg-slate-50 overflow-auto">
                <code>{result.sql}</code>
              </pre>
            </details>
          </CardContent>
        </Card>
      ))}

      {results.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Ready to Answer Your Questions</h3>
            <p className="text-muted-foreground">
              Ask natural language questions about your events and get instant analytics insights.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};