import { useState } from "react";
import {
  Download,
  FileText,
  FileSpreadsheet,
  File,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface ExportDropdownProps {
  statement: any;
  transactions: any[];
  bankAccount: any;
}

export const ExportDropdown = ({
  statement,
  transactions,
  bankAccount,
}: ExportDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "csv" | "xlsx" | null>(
    null,
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
  };

  const getFileName = (extension: string) => {
    const accountName = bankAccount?.name || "Statement";
    const startDate = statement.statement_period_start?.replace(/-/g, "");
    const endDate = statement.statement_period_end?.replace(/-/g, "");
    return `${accountName}_${startDate}_${endDate}.${extension}`;
  };

  // ==================== CSV EXPORT ====================
  const exportToCSV = () => {
    setExporting("csv");

    try {
      // CSV Headers
      const headers = [
        "#",
        "Date",
        "Description",
        "Payee",
        "Category",
        "Debit",
        "Credit",
        "Balance",
      ];

      // CSV Rows
      const rows = transactions.map((t, index) => {
        const amount = t.total_amount || Math.abs(t.amount) || 0;
        return [
          index + 1,
          t.transaction_date,
          `"${(t.description || "").replace(/"/g, '""')}"`, // Escape quotes
          `"${(t.payee_name || "").replace(/"/g, '""')}"`,
          t.category?.name || "",
          t.transaction_type === "debit" ? amount.toFixed(2) : "",
          t.transaction_type === "credit" ? amount.toFixed(2) : "",
          (t.running_balance || t.calculated_balance || 0).toFixed(2),
        ];
      });

      // Add summary rows
      const totalDebits = transactions
        .filter((t) => t.transaction_type === "debit")
        .reduce(
          (sum, t) => sum + (t.total_amount || Math.abs(t.amount) || 0),
          0,
        );
      const totalCredits = transactions
        .filter((t) => t.transaction_type === "credit")
        .reduce(
          (sum, t) => sum + (t.total_amount || Math.abs(t.amount) || 0),
          0,
        );

      rows.push([]);
      rows.push([
        "",
        "",
        "",
        "",
        "TOTALS",
        totalDebits.toFixed(2),
        totalCredits.toFixed(2),
        "",
      ]);

      // Build CSV content
      const csvContent = [
        `Account:,${bankAccount?.name || ""}`,
        `Period:,${formatDate(statement.statement_period_start)} - ${formatDate(statement.statement_period_end)}`,
        `Opening Balance:,${statement.opening_balance?.toFixed(2) || "0.00"}`,
        `Closing Balance:,${statement.closing_balance?.toFixed(2) || "0.00"}`,
        "",
        headers.join(","),
        ...rows.map((r) => r.join(",")),
      ].join("\n");

      // Download
      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = getFileName("csv");
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("CSV export error:", err);
      alert("Failed to export CSV");
    }

    setExporting(null);
    setIsOpen(false);
  };

  // ==================== EXCEL EXPORT ====================
  const exportToExcel = () => {
    setExporting("xlsx");

    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Prepare data
      const data: any[][] = [
        ["Account:", bankAccount?.name || ""],
        [
          "Period:",
          `${formatDate(statement.statement_period_start)} - ${formatDate(statement.statement_period_end)}`,
        ],
        ["Opening Balance:", statement.opening_balance || 0],
        ["Closing Balance:", statement.closing_balance || 0],
        [],
        [
          "#",
          "Date",
          "Description",
          "Payee",
          "Category",
          "Debit",
          "Credit",
          "Balance",
        ],
      ];

      // Add transactions
      transactions.forEach((t, index) => {
        const amount = t.total_amount || Math.abs(t.amount) || 0;
        data.push([
          index + 1,
          t.transaction_date,
          t.description || "",
          t.payee_name || "",
          t.category?.name || "",
          t.transaction_type === "debit" ? amount : "",
          t.transaction_type === "credit" ? amount : "",
          t.running_balance || t.calculated_balance || 0,
        ]);
      });

      // Add totals row
      const totalDebits = transactions
        .filter((t) => t.transaction_type === "debit")
        .reduce(
          (sum, t) => sum + (t.total_amount || Math.abs(t.amount) || 0),
          0,
        );
      const totalCredits = transactions
        .filter((t) => t.transaction_type === "credit")
        .reduce(
          (sum, t) => sum + (t.total_amount || Math.abs(t.amount) || 0),
          0,
        );

      data.push([]);
      data.push(["", "", "", "", "TOTALS", totalDebits, totalCredits, ""]);

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);

      // Set column widths
      ws["!cols"] = [
        { wch: 5 }, // Serial #
        { wch: 12 }, // Date
        { wch: 40 }, // Description
        { wch: 25 }, // Payee
        { wch: 20 }, // Category
        { wch: 12 }, // Debit
        { wch: 12 }, // Credit
        { wch: 15 }, // Balance
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Statement");

      // Download
      XLSX.writeFile(wb, getFileName("xlsx"));
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Failed to export Excel");
    }

    setExporting(null);
    setIsOpen(false);
  };

  // ==================== PDF EXPORT ====================
  const exportToPDF = () => {
    setExporting("pdf");

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Bank Statement", pageWidth / 2, 20, { align: "center" });

      // Account Info
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Account: ${bankAccount?.name || "Unknown"}`, 14, 35);
      doc.text(`Bank: ${bankAccount?.bank_name || ""}`, 14, 42);
      doc.text(
        `Period: ${formatDate(statement.statement_period_start)} - ${formatDate(statement.statement_period_end)}`,
        14,
        49,
      );

      // Balance Summary
      doc.setFont("helvetica", "bold");
      doc.text(
        `Opening Balance: $${
          statement.opening_balance?.toLocaleString("en-CA", {
            minimumFractionDigits: 2,
          }) || "0.00"
        }`,
        14,
        60,
      );
      doc.text(
        `Closing Balance: $${
          statement.closing_balance?.toLocaleString("en-CA", {
            minimumFractionDigits: 2,
          }) || "0.00"
        }`,
        14,
        67,
      );

      // Transactions Table
      const tableData = transactions.map((t, index) => {
        const amount = t.total_amount || Math.abs(t.amount) || 0;
        return [
          index + 1,
          t.transaction_date,
          (t.description || "").substring(0, 35),
          t.transaction_type === "debit" ? `-$${amount.toFixed(2)}` : "",
          t.transaction_type === "credit" ? `+$${amount.toFixed(2)}` : "",
          `$${(t.running_balance || t.calculated_balance || 0).toFixed(2)}`,
        ];
      });

      autoTable(doc, {
        startY: 75,
        head: [["#", "Date", "Description", "Debits", "Credits", "Balance"]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 25 },
          2: { cellWidth: 60 },
          3: { cellWidth: 30, halign: "right" },
          4: { cellWidth: 30, halign: "right" },
          5: { cellWidth: 30, halign: "right" },
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        didDrawCell: (data) => {
          // Color debits red and credits green
          if (data.section === "body") {
            if (data.column.index === 3 && data.cell.raw) {
              data.cell.styles.textColor = [220, 38, 38]; // Red
            }
            if (data.column.index === 4 && data.cell.raw) {
              data.cell.styles.textColor = [22, 163, 74]; // Green
            }
          }
        },
      });

      // Footer with totals
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      const totalDebits = transactions
        .filter((t) => t.transaction_type === "debit")
        .reduce(
          (sum, t) => sum + (t.total_amount || Math.abs(t.amount) || 0),
          0,
        );
      const totalCredits = transactions
        .filter((t) => t.transaction_type === "credit")
        .reduce(
          (sum, t) => sum + (t.total_amount || Math.abs(t.amount) || 0),
          0,
        );

      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text(
        `Total Debits: -$${totalDebits.toLocaleString("en-CA", {
          minimumFractionDigits: 2,
        })}`,
        14,
        finalY,
      );
      doc.setTextColor(22, 163, 74);
      doc.text(
        `Total Credits: +$${totalCredits.toLocaleString("en-CA", {
          minimumFractionDigits: 2,
        })}`,
        100,
        finalY,
      );
      doc.setTextColor(0, 0, 0);
      doc.text(`Transactions: ${transactions.length}`, 14, finalY + 7);

      // Save
      doc.save(getFileName("pdf"));
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF");
    }

    setExporting(null);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!transactions || transactions.length === 0}
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-20">
            <div className="py-1">
              <button
                onClick={exportToPDF}
                disabled={exporting === "pdf"}
                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-wait"
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                ) : (
                  <FileText className="h-4 w-4 text-red-500" />
                )}
                <span>Export as PDF</span>
              </button>

              <button
                onClick={exportToCSV}
                disabled={exporting === "csv"}
                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-wait"
              >
                {exporting === "csv" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                ) : (
                  <File className="h-4 w-4 text-green-500" />
                )}
                <span>Export as CSV</span>
              </button>

              <button
                onClick={exportToExcel}
                disabled={exporting === "xlsx"}
                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-wait"
              >
                {exporting === "xlsx" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                )}
                <span>Export as Excel</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
