import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { userAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ROLE_COLOR = {
  super_admin:     'bg-purple-100 text-purple-800',
  admin:           'bg-red-100 text-red-800',
  project_manager: 'bg-blue-100 text-blue-800',
  team_lead:       'bg-yellow-100 text-yellow-800',
  developer:       'bg-green-100 text-green-800',
  qa:              'bg-gray-100 text-gray-700',
};

const ALL_ROLES = [
  { value: 'super_admin',     label: 'Super Admin' },
  { value: 'admin',           label: 'Admin' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'team_lead',       label: 'Team Lead' },
  { value: 'developer',       label: 'Developer' },
  { value: 'qa',              label: 'QA' },
];

const EMPTY_CREATE = { name: '', email: '', password: '', confirmPassword: '', role: 'developer', is_active: true };
const FIELD = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function CreateUserModal({ onClose, onSuccess }) {
  const [form, setForm]     = useState(EMPTY_CREATE);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())               e.name            = 'Name is required';
    if (!form.email.trim())              e.email           = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email    = 'Enter a valid email';
    if (!form.password)                  e.password        = 'Password is required';
    else if (form.password.length < 8)   e.password        = 'Minimum 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await userAPI.create({
        name:      form.name.trim(),
        email:     form.email.trim().toLowerCase(),
        password:  form.password,
        role:      form.role,
        is_active: form.is_active,
      });
      toast.success('User created successfully');
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create user';
      if (msg.toLowerCase().includes('email')) setErrors({ email: msg });
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-slate-900">Create New User</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full name <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Jane Smith"
              className={`${FIELD} ${errors.name ? 'border-red-400 focus:ring-red-400' : ''}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email address <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="jane@company.com"
              className={`${FIELD} ${errors.email ? 'border-red-400 focus:ring-red-400' : ''}`}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="Min. 8 characters"
              className={`${FIELD} ${errors.password ? 'border-red-400 focus:ring-red-400' : ''}`}
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Confirm password <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={e => set('confirmPassword', e.target.value)}
              placeholder="Re-enter password"
              className={`${FIELD} ${errors.confirmPassword ? 'border-red-400 focus:ring-red-400' : ''}`}
            />
            {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role <span className="text-red-500">*</span></label>
            <select
              value={form.role}
              onChange={e => set('role', e.target.value)}
              className={`${FIELD} bg-white`}
            >
              {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Is Active */}
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-700">Active account</p>
              <p className="text-xs text-slate-400 mt-0.5">User can log in immediately</p>
            </div>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Creating…' : 'Create User'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name:      user.name,
    email:     user.email,
    role:      user.role,
    is_active: !!user.is_active,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())         e.name  = 'Name is required';
    if (!form.email.trim())        e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await userAPI.update(user.id, {
        name:      form.name.trim(),
        email:     form.email.trim().toLowerCase(),
        role:      form.role,
        is_active: form.is_active ? 1 : 0,
      });
      toast.success('User updated');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-slate-900">Edit User</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full name <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className={`${FIELD} ${errors.name ? 'border-red-400 focus:ring-red-400' : ''}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email address <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              className={`${FIELD} ${errors.email ? 'border-red-400 focus:ring-red-400' : ''}`}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select
              value={form.role}
              onChange={e => set('role', e.target.value)}
              className={`${FIELD} bg-white`}
            >
              {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-700">Active account</p>
              <p className="text-xs text-slate-400 mt-0.5">Inactive users cannot log in</p>
            </div>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { hasRole } = useAuth();
  const isSuperAdmin = () => hasRole('super_admin');
  const qc = useQueryClient();

  const [search, setSearch]     = useState('');
  const [role, setRole]         = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const { data, isLoading } = useQuery(
    ['users', search, role],
    () => userAPI.list({ search: search || undefined, role: role || undefined }).then(r => r.data.data),
    { keepPreviousData: true }
  );

  const refresh = () => {
    qc.invalidateQueries(['users']);
    qc.invalidateQueries(['users-active']);
  };

  const handleCreated = () => { setShowCreate(false); refresh(); };
  const handleUpdated = () => { setEditUser(null);    refresh(); };

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-400 mt-0.5">{data?.length ?? 0} total</p>
        </div>
        {isSuperAdmin() && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex-shrink-0"
          >
            + Create User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2.5 flex-1 sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All roles</option>
          {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {isLoading && <div className="text-center py-16 text-slate-400 text-sm">Loading users…</div>}

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {data?.map(u => (
          <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                {u.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{u.name}</p>
                <p className="text-xs text-slate-400 truncate">{u.email}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {u.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2.5 py-1 rounded-full ${ROLE_COLOR[u.role] || 'bg-gray-100 text-gray-600'}`}>
                {u.role?.replace(/_/g, ' ')}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${(u.total_points ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(u.total_points ?? 0) >= 0 ? '+' : ''}{u.total_points ?? 0} pts
                </span>
                {isSuperAdmin() && (
                  <button
                    onClick={() => setEditUser(u)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {data?.length === 0 && (
          <p className="text-center py-8 text-slate-400 text-sm">No users found</p>
        )}
      </div>

      {/* Table for sm+ */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Points</th>
                <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                {isSuperAdmin() && <th className="px-4 sm:px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{u.name}</p>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-5 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${ROLE_COLOR[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className={`px-4 sm:px-5 py-3 text-right font-bold ${(u.total_points ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(u.total_points ?? 0) >= 0 ? '+' : ''}{u.total_points ?? 0}
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isSuperAdmin() && (
                    <td className="px-4 sm:px-5 py-3 text-right">
                      <button
                        onClick={() => setEditUser(u)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No users found</p>
        )}
      </div>

      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onSuccess={handleCreated} />
      )}
      {editUser && (
        <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSuccess={handleUpdated} />
      )}
    </div>
  );
}
