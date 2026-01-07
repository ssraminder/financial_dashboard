import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Loader2,
  Edit,
  History,
  TestTube,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface AIPrompt {
  id: string;
  prompt_key: string;
  name: string;
  description: string;
  prompt_text: string;
  is_active: boolean;
  version: number;
  updated_at: string;
}

interface PromptHistory {
  id: string;
  prompt_id: string;
  prompt_key: string;
  prompt_text: string;
  version: number;
  changed_at: string;
}

export default function AIPromptsManagement() {
  const { user, profile, loading: authLoading } = useAuth();
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<PromptHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPrompts();
    }
  }, [user]);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_prompts")
        .select("*")
        .order("name");

      if (error) throw error;
      setPrompts(data || []);
    } catch (error: any) {
      console.error("Error fetching prompts:", error);
      toast.error("Failed to load prompts: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (prompt: AIPrompt) => {
    setEditingPrompt(prompt);
    setEditText(prompt.prompt_text);
    setShowHistory(false);
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!editingPrompt) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("ai_prompts")
        .update({
          prompt_text: editText,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingPrompt.id);

      if (error) throw error;

      toast.success("Prompt updated successfully");
      setEditingPrompt(null);
      fetchPrompts();
    } catch (error: any) {
      console.error("Error saving prompt:", error);
      toast.error("Failed to save: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (prompt: AIPrompt) => {
    try {
      const { error } = await supabase
        .from("ai_prompts")
        .update({ is_active: !prompt.is_active })
        .eq("id", prompt.id);

      if (error) throw error;

      toast.success(
        `Prompt ${!prompt.is_active ? "activated" : "deactivated"}`,
      );
      fetchPrompts();
    } catch (error: any) {
      console.error("Error toggling prompt:", error);
      toast.error("Failed to update: " + error.message);
    }
  };

  const fetchHistory = async (promptId: string) => {
    try {
      const { data, error } = await supabase
        .from("ai_prompts_history")
        .select("*")
        .eq("prompt_id", promptId)
        .order("version", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
      setShowHistory(true);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load history");
    }
  };

  const restoreVersion = (historyItem: PromptHistory) => {
    setEditText(historyItem.prompt_text);
    setShowHistory(false);
    toast.success(`Restored version ${historyItem.version}`);
  };

  const testPrompt = async () => {
    setTesting(true);
    setTestResult("Testing AI chat...");

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { message: "How many bank accounts do I have?" },
      });

      if (error) throw error;

      setTestResult(
        `✓ Success! Response: ${data.message?.substring(0, 200)}${data.message?.length > 200 ? "..." : ""}`,
      );
      toast.success("Test completed successfully");
    } catch (error: any) {
      console.error("Test error:", error);
      setTestResult(`✗ Error: ${error.message}`);
      toast.error("Test failed: " + error.message);
    } finally {
      setTesting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Only admins can access
  if (profile?.role !== "admin") {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h1>
            <p className="text-gray-600">
              You need admin privileges to access this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                AI Prompts Management
              </h1>
              <p className="text-gray-500 mt-1">
                Edit prompts without redeploying the function
              </p>
            </div>
            <button
              onClick={testPrompt}
              disabled={testing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4" />
              )}
              Test AI Chat
            </button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                testResult.includes("Error")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-green-50 text-green-700 border border-green-200"
              }`}
            >
              {testResult}
            </div>
          )}

          {/* Prompts Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Version
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                      <p className="text-gray-500 mt-2">Loading prompts...</p>
                    </td>
                  </tr>
                ) : prompts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No prompts found. Run the SQL migration first.
                    </td>
                  </tr>
                ) : (
                  prompts.map((prompt) => (
                    <tr key={prompt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {prompt.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {prompt.description}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                          {prompt.prompt_key}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(prompt)}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            prompt.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {prompt.is_active ? "✓ Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        v{prompt.version}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(prompt.updated_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(prompt)}
                            className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              handleEdit(prompt);
                              fetchHistory(prompt.id);
                            }}
                            className="px-3 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 flex items-center gap-1"
                          >
                            <History className="w-3 h-3" />
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{editingPrompt.name}</h2>
                <p className="text-sm text-gray-500">
                  {editingPrompt.prompt_key} • v{editingPrompt.version}
                </p>
              </div>
              <button
                onClick={() => setEditingPrompt(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex">
              {/* Editor */}
              <div className={`flex-1 p-4 ${showHistory ? "border-r" : ""}`}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt Text
                </label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full h-[400px] p-4 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter prompt text..."
                />
                <div className="mt-2 text-sm text-gray-500">
                  {editText.length} characters • {editText.split("\n").length}{" "}
                  lines
                </div>
              </div>

              {/* History Panel */}
              {showHistory && (
                <div className="w-80 p-4 bg-gray-50 overflow-y-auto">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Version History
                  </h3>
                  {history.length === 0 ? (
                    <p className="text-sm text-gray-500">No history yet</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map((h) => (
                        <div
                          key={h.id}
                          className="p-3 bg-white rounded border hover:border-blue-300 cursor-pointer transition"
                          onClick={() => restoreVersion(h)}
                        >
                          <div className="font-medium text-sm">
                            Version {h.version}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(h.changed_at)}
                          </div>
                          <div className="text-xs text-gray-400 mt-1 truncate">
                            {h.prompt_text.substring(0, 100)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2"
              >
                {showHistory ? (
                  <>
                    <ChevronRight className="w-4 h-4" />
                    Hide History
                  </>
                ) : (
                  <>
                    <ChevronLeft className="w-4 h-4" />
                    Show History
                  </>
                )}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingPrompt(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || editText === editingPrompt.prompt_text}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
