import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminNav from "@/components/AdminNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function AdminBulk() {
  const { toast } = useToast();
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

  const { data: eligible, isLoading } = useQuery({
    queryKey: ['/api/admin/cases/eligible-day34'],
  });

  const bulkRemindMutation = useMutation({
    mutationFn: async (batchIds: string[]) => {
      return await apiRequest('/api/admin/cases/bulk-remind-day34', {
        method: 'POST',
        body: JSON.stringify({ batchIds }),
      });
    },
    onSuccess: (data: any) => {
      setSelectedBatches([]);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cases/eligible-day34'] });
      toast({
        title: "Success",
        description: data.message || "Bulk reminders sent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send bulk reminders",
        variant: "destructive",
      });
    },
  });

  const toggleBatch = (batchId: string) => {
    setSelectedBatches(prev =>
      prev.includes(batchId)
        ? prev.filter(id => id !== batchId)
        : [...prev, batchId]
    );
  };

  const toggleAll = () => {
    if (selectedBatches.length === eligible?.length) {
      setSelectedBatches([]);
    } else {
      setSelectedBatches(eligible?.map((e: any) => e.id) || []);
    }
  };

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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold" data-testid="heading-admin-bulk">
            Bulk Day-34 Reminders
          </h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {selectedBatches.length} selected
            </span>
            <Button
              onClick={() => bulkRemindMutation.mutate(selectedBatches)}
              disabled={selectedBatches.length === 0 || bulkRemindMutation.isPending}
              data-testid="button-send-bulk"
            >
              Send {selectedBatches.length} Reminders
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <Button variant="outline" onClick={toggleAll} size="sm">
                {selectedBatches.length === eligible?.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="space-y-3">
              {eligible?.map((batch: any) => (
                <div
                  key={batch.id}
                  className="flex items-center space-x-4 p-3 border border-border rounded-lg"
                  data-testid={`bulk-batch-${batch.id}`}
                >
                  <Checkbox
                    checked={selectedBatches.includes(batch.id)}
                    onCheckedChange={() => toggleBatch(batch.id)}
                    data-testid={`checkbox-${batch.id}`}
                  />
                  
                  <div className="flex-1">
                    <p className="font-medium">Case: {batch.caseId}</p>
                    <p className="text-sm text-muted-foreground">
                      Client: {batch.clientName || batch.clientEmail}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Bureau: {batch.bureau} | Round: {batch.round} | Status: {batch.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(batch.createdAt).toLocaleDateString()}
                    </p>
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
