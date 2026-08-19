import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import TechnicianLayout from "./layouts/TechnicianLayout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Orders from "./pages/Orders";
import Technicians from "./pages/Technicians";
import Customers from "./pages/Customers";
import ServiceTypes from "./pages/ServiceTypes";
import Invoices from "./pages/Invoices";
import Kasir from "./pages/Kasir";
import Reports from "./pages/Reports";
import MyOrders from "./pages/technician/MyOrders";
import MyOrderDetail from "./pages/technician/MyOrderDetail";
import Helpers from "./pages/Helpers";
import HelperLayout from "./layouts/HelperLayout";
import MyAssignments from "./pages/helper/MyAssignments";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/my"
            element={
              <ProtectedRoute roles={["TECHNICIAN"]}>
                <TechnicianLayout />
              </ProtectedRoute>
            }
          >
            <Route path="orders" element={<MyOrders />} />
            <Route path="orders/:id" element={<MyOrderDetail />} />
          </Route>

          <Route
            path="/helper"
            element={
              <ProtectedRoute roles={["HELPER"]}>
                <HelperLayout />
              </ProtectedRoute>
            }
          >
            <Route path="assignments" element={<MyAssignments />} />
          </Route>
          <Route
            path="/"
            element={
              <ProtectedRoute roles={["ADMIN", "STAFF"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="kasir" element={<Kasir />} />
            <Route path="technicians" element={<Technicians />} />
            <Route path="helpers" element={<Helpers />} />
            <Route path="customers" element={<Customers />} />
            <Route path="service-types" element={<ServiceTypes />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
