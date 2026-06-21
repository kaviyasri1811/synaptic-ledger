import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, Loader2, X } from 'lucide-react';
import { Department, User } from '../../types';
import { firestoreService } from '../../src/services/firestoreService';

interface DepartmentsProps {
  user: User;
}

const Departments: React.FC<DepartmentsProps> = ({ user }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');

  useEffect(() => {
    const unsubscribe = firestoreService.subscribeToCollection<Department>('departments', [], (data) => {
      setDepartments(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await firestoreService.addDoc('departments', { name });
      setShowAddModal(false);
      setName('');
    } catch (error) {
      console.error('Failed to add department', error);
      alert('Failed to add department');
    } finally {
      setAdding(false);
    }
  };

  const handleEditDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeptId) return;
    setEditing(true);
    try {
      await firestoreService.updateDoc('departments', editingDeptId, { name });
      setShowEditModal(false);
      setName('');
      setEditingDeptId(null);
    } catch (error) {
      console.error('Failed to edit department', error);
      alert('Failed to edit department');
    } finally {
      setEditing(false);
    }
  };

  const openEditModal = (dept: Department) => {
    setEditingDeptId(dept.id);
    setName(dept.name);
    setShowEditModal(true);
  };

  const handleDeleteDepartment = async (deptId: string) => {
    if (!window.confirm('Are you sure you want to delete this department?')) return;
    try {
      await firestoreService.deleteDoc('departments', deptId);
    } catch (error) {
      console.error('Failed to delete department', error);
      alert('Failed to delete department');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Departments</h2>
          <p className="text-slate-500">Manage academic departments.</p>
        </div>
        
        {user.role === 'admin' && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Department
          </button>
        )}
      </div>

      {/* Add Department Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add New Department</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddDepartment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department Name</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={adding}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Department</h3>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  setName('');
                  setEditingDeptId(null);
                }}
                className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditDepartment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department Name</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setName('');
                    setEditingDeptId(null);
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={editing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {editing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map(dept => (
            <div key={dept.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">{dept.name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{dept.code}</p>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm flex-1 mb-6">
                {dept.description || 'No description provided.'}
              </p>
              {user.role === 'admin' && (
                <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => openEditModal(dept)} className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors text-sm font-medium">
                    <Edit className="w-4 h-4" /> Edit
                  </button>
                  <button onClick={() => handleDeleteDepartment(dept.id)} className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          {departments.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              No departments found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Departments;
