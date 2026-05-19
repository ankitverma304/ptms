import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header banner */}
          <div className="bg-blue-600 px-8 pt-8 pb-10 text-center">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3 backdrop-blur-sm">
              P
            </div>
            <h1 className="text-xl font-bold text-white">Sign in to PTMS</h1>
            <p className="text-blue-100 text-sm mt-1">Project & Ticket Management</p>
          </div>

          {/* Form */}
          <div className="px-6 sm:px-8 py-6 -mt-4">
            <div className="bg-white rounded-xl shadow-sm p-1">
              <form onSubmit={handleSubmit} className="space-y-4 p-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                  <input
                    type="email" required autoComplete="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="you@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'} required autoComplete="current-password"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors">
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors shadow-sm">
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </div>
          </div>

          {/* Demo accounts */}
          <div className="px-6 sm:px-8 pb-6">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Demo Accounts</p>
              <p className="text-xs text-slate-500 mb-1">Password: <span className="font-mono font-medium text-slate-700">Admin@1234</span></p>
              <div className="space-y-1 mt-2">
                {[
                  { email: 'superadmin@ptms.dev', role: 'Super Admin' },
                  { email: 'admin@ptms.dev',      role: 'Admin' },
                  { email: 'alice@ptms.dev',      role: 'PM' },
                  { email: 'dev1@ptms.dev',        role: 'Developer' },
                ].map(a => (
                  <button key={a.email} type="button"
                    onClick={() => setForm({ email: a.email, password: 'Admin@1234' })}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white text-left transition-colors group border border-transparent hover:border-slate-200">
                    <span className="text-xs text-slate-600 font-mono group-hover:text-slate-900">{a.email}</span>
                    <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{a.role}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
