import { useQuery } from "@tanstack/react-query";
import AdminNav from "@/components/AdminNav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminAudit() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['/api/admin/audit'],
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
        <h1 className="text-3xl font-bold mb-8" data-testid="heading-admin-audit">
          Audit Log
        </h1>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {(logs as any[])?.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg text-sm"
                  data-testid={`audit-row-${log.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{log.action}</Badge>
                      <span className="text-muted-foreground">by</span>
                      <span className="font-medium">{log.actorEmail}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Target: {log.targetType} ({log.targetId})
                    </p>
                    {log.meta && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {JSON.stringify(log.meta)}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
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
