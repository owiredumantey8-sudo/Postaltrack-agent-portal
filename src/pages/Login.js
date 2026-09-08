import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
      document.head.appendChild(meta);
    }
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setMessage('❌ Please enter your email and password.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch("https://postaltrack-backend-production.up.railway.app/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.role !== "courier_agent") {
        setMessage("⛔ Access denied! This portal is for agents only.");
        setLoading(false);
        return;
      }

      if (data.token) {
        localStorage.setItem("agentToken", data.token);
        localStorage.setItem("agentRole", data.role);
        localStorage.setItem("agentId", data.agent_id || "");
        localStorage.setItem("agentName", data.name || "Agent");
        navigate("/dashboard");
      } else {
        setMessage('❌ ' + (data.error || data.message || "Login failed."));
      }
    } catch (err) {
      setMessage("❌ Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100dvh', 
      overflow: 'hidden', 
      background: '#f9fafb', 
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "-apple-system, 'Segoe UI', sans-serif" 
    }}>
      
      {/* TOP SECTION: WHITE */}
      <div style={{
        flex: 1,
        background: '#ffffff', 
        borderBottomLeftRadius: '32px', 
        borderBottomRightRadius: '32px', 
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)', 
        padding: '40px 28px 24px', 
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}>
        
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(0,0,0,0.015)' }} />
        <div style={{ position: 'absolute', bottom: '60px', left: '-50px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(0,0,0,0.015)' }} />
        <div style={{ position: 'absolute', top: '40%', right: '10%', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0,0,0,0.01)' }} />

        <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto', position: 'relative', zIndex: 2 }}>

          <h2 style={{ color: '#111827', fontSize: '1.5rem', fontWeight: '800', margin: '0 0 6px 0' }}>
            Welcome Back 👋
          </h2>
          
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 4px 0', lineHeight: '1.4' }}>
            Enter the credentials provided by your admin to login.
          </p>

          <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 28px 0', fontStyle: 'italic' }}>
            "Navigate routes, update statuses, and complete deliveries."
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#374151', fontSize: '0.7rem', fontWeight: '700', marginBottom: '6px', display: 'block', letterSpacing: '0.5px' }}>
              AGENT EMAIL
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="agent@postal.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%', padding: '14px 16px', 
                background: '#f9fafb', border: '2px solid #e5e7eb',
                borderRadius: '12px', color: '#111827', fontSize: '16px', 
                outline: 'none', boxSizing: 'border-box',
                transition: 'all 0.2s'
              }}
              onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#374151', fontSize: '0.7rem', fontWeight: '700', marginBottom: '6px', display: 'block', letterSpacing: '0.5px' }}>
              PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{
                  width: '100%', padding: '14px 16px', paddingRight: '65px',
                  background: '#f9fafb', border: '2px solid #e5e7eb',
                  borderRadius: '12px', color: '#111827', fontSize: '16px',
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'all 0.2s'
                }}
                onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#10b981',
                  fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', letterSpacing: '0.5px'
                }}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '15px',
              background: loading ? '#a7f3d0' : '#065f46',
              color: 'white', border: 'none', borderRadius: '12px',
              fontSize: '0.95rem', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(6, 95, 70, 0.25)',
              marginBottom: '12px'
            }}
          >
            {loading ? '⏳ Signing in...' : '🚚 Login to Dashboard'}
          </button>

          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.7rem' }}>
            © 2024 PostalTrack · All rights reserved.
          </div>

          {message && (
            <div style={{
              padding: '10px', borderRadius: '10px', marginTop: '10px',
              background: message.includes('❌') || message.includes('⛔') ? '#fef2f2' : '#ecfdf5',
              border: '1px solid ' + (message.includes('❌') || message.includes('⛔') ? '#fecaca' : '#a7f3d0'),
              color: message.includes('❌') || message.includes('⛔') ? '#b91c1c' : '#065f46',
              fontSize: '0.8rem', fontWeight: '600', textAlign: 'center',
            }}>
              {message}
            </div>
          )}

        </div>
      </div>

      {/* BOTTOM SECTION: SLIM GREEN BAR */}
      <div style={{
        background: 'linear-gradient(180deg, #065f46 0%, #1b4332 100%)',
        padding: '14px 20px 28px', 
        textAlign: 'center',
        flexShrink: 0,
        zIndex: 1,
        borderTopLeftRadius: '32px', 
        borderTopRightRadius: '32px', 
        borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px' 
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, 
          background: 'rgba(255,255,255,0.1)', 
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem', flexShrink: 0
        }}>
          🚚
        </div>
        <div style={{ textAlign: 'left' }}>
          <h1 style={{ color: 'white', fontSize: '0.9rem', fontWeight: '800', margin: '0', lineHeight: '1.2' }}>
            Postal<span style={{ color: '#6ee7b7' }}>Track</span>
          </h1>
          <span style={{ color: '#d1fae5', fontSize: '0.5rem', fontWeight: '700', letterSpacing: '1.5px' }}>
            AGENT PORTAL
          </span>
        </div>
      </div>

    </div>
  );
}

export default Login;