"use client";

import { useState } from "react";

const mockUsers = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    role: "admin",
    downloads: 156,
    joined: "2024-01-15",
    status: "active",
  },
  {
    id: "2",
    name: "Sarah Miller",
    email: "sarah@example.com",
    role: "user",
    downloads: 89,
    joined: "2024-02-20",
    status: "active",
  },
  {
    id: "3",
    name: "Mike Johnson",
    email: "mike@example.com",
    role: "user",
    downloads: 234,
    joined: "2024-03-10",
    status: "active",
  },
  {
    id: "4",
    name: "Emily Brown",
    email: "emily@example.com",
    role: "moderator",
    downloads: 67,
    joined: "2024-04-05",
    status: "active",
  },
  {
    id: "5",
    name: "Chris Wilson",
    email: "chris@example.com",
    role: "user",
    downloads: 12,
    joined: "2024-05-12",
    status: "banned",
  },
];

export default function AdminUsers() {
  const [users, setUsers] = useState(mockUsers);
  const [search, setSearch] = useState("");

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStatus = (id: string) => {
    setUsers(
      users.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "active" ? "banned" : "active" }
          : u
      )
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <span className="text-gray-400 text-sm">{users.length} total users</span>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 text-white text-sm rounded-lg px-4 py-2 w-full max-w-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 border border-gray-700"
        />
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm bg-gray-900">
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Downloads</th>
                <th className="p-4">Joined</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-gray-700/50 hover:bg-gray-700/30"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {user.name}
                        </p>
                        <p className="text-gray-500 text-xs">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        user.role === "admin"
                          ? "bg-red-600/20 text-red-400"
                          : user.role === "moderator"
                          ? "bg-yellow-600/20 text-yellow-400"
                          : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4 text-white text-sm">{user.downloads}</td>
                  <td className="p-4 text-gray-400 text-sm">{user.joined}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        user.status === "active"
                          ? "bg-green-600/20 text-green-400"
                          : "bg-red-600/20 text-red-400"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button className="text-blue-400 hover:text-blue-300 text-sm">
                        Edit
                      </button>
                      <button
                        onClick={() => toggleStatus(user.id)}
                        className={`text-sm ${
                          user.status === "active"
                            ? "text-red-400 hover:text-red-300"
                            : "text-green-400 hover:text-green-300"
                        }`}
                      >
                        {user.status === "active" ? "Ban" : "Unban"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
