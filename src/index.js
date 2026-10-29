import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App";
import TeacherLogin from "./TeacherLogin";
import AddQuestion from "./AddQuestion";
import "./exam-theme.css";
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Students */}
        <Route path="/" element={<App />} />

        {/* Teachers (login required) */}
        <Route path="/teacher" element={<TeacherLogin />} />
        <Route path="/teacher/add-question" element={<AddQuestion />} />

        {/* Anything else goes back to the student page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();