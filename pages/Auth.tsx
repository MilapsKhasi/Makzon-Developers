
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, Lock, Loader2, ShieldCheck, RefreshCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import emailjs from '@emailjs/browser';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [userId, setUserId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(300); // 5 minutes in seconds
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  // Initialize EmailJS
  useEffect(() => {
    emailjs.init("R89O2UBELbx1ZXQt_");
  }, []);

  // Timer logic for OTP expiration
  useEffect(() => {
    let interval: any;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateAndStoreOtp = async (uId: string) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000).toISOString(); // 5 minutes from now

    const { error: otpError } = await supabase
      .from('login_verifications')
      .insert([
        { 
          user_id: uId, 
          otp: otp, 
          expires_at: expiresAt 
        }
      ]);

    if (otpError) throw otpError;
    
    // Trigger EmailJS notification
    try {
      await emailjs.send(
        "service_l4zqli2",
        "template_h6x2yee",
        {
          to_email: email,
          otp_code: otp,
        },
        "R89O2UBELbx1ZXQt_"
      );
      console.log(`[AUTH] OTP Email successfully triggered for ${email}`);
    } catch (mailErr: any) {
      console.error("[AUTH] EmailJS failure:", mailErr);
      // We still log to console as a fallback for the user if email fails
      console.log(`[FALLBACK] Verification Code: ${otp}`);
    }

    return otp;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
        
        if (data.user) {
          setUserId(data.user.id);
          await generateAndStoreOtp(data.user.id);
          setStep('otp');
          setTimer(300);
        }
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        alert('Check your email for the confirmation link!');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpValue];
    newOtp[index] = value;
    setOtpValue(newOtp);

    // Auto-focus next
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpValue[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async () => {
    const fullOtp = otpValue.join('');
    if (fullOtp.length < 6) return;

    setLoading(true);
    setError(null);

    try {
      if (!userId) throw new Error("Session expired. Please login again.");

      const { data, error: verifyError } = await supabase
        .from('login_verifications')
        .select('*')
        .eq('user_id', userId)
        .eq('otp', fullOtp)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (verifyError) throw verifyError;

      if (data && data.length > 0) {
        // Success
        localStorage.setItem('is_verified', 'true');
        localStorage.setItem('verified_user_id', userId);
        navigate('/companies');
      } else {
        throw new Error("Invalid or Expired Code");
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-8 h-8 text-slate-900" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">2-Step Verification</h1>
            <p className="text-slate-500 text-sm">
              A verification code has been sent to <span className="font-semibold text-slate-900">{email}</span>. Please enter it to continue.
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex justify-between gap-3">
              {otpValue.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-full h-14 text-center text-2xl font-bold bg-slate-50 border border-slate-200 rounded-lg focus:border-slate-900 focus:bg-white outline-none transition-all"
                />
              ))}
            </div>

            {error && (
              <div className="text-center text-rose-600 text-xs font-semibold animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={verifyOtp}
                disabled={loading || otpValue.join('').length < 6 || timer === 0}
                className="w-full py-4 bg-slate-900 text-white rounded-lg font-bold text-sm tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : 'VERIFY & CONTINUE'}
              </button>

              <div className="flex flex-col items-center space-y-2">
                <div className="text-xs font-medium text-slate-400">
                  {timer > 0 ? (
                    <>Code expires in <span className="text-slate-900 font-bold">{formatTime(timer)}</span></>
                  ) : (
                    <span className="text-rose-500">Code expired</span>
                  )}
                </div>
                <button
                  onClick={() => userId && generateAndStoreOtp(userId).then(() => { setTimer(300); setOtpValue(['','','','','','']); setError(null); })}
                  className="text-xs font-bold text-link hover:underline uppercase"
                >
                  Resend Code
                </button>
              </div>
            </div>
            
            <button 
              onClick={() => setStep('login')}
              className="w-full text-center text-xs text-slate-400 font-medium hover:text-slate-600"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9f9] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-[#ffea79] rounded-[10px] p-2 animate-in zoom-in-95 duration-700 border border-slate-200/20 shadow-none">
        <div className="text-center py-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
        </div>

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
