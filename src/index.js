import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
} from "motion/react";
import "./index.css";
import App from "./App";
import TeacherLogin from "./TeacherLogin";
import AddQuestion from "./AddQuestion";
import "./exam-theme.css";
import reportWebVitals from "./reportWebVitals";

// A short crossfade when moving between pages
function Page({ children }) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </m.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Students */}
        <Route
          path="/"
          element={
            <Page>
              <App />
            </Page>
          }
        />

        {/* Teachers (login required) */}
        <Route
          path="/teacher"
          element={
            <Page>
              <TeacherLogin />
            </Page>
          }
        />
        <Route
          path="/teacher/add-question"
          element={
            <Page>
              <AddQuestion />
            </Page>
          }
        />

        {/* Anything else goes back to the student page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    {/* "user" turns movement down for people who ask their device for less motion */}
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </LazyMotion>
    </MotionConfig>
  </React.StrictMode>
);

reportWebVitals();