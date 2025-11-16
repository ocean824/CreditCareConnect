import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AdminNav from "@/components/AdminNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminCases() {
  const { data: cases, isLoading } = useQuery({
    queryKey: ['/api/admin/cases'],
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
        <h1 className="text-3xl font-bold mb-8" data-testid="heading-admin-cases">
          Case Management
        </h1>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {(cases as any[])?.map((caseItem: any) => (
                <div
                  key={caseItem.caseId}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                  data-testid={`case-row-${caseItem.caseId}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium" data-testid={`case-id-${caseItem.caseId}`}>
                        Case: {caseItem.caseId}
                      </p>
                      <Badge variant={caseItem.status === 'delivered' ? 'default' : 'secondary'}>
                        {caseItem.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Client: {caseItem.clientName || caseItem.clientEmail}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Bureau: {caseItem.bureau} | Round: {caseItem.round}
                    </p>
                  </div>
                  
                  <Link href={`/admin/case/${caseItem.caseId}`}>
                    <Button variant="outline" size="sm" data-testid={`view-case-${caseItem.caseId}`}>
                      View Timeline
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
