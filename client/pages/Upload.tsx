import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload as UploadIcon, Loader2 } from 'lucide-react';

export default function Upload() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Upload</h1>
            <p className="text-muted-foreground mt-1">
              Upload bank statements and transaction data
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <UploadIcon className="h-6 w-6 text-primary" />
                <CardTitle>Coming Soon</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <p className="mb-4">
                The Upload page will allow you to upload PDF bank statements and other financial
                documents with the following features:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Drag-and-drop file upload interface</li>
                <li>Support for PDF file format</li>
                <li>Bank account selector dropdown</li>
                <li>Automatic transaction extraction and parsing</li>
                <li>Upload progress tracking</li>
                <li>Upload history and status</li>
              </ul>
              <p className="mt-6 text-sm">
                Continue prompting to have this page fully implemented.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
