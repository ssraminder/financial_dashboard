import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";

interface KBNaturalLanguageInputProps {
  onInterpret: (input: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export function KBNaturalLanguageInput({
  onInterpret,
  isLoading = false,
  error = null,
}: KBNaturalLanguageInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleInterpret = async () => {
    if (inputValue.trim()) {
      await onInterpret(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleInterpret();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Natural Language Rule Creator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Describe a knowledge base rule
          </label>
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Example: 'Amazon transactions should have GST enabled at 5% and be categorized as office supplies. Link to the Amazon vendor.'"
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Tip: Press Ctrl+Enter to interpret
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleInterpret}
          disabled={isLoading || !inputValue.trim()}
          className="w-full gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Interpret Rule
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
