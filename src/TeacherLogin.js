import { useState } from "react";
import Dashboard from "./Dashboard";
import { teacherLogin, teacherLogout } from "./teacherApi";
import "./Teacher.css";

function TeacherLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggedIn, setLoggedIn] = useState(
    Boolean(sessionStorage.getItem("teacherToken"))
  );

  const signIn = async () => {
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setBusy(true);
    try {
      await teacherLogin(password);
      setError("");
      setPassword("");
      setLoggedIn(true);
    } catch (err) {
      const status = err.response && err.response.status;
      if (status === 401) {
        setError("Incorrect password. Check it and try again.");
      } else if (status === 429) {
        setError("Too many attempts. Wait 15 minutes and try again.");
      } else {
        setError("Could not reach the server. Make sure it is running.");
      }
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await teacherLogout();
    setPassword("");
    setLoggedIn(false);
  };

  if (loggedIn) {
    return <Dashboard onLogout={logout} />;
  }

  return (
    <div className="teacher-page t-center">
      <div className="t-card login">
        <h1 className="t-title">Teacher login</h1>
        <p className="t-sub">Sign in to manage questions and view results.</p>

        <div className="t-field">
          <label htmlFor="teacher-password">Password</label>
          <input
            id="teacher-password"
            className={`t-input ${error ? "has-error" : ""}`}
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") signIn();
            }}
          />
          {error && <p className="t-error">{error}</p>}
        </div>

        <button className="t-btn full" onClick={signIn} disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </div>
  );
}

export default TeacherLogin;