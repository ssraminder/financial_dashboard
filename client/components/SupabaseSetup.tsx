import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Database, Key, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SupabaseSetup() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-gray-100 p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle className="text-2xl">Supabase Setup Required</CardTitle>
          </div>
          <p className="text-muted-foreground">
            The Cethos Financial Dashboard requires Supabase for authentication and
            database functionality.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <Database className="h-5 w-5" />
              Quick Setup Steps
            </h3>
            <ol className="space-y-3 text-sm text-blue-900">
              <li className="flex gap-3">
                <span className="font-bold min-w-[24px]">1.</span>
                <div>
                  <strong>Connect to Supabase:</strong> Click the button below to
                  connect Supabase MCP integration.
                  <div className="mt-2">
                    <Button asChild variant="outline" size="sm">
                      <a href="#open-mcp-popover">Connect to Supabase</a>
                    </Button>
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-bold min-w-[24px]">2.</span>
                <div>
                  <strong>Set Environment Variables:</strong> Add these to your
                  project settings:
                  <ul className="mt-2 space-y-1 font-mono text-xs bg-white p-2 rounded border border-blue-200">
                    <li className="flex items-center gap-2">
                      <Key className="h-3 w-3" />
                      VITE_SUPABASE_URL
                    </li>
                    <li className="flex items-center gap-2">
                      <Key className="h-3 w-3" />
                      VITE_SUPABASE_ANON_KEY
                    </li>
                  </ul>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-bold min-w-[24px]">3.</span>
                <div>
                  <strong>Run Database Schema:</strong> Execute the SQL in{" "}
                  <code className="bg-white px-1 py-0.5 rounded border border-blue-200">
                    supabase-schema.sql
                  </code>{" "}
                  in your Supabase SQL Editor to create all required tables.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-bold min-w-[24px]">4.</span>
                <div>
                  <strong>Create Your First User:</strong> In Supabase Dashboard →
                  Authentication → Users, create a user with email/password.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-bold min-w-[24px]">5.</span>
                <div>
                  <strong>Refresh the Page:</strong> Once configured, refresh to
                  start using the dashboard.
                </div>
              </li>
            </ol>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Need Help?
            </h3>
            <p className="text-sm text-gray-700">
              Check the{" "}
              <code className="bg-white px-1 py-0.5 rounded border border-gray-200">
                AGENTS.md
              </code>{" "}
              file for detailed setup instructions and more information about the
              database schema.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
