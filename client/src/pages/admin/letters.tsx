import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminNav from "@/components/AdminNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, RefreshCw, ExternalLink } from "lucide-react";

export default function AdminLetters() {
  const { toast } = useToast();
  
  const { data: letters, isLoading } = useQuery({
    queryKey: ['/api/admin/letters'],
  });

  const sendDay34Mutation = useMutation({
    mutationFn: async (letterId: string) => {
      return await apiRequest(`/api/admin/letters/${letterId}/remind-day34`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Day-34 reminder sent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send Day-34 reminder",
        variant: "destructive",
      });
    },
  });

  const remailMutation = useMutation({
    mutationFn: async (letterId: string) => {
      return await apiRequest(`/api/admin/letters/${letterId}/remail`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/letters'] });
      toast({
        title: "Success",
        description: "Letter remailed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remail letter",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8" data-testid="heading-admin-letters">
          Letter Tracking
        </h1>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {letters?.map((letter: any) => (
                <div
                  key={letter.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                  data-testid={`letter-row-${letter.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium">Case: {letter.caseId}</p>
                      <Badge variant={letter.status === 'delivered' ? 'default' : 'secondary'}>
                        {letter.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Client: {letter.clientName || letter.clientEmail}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Bureau: {letter.bureau} | Round: {letter.round}
                    </p>
                    {letter.uspsTracking && (
                      <p className="text-xs text-muted-foreground">
                        Tracking: {letter.uspsTracking}
                      </p>
                    )}
                    {letter.latestEvent && (
                      <p className="text-xs text-muted-foreground">
                        Latest: {letter.latestEvent.kind}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {letter.proofUrl && (
                      <a href={letter.proofUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Proof
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendDay34Mutation.mutate(letter.id)}
                      disabled={sendDay34Mutation.isPending}
                      data-testid={`send-day34-${letter.id}`}
                    >
                      <Mail className="w-4 h-4 mr-1" />
                      Day-34
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => remailMutation.mutate(letter.id)}
                      disabled={remailMutation.isPending}
                      data-testid={`remail-${letter.id}`}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Re-mail
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
