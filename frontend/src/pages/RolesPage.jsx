import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { roleAPI, userAPI } from '../utils/api';
import toast from 'react-hot-toast';

const ALL_MODULES = [
  { key: 'dashboard',   label: 'Dashboard' },
  { key: 'projects',    label: 'Projects' },
  { key: 'tickets',     label: 'Tickets' },
  { key: 'reports',     label: 'Reports' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'timeline',    label: 'My Timeline' },
];

const BASE_ROLES = [
  { value: 'super_admin',     label: 'Super Admin' },
  { value: 'admin',           label: 'Admin' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'team_lead',       label: 'Team Lead' },
  { value: 'developer',       label: 'Developer' },
  { value: 'qa',              label: 'QA' },
];

const FIELD = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const EMPTY_FORM = { name: '', description: '', base_role: 'developer' };

export default function RolesPage() {
  const qc = useQueryClient();

  const [showCreate, setShowCreate]   = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [editingRole, setEditingRole] = useState(null);
  const [editForm, setEditForm]       = useState({});

  // Assignment state
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoleId, setAssignRoleId] = useState('');

  // Module permissions state
  const [modulePanelRole, setModulePanelRole] = useState(null);
  const [modulesDraft, setModulesDraft]       = useState([]);
  const [restrictModules, setRestrictModules] = useState(false);

  const { data: roles = [], isLoading: rolesLoading } = useQuery(
    'custom-roles',
    () => roleAPI.list().then(r => r.data.data)
  );

  const { data: allUsers = [] } = useQuery(
    'users-active',
    () => userAPI.list({ is_active: 1 }).then(r => r.data.data),
    { staleTime: 5 * 60 * 1000 }
  );

  const refresh = () => {
    qc.invalidateQueries('custom-roles');
    qc.invalidateQueries('users-active');
    qc.invalidateQueries(['users']);
  };

  const createMut = useMutation(
    () => roleAPI.create(form),
    {
      onSuccess: () => {
        toast.success('Role created');
        setForm(EMPTY_FORM);
        setShowCreate(false);
        refresh();
      },
      onError: e => toast.error(e.response?.data?.message || 'Failed to create role'),
    }
  );

  const updateMut = useMutation(
    ({ id, data }) => roleAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success('Role updated');
        setEditingRole(null);
        refresh();
      },
      onError: e => toast.error(e.response?.data?.message || 'Failed to update role'),
    }
  );

  const deleteMut = useMutation(
    (id) => roleAPI.delete(id),
    {
      onSuccess: () => { toast.success('Role deleted'); refresh(); },
      onError:   e => toast.error(e.response?.data?.message || 'Failed to delete role'),
    }
  );

  const assignMut = useMutation(
    () => roleAPI.assign({ user_id: +assignUserId, role_id: assignRoleId ? +assignRoleId : null }),
    {
      onSuccess: () => {
        toast.success('Role assigned successfully');
        setAssignUserId('');
        setAssignRoleId('');
        refresh();
      },
      onError: e => toast.error(e.response?.data?.message || 'Failed to assign role'),
    }
  );

  const setModulesMut = useMutation(
    ({ id, modules }) => roleAPI.setModules(id, modules),
    {
      onSuccess: () => {
        toast.success('Module permissions updated');
        setModulePanelRole(null);
        refresh();
      },
      onError: e => toast.error(e.response?.data?.message || 'Failed to update permissions'),
    }
  );

  const openModulePanel = (role) => {
    setModulePanelRole(role.id);
    if (role.modules === null) {
      setRestrictModules(false);
      setModulesDraft(ALL_MODULES.map(m => m.key));
    } else {
      setRestrictModules(true);
      setModulesDraft(role.modules);
    }
  };

  const startEdit = (role) => {
    setEditingRole(role.id);
    setEditForm({ name: role.name, description: role.description || '', base_role: role.base_role });
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Role Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">Create custom roles and assign them to users</p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex-shrink-0"
          >
            + New Role
          </button>
        )}
      </div>

      {/* Create Role Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Create New Role</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role Name <span className="text-red-500">*</span></label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Senior Developer"
                className={FIELD}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Base Permission Role <span className="text-red-500">*</span></label>
              <select
                value={form.base_role}
                onChange={e => setForm(f => ({ ...f, base_role: e.target.value }))}
                className={`${FIELD} bg-white`}
              >
                {BASE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">Sets what the user can do in the system</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional — briefly describe this role"
                className={FIELD}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => createMut.mutate()}
              disabled={!form.name.trim() || createMut.isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {createMut.isLoading ? 'Creating…' : 'Create Role'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Roles List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-slate-700">Custom Roles ({roles.length})</p>
        </div>

        {rolesLoading ? (
          <p className="px-5 py-10 text-sm text-slate-400 text-center">Loading…</p>
        ) : roles.length === 0 ? (
          <p className="px-5 py-10 text-sm text-slate-400 text-center">No custom roles yet. Create one above.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {roles.map(role => (
              <div key={role.id} className="px-5 py-4">
                {editingRole === role.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                        <input
                          value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className={FIELD}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Base Permission Role</label>
                        <select
                          value={editForm.base_role}
                          onChange={e => setEditForm(f => ({ ...f, base_role: e.target.value }))}
                          className={`${FIELD} bg-white`}
                        >
                          {BASE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                        <input
                          value={editForm.description}
                          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                          className={FIELD}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateMut.mutate({ id: role.id, data: editForm })}
                        disabled={!editForm.name?.trim() || updateMut.isLoading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {updateMut.isLoading ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingRole(null)}
                        className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-800">{role.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">
                            {role.base_role?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-slate-400">{role.assigned_count} user{role.assigned_count !== 1 ? 's' : ''}</span>
                        </div>
                        {role.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{role.description}</p>
                        )}
                        {/* Module restriction summary */}
                        {role.modules !== null && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {role.modules.length === 0 ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">No module access</span>
                            ) : role.modules.map(m => (
                              <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                                {ALL_MODULES.find(x => x.key === m)?.label || m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => modulePanelRole === role.id ? setModulePanelRole(null) : openModulePanel(role)}
                          className="text-xs text-violet-600 hover:text-violet-800 font-medium px-2.5 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                        >
                          Modules
                        </button>
                        <button
                          onClick={() => startEdit(role)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete role "${role.name}"? Users with this role will lose it.`))
                              deleteMut.mutate(role.id);
                          }}
                          className="text-xs text-red-500 hover:text-red-700 font-medium px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Module permissions panel */}
                    {modulePanelRole === role.id && (
                      <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                        <p className="text-xs font-semibold text-slate-700">Module Access Permissions</p>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!restrictModules}
                            onChange={() => setRestrictModules(r => !r)}
                            className="rounded"
                          />
                          <span className="text-xs text-slate-700 font-medium">Allow access to all modules (no restriction)</span>
                        </label>
                        {restrictModules && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-1 pt-1">
                            {ALL_MODULES.map(m => (
                              <label key={m.key} className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={modulesDraft.includes(m.key)}
                                  onChange={e => setModulesDraft(prev =>
                                    e.target.checked ? [...prev, m.key] : prev.filter(x => x !== m.key)
                                  )}
                                  className="rounded"
                                />
                                <span className="text-xs text-slate-600">{m.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setModulesMut.mutate({ id: role.id, modules: restrictModules ? modulesDraft : null })}
                            disabled={setModulesMut.isLoading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {setModulesMut.isLoading ? 'Saving…' : 'Save Permissions'}
                          </button>
                          <button
                            onClick={() => setModulePanelRole(null)}
                            className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Role to User */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Assign Role to User</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Select User <span className="text-red-500">*</span></label>
            <select
              value={assignUserId}
              onChange={e => setAssignUserId(e.target.value)}
              className={`${FIELD} bg-white`}
            >
              <option value="">— Choose a user —</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role?.replace(/_/g, ' ')})
                  {u.custom_role_name ? ` · ${u.custom_role_name}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Assign Role</label>
            <select
              value={assignRoleId}
              onChange={e => setAssignRoleId(e.target.value)}
              className={`${FIELD} bg-white`}
            >
              <option value="">— Remove custom role —</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.base_role?.replace(/_/g, ' ')})</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Leave blank to remove any existing custom role</p>
          </div>
        </div>

        {/* Preview of selected user's current role */}
        {assignUserId && (
          <div className="mt-3 px-3 py-2 bg-gray-50 rounded-lg text-xs text-slate-500">
            {(() => {
              const u = allUsers.find(x => String(x.id) === String(assignUserId));
              return u ? `Current role: ${u.role?.replace(/_/g, ' ')}` : '';
            })()}
          </div>
        )}

        <button
          onClick={() => assignMut.mutate()}
          disabled={!assignUserId || assignMut.isLoading}
          className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          {assignMut.isLoading ? 'Assigning…' : 'Assign Role'}
        </button>
      </div>

      {/* Users with custom roles */}
      {allUsers.some(u => u.custom_role_id) && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-slate-700">Users with Custom Roles</p>
          </div>
          <div className="divide-y divide-gray-50">
            {allUsers.filter(u => u.custom_role_id).map(u => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {u.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{u.name}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-medium">
                    {roles.find(r => r.id === u.custom_role_id)?.name || 'Custom Role'}
                  </span>
                  <span className="text-xs text-slate-400 capitalize">{u.role?.replace(/_/g, ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
