import React, { useState, useEffect } from 'react';
import { Users, Search, Loader2, Edit, Trash2, X } from 'lucide-react';
import { User, Department } from '../../types';
import { firestoreService } from '../../src/services/firestoreService';
import { where } from 'firebase/firestore';

interface MembersProps {
  user: User;
}

const Members: React.FC<MembersProps> = ({ user }) => {
  const [members, setMembers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<User['role']>('student');
  const [departmentId, setDepartmentId] = useState('');

  useEffect(() => {
    const unsubscribeMembers = firestoreService.subscribeToCollection<User>('users', [where('role', '!=', 'admin')], (data) => {
      setMembers(data);
      setLoading(false);
    });

    const unsubscribeDepts = firestoreService.subscribeToCollection<Department>('departments', [], (data) => {
      setDepartments(data);
    });

    return () => {
      unsubscribeMembers();
      unsubscribeDepts();
    };
  }, []);

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemberId) return;
    setEditing(true);
    try {
      await firestoreService.updateDoc('users', editingMemberId, {
        name,
        email,
        role,
        departmentId
      });
      setShowEditModal(false);
      setEditingMemberId(null);
    } catch (error) {
      console.error('Failed to edit member', error);
      alert('Failed to edit member');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!window.confirm('Are you sure you want to delete this member?')) return;
    try {
      await firestoreService.deleteDoc('users', memberId);
    } catch (error) {
      console.error('Failed to delete member', error);
      alert('Failed to delete member');
    }
  };

  const openEditModal = (member: User) => {
    setEditingMemberId(member.uid);
    setName(member.name);
    setEmail(member.email);
    setRole(member.role);
    setDepartmentId(member.departmentId || '');
    setShowEditModal(true);
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || 
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase());
    
    if (user.role === 'hod') {
      return matchesSearch && m.departmentId === user.departmentId;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Members</h2>
          <p className="text-slate-500">Manage library members and their roles.</p>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">Name</th>
                  <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">Email</th>
                  <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">Role</th>
                  <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">Department</th>
                  {user.role === 'admin' && <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredMembers.map(member => (
                  <tr key={member.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                          {member.name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">{member.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{member.email}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        member.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' :
                        member.role === 'hod' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                        member.role === 'faculty' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' :
                        'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {departments.find(d => d.id === member.departmentId)?.name || member.departmentId || 'N/A'}
                    </td>
                    {user.role === 'admin' && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditModal(member)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteMember(member.uid)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={user.role === 'admin' ? 5 : 4} className="p-8 text-center text-slate-500">
                      No members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Member</h3>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  setEditingMemberId(null);
                }}
                className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditMember} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <select 
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value as User['role'])}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="hod">HOD</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <select 
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">None</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingMemberId(null);
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
    </div>
  );
};

export default Members;
