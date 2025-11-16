import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, File, Loader2 } from "lucide-react";

export default function CreditReportUploader() {
  const [selectedBureau, setSelectedBureau] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, bureau }: { file: File; bureau: string }) => {
      // Step 1: Upload the file to the server
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.message || 'File upload failed');
      }
      
      const { fileUrl, fileName } = await uploadResponse.json();
      
      // Step 2: Create credit report analysis with the uploaded file
      return apiRequest("POST", "/api/credit-reports/upload", {
        fileName,
        fileUrl,
        bureau,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Credit report uploaded and analysis started.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/credit-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/violations"] });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!selectedBureau) {
      toast({
        title: "Please Select Bureau",
        description: "Select which credit bureau this report is from.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File Too Large",
        description: "Please select a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ file, bureau: selectedBureau });
  }, [selectedBureau, uploadMutation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: false,
  });

  return (
    <div className="space-y-4" data-testid="credit-report-uploader">
      
      {/* Bureau Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Credit Bureau</label>
        <Select value={selectedBureau} onValueChange={setSelectedBureau} data-testid="select-bureau">
          <SelectTrigger>
            <SelectValue placeholder="Select credit bureau" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EQUIFAX">Equifax</SelectItem>
            <SelectItem value="TRANSUNION">TransUnion</SelectItem>
            <SelectItem value="EXPERIAN">Experian</SelectItem>
            <SelectItem value="TRI-MERGE">TRI-Merge</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* File Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? "border-primary/50 bg-primary/5" 
            : "border-border hover:border-primary/50"
        }`}
        data-testid="dropzone-area"
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
            {uploadMutation.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          
          <div>
            <p className="text-sm font-medium mb-2">
              {isDragActive ? "Drop your credit report here" : "Upload Your Credit Report"}
            </p>
            <p className="text-xs text-muted-foreground">
              Drag & drop or click to select (PDF, up to 10MB)
            </p>
          </div>
          
          {!isDragActive && (
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              disabled={uploadMutation.isPending}
              data-testid="button-browse"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <File className="w-4 h-4 mr-2" />
                  Browse Files
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
