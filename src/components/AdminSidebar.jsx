import React from "react";
import { Link } from "react-router-dom";

export default function AdminSidebar() {

  const style = {
    width: "220px",
    background: "#0f172a",
    color: "white",
    height: "100vh",
    padding: "20px",
    position: "fixed",
    left: 0,
    top: 0
  };

  const linkStyle = {
    display: "block",
    color: "white",
    padding: "10px 0",
    textDecoration: "none"
  };

  return (
    <div style={style}>
      <h2>Admin Panel</h2>

      <Link style={linkStyle} to="/admin">Dashboard</Link>
      <Link style={linkStyle} to="/admin/products">Products</Link>
      <Link style={linkStyle} to="/admin/orders">Orders</Link>
      <Link style={linkStyle} to="/admin/users">Users</Link>
      <Link style={linkStyle} to="/admin/categories">Categories</Link>

    </div>
  );
}