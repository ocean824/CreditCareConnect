import { useQuery } from "@tanstack/react-query";
import AdminNav from "@/components/AdminNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export default function AdminResponses() {
  const { data: responses, isLoading } = useQuery({
    queryKey: ['/api/admin/responses'],
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
        <h1 className="text-3xl font-bold mb-8" data-testid="heading-admin-responses">
          Client Responses
        </h1>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {responses?.map((response: any) => (
                <div
                  key={response.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                  data-testid={`response-row-${response.id}`}
                >
                  <div className="flex-1">
                    <p className="font-medium">Case: {response.caseId}</p>
                    <p className="text-sm text-muted-foreground">
                      Client: {response.clientName || response.clientEmail}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Round: {response.round}
                    </p>
                    {response.ocrText && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        OCR: {response.ocrText.substring(0, 100)}...
                      </p>
                    )}
                    {response.analysisJson && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ AI Analysis Complete
                      </p>
                    )}
                  </div>
                  
                  <a href={response.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" data-testid={`view-response-${response.id}`}>
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View File
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
