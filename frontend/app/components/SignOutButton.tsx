import { LogOut } from "lucide-react";
import { signOut } from "../login/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="cl-iconbtn" aria-label="Sign out" title="Sign out">
        <LogOut size={14} />
      </button>
    </form>
  );
}
