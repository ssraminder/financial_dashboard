import { CheckCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ConfirmStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  statement: {
    statement_period_start: string;
    statement_period_end: string;
    opening_balance: number;
    closing_balance: number;
  };
  transactionCount: number;
  isConfirming: boolean;
}

const formatDateSafe = (dateStr: string) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
};

export function ConfirmStatementModal({
  isOpen,
  onClose,
  onConfirm,
  statement,
  transactionCount,
  isConfirming,
}: ConfirmStatementModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="max-w-md w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
            Confirm Statement
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 font-medium">
              Ready to confirm this statement?
            </p>
            <p className="text-blue-700 text-sm mt-1">
              Once confirmed, transaction amounts and directions cannot be
              changed.
            </p>
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <strong>Period:</strong>{" "}
              {formatDateSafe(statement.statement_period_start)} to{" "}
              {formatDateSafe(statement.statement_period_end)}
            </p>
            <p>
              <strong>Transactions:</strong> {transactionCount}
            </p>
            <p>
              <strong>Opening Balance:</strong> $
              {statement.opening_balance?.toFixed(2)}
            </p>
            <p>
              <strong>Closing Balance:</strong> $
              {statement.closing_balance?.toFixed(2)}
            </p>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-sm font-medium">
              After confirmation:
            </p>
            <ul className="text-amber-700 text-sm mt-1 list-disc list-inside space-y-1">
              <li>Transaction amounts will be locked</li>
              <li>Transaction directions (IN/OUT) will be locked</li>
              <li>You can still edit categories, vendors, and notes</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-500 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirm & Lock
              </>
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}
