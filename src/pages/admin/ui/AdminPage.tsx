import { Link } from "react-router";
import { useMe } from "@/entities/session";
import { AccessAdmin } from "@/features/manage-access";

export function AdminPage() {
  const { data: me } = useMe();
  if (!me?.isAdmin) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-xl">Админка</h1>
        <p className="text-muted-foreground">
          Сюда может зайти только владелец.
        </p>
        <Link to="/" className="underline">
          К тренировке
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold text-xl">Админка</h1>
      <AccessAdmin />
    </div>
  );
}
