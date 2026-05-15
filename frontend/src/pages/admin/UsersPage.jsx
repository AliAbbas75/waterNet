import { useMemo, useState } from "react";
import { Search, Shield, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Input, Select, Field } from "../../components/ui/Input.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Avatar } from "../../components/ui/Avatar.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { useToggleUserActive, useUpdateUserRole, useUsers } from "../../hooks/useUsers.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { relTime, shortAddr } from "../../lib/format.js";

const ROLE_VARIANT = {
  SUPER_ADMIN: "unsafe",
  ADMIN: "brand",
  MAINTAINER: "info",
  PUBLIC: "muted"
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [search, setSearch] = useState("");
  const filters = useMemo(() => ({ role, active, search }), [role, active, search]);
  const users = useUsers(filters);
  const [editing, setEditing] = useState(null);
  const [confirmActive, setConfirmActive] = useState(null);
  const updateRole = useUpdateUserRole();
  const toggleActive = useToggleUserActive();

  const isSuper = me?.role === "SUPER_ADMIN";

  const columns = [
    {
      key: "user",
      header: "User",
      render: (u) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={u.display_name || u.email} size={32} />
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{u.display_name || u.email}</p>
            <p className="text-xs text-slate-500 truncate">{u.email || shortAddr(u.wallet_address)}</p>
          </div>
        </div>
      )
    },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <Badge variant={ROLE_VARIANT[u.role] || "neutral"} dot>
          {u.role}
        </Badge>
      )
    },
    {
      key: "wallet",
      header: "Wallet",
      render: (u) => (
        <span className="text-xs font-mono text-slate-600">{shortAddr(u.wallet_address)}</span>
      )
    },
    {
      key: "active",
      header: "Status",
      render: (u) =>
        u.active ? (
          <Badge variant="safe" dot>
            Active
          </Badge>
        ) : (
          <Badge variant="muted" dot>
            Disabled
          </Badge>
        )
    },
    {
      key: "lastLogin",
      header: "Last login",
      render: (u) => <span className="text-sm text-slate-500">{relTime(u.last_login_at)}</span>
    },
    {
      key: "actions",
      header: "",
      cellClassName: "text-right",
      render: (u) => (
        <div className="inline-flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ShieldCheck size={14} />}
            onClick={() => setEditing(u)}
          >
            Role
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={u.active ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
            onClick={() => setConfirmActive(u)}
            disabled={String(u._id) === String(me?._id)}
          >
            {u.active ? "Disable" : "Enable"}
          </Button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Users"
        description={isSuper ? "Manage roles, grant SUPER_ADMIN, disable accounts." : "Manage roles and account access."}
        action={<Shield size={20} className="text-slate-400" />}
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Search name, email, wallet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="SUPER_ADMIN">Super admin</option>
            <option value="ADMIN">Admin</option>
            <option value="MAINTAINER">Maintainer</option>
            <option value="PUBLIC">Public</option>
          </Select>
          <Select value={active} onChange={(e) => setActive(e.target.value)}>
            <option value="">Active + disabled</option>
            <option value="true">Active only</option>
            <option value="false">Disabled only</option>
          </Select>
        </div>
      </Card>

      {users.isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner label="Loading users…" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={users.data || []}
          empty={<EmptyState icon={Users} title="No users found" />}
        />
      )}

      <RoleModal
        open={!!editing}
        user={editing}
        isSuper={isSuper}
        onClose={() => setEditing(null)}
        onConfirm={async (newRole) => {
          await updateRole.mutateAsync({ id: editing._id, role: newRole });
          setEditing(null);
        }}
        loading={updateRole.isPending}
      />
      <ActiveModal
        open={!!confirmActive}
        user={confirmActive}
        onClose={() => setConfirmActive(null)}
        onConfirm={async () => {
          await toggleActive.mutateAsync({ id: confirmActive._id, active: !confirmActive.active });
          setConfirmActive(null);
        }}
        loading={toggleActive.isPending}
      />
    </>
  );
}

function RoleModal({ open, user, isSuper, onClose, onConfirm, loading }) {
  const [role, setRole] = useState(user?.role || "PUBLIC");
  useMemo(() => setRole(user?.role || "PUBLIC"), [user, open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change role"
      subtitle={user ? user.display_name || user.email : ""}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(role)} loading={loading} disabled={role === user?.role}>
            Save
          </Button>
        </>
      }
    >
      <Field label="Role">
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="PUBLIC">Public — citizens / society residents</option>
          <option value="MAINTAINER">Maintainer — field technicians</option>
          <option value="ADMIN">Admin — operations team</option>
          {isSuper ? <option value="SUPER_ADMIN">Super admin — system owner</option> : null}
        </Select>
      </Field>
      {!isSuper && user?.role === "SUPER_ADMIN" ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
          You cannot demote a SUPER_ADMIN account. Ask a super admin to do this.
        </p>
      ) : null}
    </Modal>
  );
}

function ActiveModal({ open, user, onClose, onConfirm, loading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user?.active ? "Disable account?" : "Re-enable account?"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={user?.active ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {user?.active ? "Disable" : "Enable"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        {user?.active
          ? "Disabled accounts cannot sign in. Their data and history are preserved."
          : "Re-enable so this account can sign in again."}
      </p>
    </Modal>
  );
}
