import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import AdminNav from "@/components/AdminNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Upload, Clock } from "lucide-react";

export default function AdminCase() {
  const [, params] = useRoute("/admin/case/:id");
  const caseId = params?.id;

  const { data: caseData, isLoading } = useQuery({
    queryKey: ['/api/admin/cases', caseId],
    enabled: !!caseId,
  });

  if (isLoading || !caseId) {
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
        <h1 className="text-3xl font-bold mb-8" data-testid="heading-case-timeline">
          Case Timeline: {caseId}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="w-5 h-5" />
                <span>Mail Batches</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {((caseData as any)?.timeline || []).map((item: any) => (
                  <div key={item.batch.id} className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge>{item.batch.bureau}</Badge>
                        <Badge variant="outline">Round {item.batch.round}</Badge>
                      </div>
                      <Badge variant={item.batch.status === 'delivered' ? 'default' : 'secondary'}>
                        {item.batch.status}
                      </Badge>
                    </div>
                    
                    {item.batch.uspsTracking && (
                      <p className="text-xs text-muted-foreground">
                        Tracking: {item.batch.uspsTracking}
                      </p>
                    )}
                    
                    {item.events.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium">Events:</p>
                        {item.events.map((event: any) => (
                          <div key={event.id} className="flex items-center space-x-2 text-xs">
                            <Clock className="w-3 h-3" />
                            <span>{event.kind}</span>
                            <span className="text-muted-foreground">
                              {new Date(event.createdAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>Client Responses</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {((caseData as any)?.responses || []).map((response: any) => (
                  <div key={response.id} className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">Round {response.round}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(response.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    {response.ocrText && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                        {response.ocrText.substring(0, 150)}...
                      </p>
                    )}
                    
                    {response.analysisJson && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ AI Analysis Complete
                      </p>
                    )}
                    
                    <a
                      href={response.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-2 inline-block"
                    >
                      View File →
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
