import axios from "axios";

export const API_URL = process.env.REACT_APP_API_URL || "";

const api = axios.create({ baseURL: API_URL });

// Send the teacher's session token with every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("teacherToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const teacherLogin = async (password) => {
  const { data } = await axios.post(`${API_URL}/teacher/login`, { password });
  sessionStorage.setItem("teacherToken", data.token);
};

export const teacherLogout = async () => {
  try {
    await api.post("/teacher/logout");
  } catch (error) {
    // The token may already be expired. Clear it either way.
  }
  sessionStorage.removeItem("teacherToken");
};

export default api;