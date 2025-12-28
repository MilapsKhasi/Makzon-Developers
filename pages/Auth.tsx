
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      }
      navigate('/companies');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9f9] flex items-center justify-center p-6 font-sans">
      {/* Outer Primary Yellow Card Container - Removed shadow-xl */}
      <div className="w-full max-w-sm bg-[#ffea79] rounded-[10px] p-2 animate-in zoom-in-95 duration-700 border border-slate-200/20 shadow-none">
        
        {/* Welcome Text Header Area */}
        <div className="text-center py-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
        </div>

        {/* Inner White Form Container */}
        <div className="bg-white rounded-[10px] p-6 pb-10 shadow-none">
          <form onSubmit={handleAuth} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-[10px] font-semibold animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-900 ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f9f9f9] border border-slate-200 rounded-[10px] outline-none focus:border-slate-400 font-medium text-slate-900 transition-all placeholder:text-slate-300 text-sm shadow-none"
                  placeholder="Your Email Address"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-900 ml-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f9f9f9] border border-slate-200 rounded-[10px] outline-none focus:border-slate-400 font-medium text-slate-900 transition-all placeholder:text-slate-300 text-sm shadow-none"
                  placeholder="Your Password"
                />
              </div>
            </div>

            <div className="pt-2 space-y-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-[10px] font-bold bg-[#ffea79] text-slate-900 hover:bg-[#f0db69] transition-all flex items-center justify-center disabled:opacity-50 text-xs tracking-[0.15em] border border-transparent active:scale-[0.98] shadow-none"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : 'GET STARTED'} 
              </button>

              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="w-full text-center text-[10px] text-slate-400 font-medium"
              >
                {isLogin ? (
                  <>Don't have an account? <span className="text-[#38b6ff] font-bold uppercase ml-1">SIGN UP</span></>
                ) : (
                  <>Already have an account? <span className="text-[#38b6ff] font-bold uppercase ml-1">LOGIN</span></>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
