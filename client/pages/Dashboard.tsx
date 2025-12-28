import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { DashboardStats } from '@/types';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    revenue: 0,
    expenses: 0,
    netIncome: 0,
    pendingReviews: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Fetch transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('amount, category_id, needs_review, categories(type)');

      if (transactionsError) throw transactionsError;

      // Calculate stats
      let revenue = 0;
      let expenses = 0;
      let pendingReviews = 0;

      transactions?.forEach((transaction: any) => {
        if (transaction.needs_review) {
          pendingReviews++;
        }

        const amount = transaction.amount;
        const categoryType = transaction.categories?.type;

        if (categoryType === 'income') {
          revenue += amount;
        } else if (categoryType === 'expense') {
          expenses += Math.abs(amount);
        }
      });

      const netIncome = revenue - expenses;

      setStats({
        revenue,
        expenses,
        netIncome,
        pendingReviews,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
  };

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
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your financial metrics
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Revenue Card */}
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Revenue
                  </CardTitle>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(stats.revenue)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total income
                  </p>
                </CardContent>
              </Card>

              {/* Expenses Card */}
              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Expenses
                  </CardTitle>
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(stats.expenses)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total expenses
                  </p>
                </CardContent>
              </Card>

              {/* Net Income Card */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Net Income
                  </CardTitle>
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${
                      stats.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(stats.netIncome)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Revenue - Expenses
                  </p>
                </CardContent>
              </Card>

              {/* Pending Reviews Card */}
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pending Reviews
                  </CardTitle>
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.pendingReviews}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Transactions awaiting review
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Additional Info */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Welcome to the Cethos Financial Dashboard. Here you can:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Monitor your revenue, expenses, and net income</li>
                <li>Review and approve transactions in the HITL Review Queue</li>
                <li>Upload bank statements and transaction data</li>
              </ul>
              <p className="mt-4 text-xs">
                <strong>Note:</strong> To see data on this dashboard, you need to configure
                your Supabase database with the required tables and add some sample data.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
