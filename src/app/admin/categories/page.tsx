"use client";

import { useState, useEffect } from "react";
import { categories, getSoftwareList, type Software } from "@/lib/data";
import { useToast } from "@/components/admin/Toast";

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  subcategories: string[];
}

export default function AdminCategories() {
  const [categoryList, setCategoryList] = useState<Category[]>(categories);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Category>({ id: "", name: "", description: "", icon: "", subcategories: [] });
  const [newCategory, setNewCategory] = useState({ id: "", name: "", description: "" });
  const [newSub, setNewSub] = useState("");
  const [softwareList, setSoftwareList] = useState<Software[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    getSoftwareList().then(setSoftwareList);
  }, []);

  const handleAdd = () => {
    if (newCategory.id && newCategory.name) {
      setCategoryList([
        ...categoryList,
        { ...newCategory, icon: "", subcategories: [] },
      ]);
      setNewCategory({ id: "", name: "", description: "" });
      setShowAdd(false);
    }
  };

  const handleDelete = (id: string) => {
    const count = softwareList.filter((s) => s.category === id).length;
    if (count > 0) {
      toast(`Cannot delete: ${count} software entries in this category`, "error");
      return;
    }
    if (confirm("Delete this category?")) {
      setCategoryList(categoryList.filter((c) => c.id !== id));
      toast("Category deleted", "success");
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditForm({ ...cat });
  };

  const saveEdit = () => {
    setCategoryList(categoryList.map((c) => (c.id === editingId ? editForm : c)));
    setEditingId(null);
  };

  const addSubcategory = () => {
    if (newSub.trim() && editingId) {
      setEditForm({ ...editForm, subcategories: [...editForm.subcategories, newSub.trim()] });
      setNewSub("");
    }
  };

  const removeSubcategory = (sub: string) => {
    setEditForm({ ...editForm, subcategories: editForm.subcategories.filter((s) => s !== sub) });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Categories</h1>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add Category"}
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#111827] rounded-xl border border-blue-900/30 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">New Category</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-blue-300/60 text-sm mb-2">ID</label>
              <input
                type="text"
                value={newCategory.id}
                onChange={(e) => setNewCategory({ ...newCategory, id: e.target.value })}
                placeholder="e.g. vr-games"
                className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
              />
            </div>
            <div>
              <label className="block text-blue-300/60 text-sm mb-2">Name</label>
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g. VR Games"
                className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
              />
            </div>
            <div>
              <label className="block text-blue-300/60 text-sm mb-2">Description</label>
              <input
                type="text"
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Add Category
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoryList.map((cat) => {
          const count = softwareList.filter((s) => s.category === cat.id).length;
          const isEditing = editingId === cat.id;

          if (isEditing) {
            return (
              <div key={cat.id} className="bg-[#111827] rounded-xl border border-blue-500/50 p-6">
                <h3 className="text-white font-semibold mb-4">Editing: {cat.name}</h3>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-blue-300/60 text-xs mb-1">Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-[#0c1222] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-300/60 text-xs mb-1">Description</label>
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full bg-[#0c1222] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-300/60 text-xs mb-1">Subcategories</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newSub}
                        onChange={(e) => setNewSub(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addSubcategory()}
                        placeholder="Add subcategory"
                        className="flex-1 bg-[#0c1222] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
                      />
                      <button onClick={addSubcategory} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm">+</button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {editForm.subcategories.map((sub) => (
                        <span key={sub} className="px-2 py-0.5 bg-blue-900/30 text-blue-300 text-xs rounded flex items-center gap-1">
                          {sub}
                          <button onClick={() => removeSubcategory(sub)} className="text-red-400 hover:text-red-300">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Save</button>
                  <button onClick={() => setEditingId(null)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={cat.id}
              className="bg-[#111827] rounded-xl border border-blue-900/30 p-6 hover:border-blue-500/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold">{cat.name}</h3>
                  <p className="text-blue-300/40 text-sm">{cat.id}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(cat)} className="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                  <button onClick={() => handleDelete(cat.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                </div>
              </div>
              <p className="text-blue-300/60 text-sm mb-4">{cat.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-blue-300/40 text-sm">{count} entries</span>
                <span className="text-blue-300/40 text-sm">{cat.subcategories.length} subcategories</span>
              </div>
              {cat.subcategories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {cat.subcategories.map((sub) => (
                    <span key={sub} className="px-2 py-0.5 bg-blue-900/30 text-blue-300/60 text-xs rounded">
                      {sub}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
