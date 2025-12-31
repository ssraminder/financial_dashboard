import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { FormData } from "../KBEntryEditor";

interface KBEntryEditorMatchingProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  errors: Record<string, string>;
}

export function KBEntryEditorMatching({
  formData,
  setFormData,
  errors,
}: KBEntryEditorMatchingProps) {
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<{
    matches: boolean;
    reason: string;
  } | null>(null);

  const patternTypeLabels: Record<string, string> = {
    exact: "Exact Match",
    starts_with: "Starts With",
    ends_with: "Ends With",
    contains: "Contains",
    regex: "Regex (Advanced)",
  };

  const testPattern = () => {
    if (!testInput.trim() || !formData.payee_pattern) {
      setTestResult(null);
      return;
    }

    const pattern = formData.payee_pattern.toUpperCase();
    const input = testInput.toUpperCase();
    let matches = false;
    let reason = "";

    try {
      switch (formData.pattern_type) {
        case "exact":
          matches = input === pattern;
          reason = matches ? "Exact match" : "Does not match exactly";
          break;

        case "starts_with":
          matches = input.startsWith(pattern);
          reason = matches
            ? `Starts with '${pattern}'`
            : `Does not start with '${pattern}'`;
          break;

        case "ends_with":
          matches = input.endsWith(pattern);
          reason = matches
            ? `Ends with '${pattern}'`
            : `Does not end with '${pattern}'`;
          break;

        case "contains":
          matches = input.includes(pattern);
          reason = matches
            ? `Contains '${pattern}'`
            : `Does not contain '${pattern}'`;
          break;

        case "regex":
          try {
            const regex = new RegExp(pattern, "i");
            matches = regex.test(input);
            reason = matches ? "Regex matches" : "Regex does not match";
          } catch (e) {
            matches = false;
            reason = `Invalid regex: ${e instanceof Error ? e.message : "Unknown error"}`;
          }
          break;
      }
    } catch (e) {
      matches = false;
      reason = `Error: ${e instanceof Error ? e.message : "Unknown error"}`;
    }

    setTestResult({ matches, reason });
  };

  const confidenceColor =
    formData.confidence_score >= 80
      ? "text-green-600"
      : formData.confidence_score >= 60
        ? "text-amber-600"
        : "text-red-600";

  return (
    <div className="space-y-6">
      {/* Amount Range */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Amount Range (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount-min">Min Amount ($)</Label>
              <Input
                id="amount-min"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount_min ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount_min: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                placeholder="Leave blank for no minimum"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount-max">Max Amount ($)</Label>
              <Input
                id="amount-max"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount_max ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount_max: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                placeholder="Leave blank for no maximum"
              />
            </div>
          </div>
          {errors.amount_range && (
            <p className="text-sm text-red-600 mt-2">{errors.amount_range}</p>
          )}
        </CardContent>
      </Card>

      {/* Transaction Type Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction Type Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={formData.transaction_type ?? "null"}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                transaction_type:
                  value === "null" ? null : (value as "debit" | "credit"),
              })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="null" id="both" />
              <Label htmlFor="both" className="cursor-pointer">
                Both Debits and Credits
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="debit" id="debits-only" />
              <Label htmlFor="debits-only" className="cursor-pointer">
                Debits Only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="credit" id="credits-only" />
              <Label htmlFor="credits-only" className="cursor-pointer">
                Credits Only
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Confidence Score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confidence Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="confidence">Confidence Score</Label>
              <span className={`text-lg font-bold ${confidenceColor}`}>
                {formData.confidence_score}%
              </span>
            </div>
            <Input
              id="confidence"
              type="range"
              min="0"
              max="100"
              step="5"
              value={formData.confidence_score}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  confidence_score: parseInt(e.target.value),
                })
              }
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Lower confidence = more likely to go to HITL review
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test Pattern */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Pattern</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-input">
              Enter a transaction description to test
            </Label>
            <Input
              id="test-input"
              value={testInput}
              onChange={(e) => {
                setTestInput(e.target.value);
                if (e.target.value.trim()) {
                  testPattern();
                } else {
                  setTestResult(null);
                }
              }}
              placeholder="e.g., AMAZON.CA*1234567"
            />
          </div>

          {testResult && (
            <Alert
              variant={testResult.matches ? "default" : "destructive"}
              className={
                testResult.matches
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription
                className={
                  testResult.matches ? "text-green-800" : "text-red-800"
                }
              >
                {testResult.matches ? "✓ Would match" : "✗ Would not match"} (
                {testResult.reason})
                {formData.pattern_type !== "exact" &&
                  formData.pattern_type !== "regex" && (
                    <>
                      <br />
                      <span className="text-xs">
                        Pattern type: {patternTypeLabels[formData.pattern_type]}
                      </span>
                    </>
                  )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Pattern Info */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>
            Pattern Type: {patternTypeLabels[formData.pattern_type]}
          </strong>
          {formData.pattern_type === "regex" && (
            <>
              <br />
              <span className="text-sm">
                Use standard regex syntax. Example: ^AMAZON.*\.CA$ matches
                Amazon Canadian transactions.
              </span>
            </>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
