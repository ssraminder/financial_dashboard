import { useState } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface DeleteStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  statementInfo: {
    fileName: string;
    periodStart: string;
    periodEnd: string;
    transactionCount: number;
    accountName: string;
  };
  isDeleting: boolean;
}

export function DeleteStatementModal({
  isOpen,
  onClose,
  onConfirm,
  statementInfo,
  isDeleting,
}: DeleteStatementModalProps) {
  const [confirmText, setConfirmText] = useState("");

  const isConfirmValid = confirmText === "DELETE";

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
            <ExclamationTriangle className="w-6 h-6" />
            Delete Statement
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 font-medium">
              This action cannot be undone!
            </p>
            <p className="text-red-700 text-sm mt-1">
              All transactions from this statement will be permanently deleted.
            </p>
          </div>

          <div className="space-y-2 text-sm text-gray-600 mb-4">
            <p>
              <strong>Account:</strong> {statementInfo.accountName}
            </p>
            <p>
              <strong>File:</strong> {statementInfo.fileName}
            </p>
            <p>
              <strong>Period:</strong> {statementInfo.periodStart} to{" "}
              {statementInfo.periodEnd}
            </p>
            <p>
              <strong>Transactions:</strong> {statementInfo.transactionCount}
            </p>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type{" "}
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                DELETE
              </span>{" "}
              to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE here"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                confirmText && !isConfirmValid
                  ? "border-red-300 focus:ring-red-500"
                  : "border-gray-300 focus:ring-blue-500"
              }`}
              autoComplete="off"
              disabled={isDeleting}
            />
            {confirmText && !isConfirmValid && (
              <p className="text-red-500 text-xs mt-1">
                Please type DELETE exactly (case-sensitive)
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmValid || isDeleting}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              isConfirmValid && !isDeleting
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Statement
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
