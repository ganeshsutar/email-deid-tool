import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { DataTablePagination } from "@/components/data-table-pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import { useUsers } from "@/features/users/api/get-users";
import { useActivateUser } from "@/features/users/api/activate-user";
import { UsersTable } from "@/features/users/components/users-table";
import { UsersFilters } from "@/features/users/components/users-filters";
import { UserFormDialog } from "@/features/users/components/user-form-dialog";
import { DeactivationConfirmDialog } from "@/features/users/components/deactivation-confirm-dialog";
import { ChangePasswordDialog } from "@/features/users/components/change-password-dialog";
import type { User } from "@/types/models";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [changingPasswordUser, setChangingPasswordUser] = useState<User | null>(null);

  const activateUser = useActivateUser();

  const { data, isLoading } = useUsers({
    page,
    pageSize,
    search,
    role: role === "all" ? "" : role,
    status: status === "all" ? "" : status,
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleRoleChange = useCallback((value: string) => {
    setRole(value);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setStatus(value);
    setPage(1);
  }, []);

  function handleCreate() {
    setEditingUser(null);
    setFormOpen(true);
  }

  function handleEdit(user: User) {
    setEditingUser(user);
    setFormOpen(true);
  }

  function handleChangePassword(user: User) {
    setFormOpen(false);
    setChangingPasswordUser(user);
  }

  function handleDeactivate(user: User) {
    setFormOpen(false);
    setDeactivatingUser(user);
  }

  async function handleActivate(user: User) {
    await activateUser.mutateAsync(user.id);
    setFormOpen(false);
  }

  return (
    <div className="space-y-4" data-testid="users-page">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Users</h1>
        <Button onClick={handleCreate} data-testid="add-user-button">
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <UsersFilters
        search={search}
        role={role}
        status={status}
        onSearchChange={handleSearchChange}
        onRoleChange={handleRoleChange}
        onStatusChange={handleStatusChange}
      />

      {isLoading ? (
        <div className="rounded-lg border">
          <TableSkeleton rows={8} columns={5} />
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <UsersTable users={data?.results ?? []} onEdit={handleEdit} />
          </div>
          <div data-testid="users-pagination">
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalCount={data?.count ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        </>
      )}

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        onDeactivate={handleDeactivate}
        onActivate={handleActivate}
        onChangePassword={handleChangePassword}
      />

      <DeactivationConfirmDialog
        open={!!deactivatingUser}
        onOpenChange={(open) => !open && setDeactivatingUser(null)}
        user={deactivatingUser}
        onComplete={() => setDeactivatingUser(null)}
      />

      <ChangePasswordDialog
        open={!!changingPasswordUser}
        onOpenChange={(open) => !open && setChangingPasswordUser(null)}
        user={changingPasswordUser}
      />
    </div>
  );
}
