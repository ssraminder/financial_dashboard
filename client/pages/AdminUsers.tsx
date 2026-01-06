import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Users,
  Mail,
  Loader2,
  AlertTriangle,
  Shield,
  Eye,
  BarChart3,
  Crown,
  X,
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "accountant" | "viewer";
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: "admin" | "accountant" | "viewer";
  full_name: string | null;
  status: string;
  created_at: string;
  expires_at: string;
}

const RoleBadge = ({ role }: { role: string }) => {
  const config = {
    admin: { bg: "bg-purple-100", text: "text-purple-800", icon: Crown },
    accountant: { bg: "bg-blue-100", text: "text-blue-800", icon: BarChart3 },
    viewer: { bg: "bg-gray-100", text: "text-gray-800", icon: Eye },
  };

  const { bg, text, icon: Icon } = config[role as keyof typeof config] || config.viewer;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${bg} ${text}`}
    >
      <Icon className="w-3 h-3" />
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
};

export default function AdminUsers() {
  const { user, loading: authLoading, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "invitations">("users");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "accountant" | "viewer">("accountant");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchInvitations();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from("user_invitations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error("Error fetching invitations:", error);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail,
          role: inviteRole,
          full_name: inviteName || null,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to send invitation");
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("accountant");
      fetchInvitations();
    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast.error(error.message || "Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Role updated successfully");
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error(error.message || "Failed to update role");
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ is_active: !currentStatus })
        .eq("id", userId);

      if (error) throw error;

      toast.success(
        currentStatus ? "User deactivated" : "User activated"
      );
      fetchUsers();
    } catch (error: any) {
      console.error("Error toggling user status:", error);
      toast.error(error.message || "Failed to update user status");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      toast.success("User deleted successfully");
      setDeleteConfirm(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("user_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitationId);

      if (error) throw error;

      toast.success("Invitation cancelled");
      fetchInvitations();
    } catch (error: any) {
      console.error("Error cancelling invitation:", error);
      toast.error(error.message || "Failed to cancel invitation");
    }
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: invitation.email,
          role: invitation.role,
          full_name: invitation.full_name,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to resend invitation");
      }

      toast.success(`Invitation resent to ${invitation.email}`);
      fetchInvitations();
    } catch (error: any) {
      console.error("Error resending invitation:", error);
      toast.error(error.message || "Failed to resend invitation");
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Never";

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Check if user is admin
  if (profile?.role !== "admin") {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Access Denied
            </h2>
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
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-7 h-7" />
                <span>User Management</span>
              </h1>
              <p className="text-gray-500 mt-1">
                Manage users and their access levels
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>Invite User</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-3 px-1 text-sm font-medium transition-colors ${
                activeTab === "users"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab("invitations")}
              className={`pb-3 px-1 text-sm font-medium transition-colors ${
                activeTab === "invitations"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Pending Invitations ({invitations.length})
            </button>
          </div>

          {/* Users Table */}
          {activeTab === "users" && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No users found</p>
                      </td>
                    </tr>
                  ) : (
                    users.map((userItem) => (
                      <tr key={userItem.id} className="hover:bg-gray-50">
                        {/* User info */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                              {userItem.full_name
                                ? userItem.full_name[0].toUpperCase()
                                : userItem.email[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {userItem.full_name || "No name"}
                              </p>
                              <p className="text-sm text-gray-500">
                                {userItem.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role dropdown */}
                        <td className="px-6 py-4">
                          <select
                            value={userItem.role}
                            onChange={(e) =>
                              handleUpdateRole(
                                userItem.id,
                                e.target.value
                              )
                            }
                            disabled={userItem.id === user?.id}
                            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="admin">👑 Admin</option>
                            <option value="accountant">📊 Accountant</option>
                            <option value="viewer">👁 Viewer</option>
                          </select>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                              userItem.is_active
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                userItem.is_active
                                  ? "bg-green-500"
                                  : "bg-red-500"
                              }`}
                            />
                            {userItem.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* Last login */}
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(userItem.last_login_at)}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 relative">
                            <button
                              onClick={() =>
                                handleToggleActive(
                                  userItem.id,
                                  userItem.is_active
                                )
                              }
                              disabled={userItem.id === user?.id}
                              className={`px-3 py-1 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                userItem.is_active
                                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                  : "bg-green-100 text-green-700 hover:bg-green-200"
                              }`}
                            >
                              {userItem.is_active
                                ? "Deactivate"
                                : "Activate"}
                            </button>
                            <button
                              onClick={() =>
                                setDeleteConfirm(userItem.id)
                              }
                              disabled={userItem.id === user?.id}
                              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Delete
                            </button>

                            {/* Delete Confirmation */}
                            {deleteConfirm === userItem.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg p-3 z-20 w-64">
                                <div className="flex items-start gap-2 mb-2">
                                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      Delete user?
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      This action cannot be undone.
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      handleDeleteUser(userItem.id)
                                    }
                                    className="flex-1 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Invitations Table */}
          {activeTab === "invitations" && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invitations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">
                          No pending invitations
                        </p>
                      </td>
                    </tr>
                  ) : (
                    invitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {inv.email}
                            </p>
                            {inv.full_name && (
                              <p className="text-sm text-gray-500">
                                {inv.full_name}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <RoleBadge role={inv.role} />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(inv.created_at)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(inv.expires_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleResendInvitation(inv)}
                            className="text-blue-600 hover:underline text-sm mr-3"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(inv.id)}
                            className="text-red-600 hover:underline text-sm"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                Invite New User
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="colleague@company.com"
                  required
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="John Doe"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(
                      e.target.value as "admin" | "accountant" | "viewer"
                    )
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="viewer">👁 Viewer - Read only access</option>
                  <option value="accountant">
                    📊 Accountant - Can edit transactions
                  </option>
                  <option value="admin">👑 Admin - Full access</option>
                </select>
              </div>

              {/* Role Permissions Info */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="font-medium text-sm text-blue-900 mb-2">
                  Role Permissions:
                </p>
                <ul className="space-y-1 text-xs text-blue-800">
                  <li>
                    • <strong>Viewer:</strong> View transactions, statements,
                    reports
                  </li>
                  <li>
                    • <strong>Accountant:</strong> + Edit, categorize, upload,
                    review
                  </li>
                  <li>
                    • <strong>Admin:</strong> + Manage users, settings, delete
                    data
                  </li>
                </ul>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {inviteLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send Invitation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
