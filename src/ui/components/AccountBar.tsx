import { useAuth } from "../../lib/AuthProvider";

export function AccountBar() {
  const { user, profile, loading, backendConfigured, signInWithGoogle, signOut } = useAuth();

  if (!backendConfigured) return null;

  if (loading) {
    return <div className="account-bar">Checking session…</div>;
  }

  if (!user) {
    return (
      <div className="account-bar">
        <button className="btn" onClick={() => void signInWithGoogle()}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="account-bar">
      <span className="account-bar__email">
        {user.email}
        {profile?.is_admin && <span className="account-bar__admin-badge">Admin</span>}
        <span className="account-bar__synced" title="Cards and coins are saved to this account">
          ☁ Synced
        </span>
      </span>
      <button className="btn btn--small" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}
