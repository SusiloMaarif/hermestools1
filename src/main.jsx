import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Bot, Cable, CheckCircle2, ChevronDown, Clipboard, CreditCard, Home, Mail, MessageCircle, MoreHorizontal, Play, RefreshCcw, Send, Settings, ShieldCheck, Sparkles, Video, Zap, Trash2, Eye, Copy, X, Plus, Loader2 } from 'lucide-react';
import './styles.css';

const DEFAULT_BASE_URL = 'https://router.susilo.my.id/v1';
const ADMIN_BASE_URL = '/api/admin';
const TEMP_MAIL_BASE = 'https://api.mail.tm';

// Pricing per 1M tokens (input, output) — null = free
const PRICING = {
  // OpenAI
  'gpt-4o-mini': [0.15, 0.60], 'gpt-4o': [2.50, 10.00], 'gpt-4o-2024-05-13': [2.50, 10.00],
  'gpt-4-turbo': [10.00, 30.00], 'gpt-3.5-turbo': [0.50, 1.50],
  // Anthropic
  'claude-3-5-haiku-20241022': [0.80, 4.00], 'claude-3-5-sonnet-20241022': [3.00, 15.00],
  'claude-3-5-sonnet-4-20250514': [3.00, 15.00], 'claude-3-opus-20240229': [15.00, 75.00],
  'claude-3-sonnet-20240229': [3.00, 15.00], 'claude-3-haiku-20240307': [0.80, 4.00],
  'claude_haiku_3_5': [0.80, 4.00], 'claude_sonnet_4': [3.00, 15.00], 'claude_opus_4': [15.00, 75.00],
  // Google
  'gemini-1.5-flash': [0.075, 0.30], 'gemini-1.5-pro': [1.25, 5.00], 'gemini-2.0-flash-exp': [0.00, 0.00],
  'gemini-3-flash': [0.075, 0.30], 'gemini-3-pro': [1.25, 5.00],
  'gemini-3_flash': [0.075, 0.30], 'gemini-3_pro': [1.25, 5.00],
  // DeepSeek
  'deepseek-chat': [0.14, 0.28], 'deepseek-coder': [0.14, 0.28], 'deepseek-v4': [0.27, 1.10],
  'deepseek_v4': [0.27, 1.10], 'deepseek-v4-flash-free': null,
  // MiniMax
  'minimax-m2.7': [0.10, 0.50], 'minimax-m2.5': [0.10, 0.50], 'minimax-m3': [0.08, 0.40],
  'minimax-m2.7': [0.10, 0.50], 'minimax-m3-free': null,
  // OpenCode free models
  'big-pickle': null, 'deepseek-v4-flash-free': null, 'minimax-m3-free': null,
  'minimax-m2.5-free': null, 'ling-2.6-1t-free': null, 'trinity-large-preview-free': null,
  'nemotron-3-super-free': null, 'qwen3.6-plus-free': null,
  // Local/Combo
  'hermes': null, 'mimo': null, 'kiro': null, 'kimi-k2.5': [0.12, 0.60], 'kimi-k2.6': [0.12, 0.60],
  // VEO
  'veo': null, 'seedance': null,
  // Legacy providers
  'tllm/gpt-4o': [2.50, 10.00], 'tllm/gpt_5_4': [2.50, 10.00], 'tllm/gpt_4o': [2.50, 10.00],
  'tllm/claude_opus_4': [15.00, 75.00], 'tllm/claude_sonnet_4': [3.00, 15.00], 'tllm/claude_haiku_3_5': [0.80, 4.00],
  'tllm/deepseek_v4': [0.27, 1.10], 'tllm/gemini_3_flash': [0.075, 0.30], 'tllm/gemini_3_pro': [1.25, 5.00],
  'ddgw/gpt-4o-mini': [0.15, 0.60], 'ddgw/gpt-5-mini': [0.15, 0.60],
  'ddgw/claude-3-5-haiku-20241022': [0.80, 4.00],
  'duckduckgo-web/gpt-4o-mini': [0.15, 0.60], 'duckduckgo-web/claude-3-5-haiku-20241022': [0.80, 4.00],
  'ddgw/llama-4-scout': [0.20, 0.80], 'ddgw/mistral-small-2501': [0.20, 0.80], 'ddgw/o3-mini': [0.20, 0.80],
};

function calcCost(modelId, usage) {
  const prompt_tokens = usage?.prompt_tokens || 0;
  const completion_tokens = usage?.completion_tokens || 0;
  const total_tokens = usage?.total_tokens || prompt_tokens + completion_tokens;
  // Find pricing — try full ID first, then strip provider prefix
  let price = PRICING[modelId];
  if (!price) {
    const short = modelId.split('/').pop();
    price = PRICING[short] || PRICING[short.replace(/-/g, '_')] || null;
  }
  if (!price) return { cost: 0, isFree: true, prompt_tokens, completion_tokens, total_tokens };
  const [inP, outP] = price;
  const cost = (prompt_tokens * inP + completion_tokens * outP) / 1_000_000;
  return { cost, isFree: false, prompt_tokens, completion_tokens, total_tokens };
}

function getSaved(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function setSaved(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
function cleanCardNumber(value) {
  return String(value || '').replace(/\D/g, '');
}
function luhnCheck(number) {
  const digits = cleanCardNumber(number);
  if (digits.length < 8) return false;
  let sum = 0;
  let doubleIt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (doubleIt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    doubleIt = !doubleIt;
  }
  return sum % 10 === 0;
}
function luhnCheckDigit(prefix) {
  const digits = cleanCardNumber(prefix);
  let sum = 0;
  let doubleIt = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (doubleIt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    doubleIt = !doubleIt;
  }
  return String((10 - (sum % 10)) % 10);
}
function generateLuhn(prefix = '4', length = 16) {
  let body = cleanCardNumber(prefix).slice(0, Math.max(1, length - 1));
  while (body.length < length - 1) body += Math.floor(Math.random() * 10);
  return body + luhnCheckDigit(body);
}
function formatCard(num) {
  return cleanCardNumber(num).replace(/(.{4})/g, '$1 ').trim();
}
function brandOf(num) {
  const n = cleanCardNumber(num);
  if (/^4/.test(n)) return 'Visa';
  if (/^5[1-5]/.test(n) || /^2(2[2-9]|[3-6]|7[01]|720)/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^6(?:011|5|4[4-9])/.test(n)) return 'Discover';
  if (/^3[68]/.test(n)) return 'DinersClub';
  if (/^(?:2131|1800|35)/.test(n)) return 'JCB';
  return 'Unknown';
}

// ==================== CC TOOLS UPGRADED ====================
function CCTools() {
  const [card, setCard] = useState('');
  const [prefix, setPrefix] = useState('4');
  const [length, setLength] = useState(16);
  const [generated, setGenerated] = useState([]);
  const [bulkCount, setBulkCount] = useState(5);
  const [binInfo, setBinInfo] = useState(null);
  const [binLoading, setBinLoading] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [copied, setCopied] = useState('');
  const [randomExpiry, setRandomExpiry] = useState(false);
  const [randomCvv, setRandomCvv] = useState(false);

  function randExpiry() {
    const mm = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const yy = String(Math.floor(Math.random() * 8) + 26);
    return `${mm}/${yy}`;
  }
  function randCvv(len = 3) {
    return String(Math.floor(Math.random() * Math.pow(10, len))).padStart(len, '0');
  }

  const cleanCard = cleanCardNumber(card);
  const valid = luhnCheck(cleanCard);
  const isComplete = cleanCard.length >= 13 && cleanCard.length <= 19;

  // Expiry validation
  const expiryValid = (() => {
    if (!expiry || expiry.length < 5) return null;
    const [mm, yy] = expiry.split('/');
    const month = parseInt(mm);
    const year = parseInt('20' + yy);
    const now = new Date();
    const exp = new Date(year, month);
    return month >= 1 && month <= 12 && year >= now.getFullYear();
  })();

  // CVV validation
  const cvvValid = cvv.length >= 3 && cvv.length <= 4 && /^\d+$/.test(cvv);

  // BIN lookup
  async function lookupBIN(bin) {
    if (bin.length < 6) { setBinInfo(null); return; }
    setBinLoading(true);
    try {
      const res = await fetch(`https://api.freebinchecker.com/bin/${bin}`);
      if (res.ok) {
        const data = await res.json();
        setBinInfo(data);
      } else {
        // Fallback: try alternative
        const alt = await fetch(`https://lookup.binlist.net/${bin}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (alt.ok) {
          const altData = await alt.json();
          setBinInfo({
            bank: { name: altData.bank?.name || 'Unknown', url: altData.bank?.url || '' },
            country: { name: altData.country?.name || 'Unknown', alpha2: altData.country?.alpha2 || '' },
            brand: altData.scheme?.toUpperCase() || brandOf(bin),
            type: altData.type || 'Unknown',
            prepaid: altData.prepaid ? 'Yes' : 'No'
          });
        } else {
          setBinInfo(null);
        }
      }
    } catch {
      setBinInfo(null);
    } finally {
      setBinLoading(false);
    }
  }

  useEffect(() => {
    if (cleanCard.length >= 6) {
      lookupBIN(cleanCard.slice(0, 6));
    } else {
      setBinInfo(null);
    }
  }, [cleanCard]);

  function handleCardChange(e) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 19);
    setCard(v);
    const raw = v.replace(/\D/g, '');
    if (raw.length >= 6) setPrefix(raw.slice(0, 6));
  }

  function handleExpiryChange(e) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
    setExpiry(v);
  }

  function handleCvvChange(e) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCvv(v);
  }

  async function copyToClipboard(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {}
  }

  function generateBulk() {
    const results = [];
    for (let i = 0; i < bulkCount; i++) {
      const cardNum = generateLuhn(prefix, length);
      const exp = randomExpiry ? randExpiry() : expiry;
      const cv = randomCvv ? randCvv(3) : cvv;
      results.push({ card: cardNum, expiry: exp, cvv: cv });
    }
    setGenerated(results);
  }

  return (
    <section>
      <div className="title">
        <h2>CC Tools 💳</h2>
        <span className="pill safe">Luhn + BIN Lookup</span>
      </div>

      {/* BIN Info Card */}
      {binLoading && <div className="card"><div className="notice">🔍 Lookup BIN...</div></div>}
      {binInfo && (
        <div className="card bin-card">
          <div className="bin-header">
            <span className="bin-brand">{binInfo.brand || binInfo.scheme || brandOf(cleanCard)}</span>
            <span className={`bin-type ${(binInfo.type || 'credit').toLowerCase()}`}>
              {binInfo.type || binInfo.card_type || 'Credit'}
            </span>
          </div>
          <div className="bin-details">
            <div className="bin-item">
              <span className="bin-label">Bank</span>
              <span className="bin-value">{binInfo.bank?.name || binInfo.bank_name || 'N/A'}</span>
            </div>
            <div className="bin-item">
              <span className="bin-label">Country</span>
              <span className="bin-value">
                {binInfo.country?.alpha2 && <span className="flag">{getFlag(binInfo.country.alpha2)}</span>}
                {' '}{binInfo.country?.name || binInfo.country_name || 'N/A'}
              </span>
            </div>
            <div className="bin-item">
              <span className="bin-label">Category</span>
              <span className="bin-value">{binInfo.category || 'N/A'}</span>
            </div>
            <div className="bin-item">
              <span className="bin-label">Prepaid</span>
              <span className="bin-value">{binInfo.prepaid || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Card Number */}
      <div className="card">
        <label>Card Number</label>
        <input
          value={card}
          onChange={handleCardChange}
          placeholder="4111 1111 1111 1111"
          className="mono-input"
        />
        <div className={`notice ${!cleanCard ? '' : valid ? 'online' : 'offline'}`}>
          {isComplete ? (
            <>
              {valid ? (
                <><CheckCircle2 size={14}/> Luhn Valid</>
              ) : (
                <><X size={14}/> Luhn Invalid</>
              )}
              {' • '}{brandOf(card)}
              {' • '}{cleanCard.length} digits
            </>
          ) : (
            <>Masukkan nomor kartu ({cleanCard.length}/16 digits)</>
          )}
        </div>
      </div>

      {/* Expiry + CVV Row */}
      <div className="card">
        <div className="expiry-row">
          <div className="expiry-field">
            <label>Expiry (MM/YY)</label>
            <input
              value={expiry}
              onChange={handleExpiryChange}
              placeholder="12/28"
              className="mono-input"
              disabled={randomExpiry}
            />
            {expiry.length >= 5 && !randomExpiry && (
              <div className={`notice ${expiryValid ? 'online' : 'offline'}`}>
                {expiryValid ? <><CheckCircle2 size={14}/> Valid</> : <><X size={14}/> Invalid</>}
              </div>
            )}
          </div>
          <div className="cvv-field">
            <label>CVV</label>
            <input
              value={cvv}
              onChange={handleCvvChange}
              placeholder="123"
              className="mono-input"
              type="password"
              disabled={randomCvv}
            />
            {cvv.length >= 3 && !randomCvv && (
              <div className={`notice ${cvvValid ? 'online' : 'offline'}`}>
                {cvvValid ? <><CheckCircle2 size={14}/> Valid</> : <><X size={14}/> Invalid</>}
              </div>
            )}
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:10,flexWrap:'wrap'}}>
          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',margin:0,color:'#9aa8ca',fontSize:12}}>
            <input type="checkbox" checked={randomExpiry} onChange={e=>setRandomExpiry(e.target.checked)} style={{accentColor:'#2667ff'}}/>
            Random Expiry
          </label>
          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',margin:0,color:'#9aa8ca',fontSize:12}}>
            <input type="checkbox" checked={randomCvv} onChange={e=>setRandomCvv(e.target.checked)} style={{accentColor:'#2667ff'}}/>
            Random CVV
          </label>
        </div>
      </div>

      {/* Generate */}
      <div className="card">
        <label>Generate Test Number</label>
        <div className="gen-row">
          <input
            value={prefix}
            onChange={e => setPrefix(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="BIN (e.g. 411111)"
            className="mono-input"
          />
          <select value={length} onChange={e => setLength(Number(e.target.value))}>
            <option value={13}>13 digits</option>
            <option value={14}>14 digits</option>
            <option value={15}>15 digits</option>
            <option value={16}>16 digits</option>
            <option value={19}>19 digits</option>
          </select>
        </div>
        <div className="gen-bulk">
          <button className="wide" onClick={generateBulk}>
            <Sparkles size={15}/> Generate {bulkCount}x
          </button>
          <select value={bulkCount} onChange={e => setBulkCount(Number(e.target.value))}>
            {[1,3,5,10,20].map(n => <option key={n} value={n}>{n}x</option>)}
          </select>
        </div>

        {generated.length > 0 && (
          <div className="generated-list">
            {generated.map((n, i) => (
              <div key={i} className="generated-item">
                <span className="mono-input">{formatCard(n.card)}</span>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(n.card, `gen-${i}`)}
                >
                  {copied === `gen-${i}` ? <CheckCircle2 size={14}/> : <Copy size={14}/>}
                </button>
                {n.expiry && <span className="gen-expiry">{n.expiry}</span>}
                {n.cvv && <span className="gen-cvv">{n.cvv}</span>}
              </div>
            ))}
            <button className="wide copy-all" onClick={() => copyToClipboard(generated.map(n => `${formatCard(n.card)}|${n.expiry}|${n.cvv}`).join('\n'), 'all')}>
              <Clipboard size={14}/> {copied === 'all' ? 'Copied!' : 'Copy All (card|expiry|cvv)'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ==================== TEMP MAIL UPGRADED ====================
function TempMail() {
  const [accounts, setAccounts] = useState([]);
  const [activeAccount, setActiveAccount] = useState(null);
  const [token, setToken] = useState('');
  const [inbox, setInbox] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailBody, setEmailBody] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh
  useEffect(() => {
    if (!activeAccount || !token || !autoRefresh) return;
    refreshInbox();
    const interval = setInterval(refreshInbox, 10000);
    return () => clearInterval(interval);
  }, [activeAccount, token, autoRefresh]);

  async function createMail() {
    setLoading(true);
    setMsg('');
    try {
      const domainsRes = await fetch(`${TEMP_MAIL_BASE}/domains`);
      const domainsData = await domainsRes.json();
      const domain = domainsData['hydra:member']?.[0]?.domain;
      if (!domain) throw new Error('No domain available');

      const address = `hermes${Math.random().toString(36).slice(2, 10)}@${domain}`;
      const password = Math.random().toString(36).slice(2) + 'A1!';

      await fetch(`${TEMP_MAIL_BASE}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });

      const tkRes = await fetch(`${TEMP_MAIL_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });
      const tkData = await tkRes.json();
      const newToken = tkData.token;

      const newAccount = { address, password, id: Date.now() };
      setAccounts(prev => [newAccount, ...prev]);
      setActiveAccount(newAccount);
      setToken(newToken);
      setInbox([]);
      setMsg('✅ Email dibuat!');
    } catch (e) {
      setMsg('❌ Gagal: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshInbox() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${TEMP_MAIL_BASE}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setInbox(data['hydra:member'] || []);
    } catch (e) {
      // silent fail on auto-refresh
    } finally {
      setLoading(false);
    }
  }

  async function readEmail(id) {
    setLoading(true);
    try {
      const res = await fetch(`${TEMP_MAIL_BASE}/messages/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setEmailBody(data);
      setSelectedEmail(id);
    } catch (e) {
      setMsg('❌ Gagal baca email: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteEmail(id) {
    if (!confirm('Hapus email ini?')) return;
    try {
      await fetch(`${TEMP_MAIL_BASE}/messages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setInbox(prev => prev.filter(e => e.id !== id));
      if (selectedEmail === id) { setSelectedEmail(null); setEmailBody(null); }
      setMsg('🗑️ Email dihapus');
    } catch (e) {
      setMsg('❌ Gagal hapus: ' + e.message);
    }
  }

  async function deleteAccount(acc) {
    if (!confirm(`Hapus ${acc.address}?`)) return;
    setAccounts(prev => prev.filter(a => a.id !== acc.id));
    if (activeAccount?.id === acc.id) {
      setActiveAccount(null);
      setToken('');
      setInbox([]);
      setSelectedEmail(null);
      setEmailBody(null);
    }
  }

  async function copyToClipboard(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {}
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function getPreview(body) {
    if (!body) return '';
    const text = body.replace(/<[^>]+>/g, '').replace(/\n/g, ' ').trim();
    return text.slice(0, 100) + (text.length > 100 ? '...' : '');
  }

  return (
    <section>
      <div className="title">
        <h2>Temp Mail 📧</h2>
        <button className="icon-btn" onClick={() => setAutoRefresh(prev => !prev)} title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}>
          <RefreshCcw size={16} className={autoRefresh ? 'spinning' : ''}/>
        </button>
      </div>

      {/* Account selector */}
      {accounts.length > 0 && (
        <div className="card">
          <div className="account-tabs">
            {accounts.map(acc => (
              <button
                key={acc.id}
                className={`account-tab ${activeAccount?.id === acc.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveAccount(acc);
                  // Need to re-auth - for simplicity, just refresh
                  refreshInbox();
                }}
              >
                <span className="acc-address">{acc.address.split('@')[0]}</span>
                <span
                  className="acc-delete"
                  onClick={e => { e.stopPropagation(); deleteAccount(acc); }}
                >
                  <X size={12}/>
                </span>
              </button>
            ))}
            <button className="account-tab add" onClick={createMail}>
              <Plus size={14}/>
            </button>
          </div>
          {activeAccount && (
            <div className="email-address-row">
              <span className="email-display mono-input">{activeAccount.address}</span>
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(activeAccount.address, 'email')}
              >
                {copied === 'email' ? <CheckCircle2 size={14}/> : <Copy size={14}/>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create button */}
      <div className="card">
        <button className="wide create-btn" onClick={createMail} disabled={loading}>
          {loading ? <Loader2 size={16} className="spinning"/> : <Plus size={16}/>}
          Generate Email Baru
        </button>
        {msg && <div className="notice">{msg}</div>}
      </div>

      {/* Email list / body */}
      {activeAccount && (
        <div className="card email-layout">
          <div className="email-list-panel">
            <div className="email-list-header">
              <span>Inbox ({inbox.length})</span>
              <button className="icon-btn" onClick={refreshInbox} disabled={loading}>
                <RefreshCcw size={14} className={loading ? 'spinning' : ''}/>
              </button>
            </div>
            {inbox.length === 0 ? (
              <div className="empty-inbox">
                {loading ? 'Memuat...' : '📭 Inbox kosong'}
              </div>
            ) : (
              inbox.map(email => (
                <div
                  key={email.id}
                  className={`email-item ${selectedEmail === email.id ? 'active' : ''}`}
                  onClick={() => readEmail(email.id)}
                >
                  <div className="email-item-header">
                    <span className="email-from">{email.from?.address || 'Unknown'}</span>
                    <span className="email-time">{formatTime(email.createdAt)}</span>
                  </div>
                  <div className="email-subject">{email.subject || '(no subject)'}</div>
                  <div className="email-preview">{getPreview(email.body?.text || email.body?.html)}</div>
                </div>
              ))
            )}
          </div>

          {selectedEmail && emailBody && (
            <div className="email-body-panel">
              <div className="email-body-header">
                <button className="icon-btn" onClick={() => { setSelectedEmail(null); setEmailBody(null); }}>
                  <X size={16}/>
                </button>
                <button
                  className="icon-btn delete"
                  onClick={() => deleteEmail(selectedEmail)}
                >
                  <Trash2 size={16}/>
                </button>
              </div>
              <div className="email-meta">
                <div><b>From:</b> {emailBody.from?.address}</div>
                <div><b>Subject:</b> {emailBody.subject}</div>
                <div><b>Time:</b> {formatTime(emailBody.createdAt)}</div>
              </div>
              <div className="email-content">
                {emailBody.body?.text || emailBody.body?.html?.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim() || 'No content'}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ==================== FLAG EMOJI HELPER ====================
function getFlag(countryCode) {
  const flags = {
    'US': '🇺🇸', 'GB': '🇬🇧', 'ID': '🇮🇩', 'MY': '🇲🇾', 'SG': '🇸🇬',
    'TH': '🇹🇭', 'VN': '🇻🇳', 'PH': '🇵🇭', 'CN': '🇨🇳', 'JP': '🇯🇵',
    'KR': '🇰🇷', 'IN': '🇮🇳', 'AU': '🇦🇺', 'NZ': '🇳🇿', 'DE': '🇩🇪',
    'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'NL': '🇳🇱', 'BR': '🇧🇷',
    'MX': '🇲🇽', 'AR': '🇦🇷', 'RU': '🇷🇺', 'TR': '🇹🇷', 'SA': '🇸🇦',
    'AE': '🇦🇪', 'EG': '🇪🇬', 'NG': '🇳🇬', 'KE': '🇰🇪', 'ZA': '🇿🇦',
    'CA': '🇨🇦', 'CO': '🇨🇴', 'CL': '🇨🇱', 'PE': '🇵🇪', 'PL': '🇵🇱',
    'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'PT': '🇵🇹',
    'GR': '🇬🇷', 'CZ': '🇨🇿', 'HU': '🇭🇺', 'RO': '🇷🇴', 'UA': '🇺🇦',
    'KZ': '🇰🇿', 'TW': '🇹🇼', 'HK': '🇭🇰', 'PK': '🇵🇰', 'BD': '🇧🇩',
  };
  return flags[countryCode.toUpperCase()] || countryCode;
}

// ==================== APP / DASHBOARD (UNCHANGED) ====================
function App() {
  const tg = window.Telegram?.WebApp;
  const [page, setPage] = useState('dashboard');
  const [baseUrl, setBaseUrl] = useState(getSaved('omni_base_url', DEFAULT_BASE_URL));
  const [apiKey, setApiKey] = useState(getSaved('omni_api_key', ''));
  const [apiKeys, setApiKeys] = useState(() => JSON.parse(getSaved('omni_api_keys', '[]')));
  const [currentKeyIndex, setCurrentKeyIndex] = useState(() => Number(getSaved('omni_current_key_index', '0')));
  const [bulkInput, setBulkInput] = useState('');
  const [models, setModels] = useState([]);
  const [status, setStatus] = useState('checking');
  const [selectedModel, setSelectedModel] = useState(getSaved('omni_model', 'hermes'));
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Halo, saya siap via OmniRoute. Pilih model lalu kirim prompt.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState(() => JSON.parse(getSaved('omni_usage', '{"requests":0,"tokens":0,"errors":0,"cost":0}')));
  const [lastCost, setLastCost] = useState(null);
  const [importedModels, setImportedModels] = useState(() => JSON.parse(getSaved('imported_models', '[]')));

  // Sync importedModels to localStorage
  useEffect(() => { setSaved('imported_models', JSON.stringify(importedModels)); }, [importedModels]);

  // Bulk API Key helpers
  function getActiveKey() {
    if (!apiKeys.length) return apiKey;
    const idx = Math.min(currentKeyIndex, apiKeys.length - 1);
    return apiKeys[idx] || apiKey;
  }
  function rotateKey() {
    if (!apiKeys.length) return;
    const next = (currentKeyIndex + 1) % apiKeys.length;
    setCurrentKeyIndex(next);
    setApiKey(apiKeys[next]);
  }
  function addBulkKeys(text) {
    const lines = text.split('\n').map(k => k.trim()).filter(k => k.length > 5);
    const existing = new Set(apiKeys);
    const news = lines.filter(k => !existing.has(k));
    if (!news.length) return;
    const updated = [...apiKeys, ...news];
    setApiKeys(updated);
    setCurrentKeyIndex(0);
    if (!apiKey) setApiKey(updated[0]);
  }
  function removeKey(idx) {
    const updated = apiKeys.filter((_, i) => i !== idx);
    setApiKeys(updated);
    if (idx === currentKeyIndex) setCurrentKeyIndex(Math.max(0, currentKeyIndex - 1));
  }
  function switchKey(idx) {
    setCurrentKeyIndex(idx);
    setApiKey(apiKeys[idx]);
  }

  useEffect(() => { tg?.ready?.(); tg?.expand?.(); loadModels(); }, []);
  useEffect(() => setSaved('omni_base_url', baseUrl), [baseUrl]);
  useEffect(() => setSaved('omni_api_key', apiKey), [apiKey]);
  useEffect(() => setSaved('omni_api_keys', JSON.stringify(apiKeys)), [apiKeys]);
  useEffect(() => setSaved('omni_current_key_index', String(currentKeyIndex)), [currentKeyIndex]);
  useEffect(() => setSaved('omni_model', selectedModel), [selectedModel]);
  useEffect(() => setSaved('omni_usage', JSON.stringify(usage)), [usage]);

  const modelNames = [...models.map(m => m.id || m.name).filter(Boolean), ...importedModels.map(m => m.id)];

  async function loadModels() {
    setStatus('checking');
    try {
      const res = await fetch('/api/models', {
        headers: getActiveKey() ? { Authorization: `Bearer ${getActiveKey()}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data.data) ? data.data : [];
      setModels(list);
      if (list[0] && !list.some(m => m.id === selectedModel)) setSelectedModel(list[0].id);
      setStatus('online');
    } catch (e) { setStatus('offline'); }
  }

  async function sendChat() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const comboPrimary = getSaved('omni_combo_primary', selectedModel);
      const comboFallback = getSaved('omni_combo_fallback', '');
      const modelToUse = comboPrimary || selectedModel;

      // Check if using imported model - send directly to provider
      const importedModel = importedModels.find(m => m.id === modelToUse);
      let res, data;

      if (importedModel) {
        // Direct to provider API - use full model ID (with provider prefix)
        res = await fetch(`${importedModel.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(importedModel.apiKey ? { Authorization: `Bearer ${importedModel.apiKey}` } : {}) },
          body: JSON.stringify({ model: importedModel.fullId || modelToUse, messages: next.map(m => ({ role: m.role, content: m.content })), temperature: 0.7 })
        });
      } else {
        // Via OmniRoute
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(getActiveKey() ? { Authorization: `Bearer ${getActiveKey()}` } : {}) },
          body: JSON.stringify({ model: modelToUse, messages: next.map(m => ({ role: m.role, content: m.content })), temperature: 0.7, stream: false })
        });
      }

      data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.error?.message || data?.message || 'request failed'}`);
      const reply = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || 'Tidak ada output.';
      const costInfo = calcCost(modelToUse, data.usage);
      setMessages([...next, { role: 'assistant', content: reply }]);
      setUsage(u => ({ requests: u.requests + 1, tokens: u.tokens + (data.usage?.total_tokens || 0), errors: u.errors, cost: (u.cost || 0) + costInfo.cost }));
      setLastCost(costInfo);
    } catch (e) {
      // Try combo fallback once
      const comboFallback = getSaved('omni_combo_fallback', '');
      if (comboFallback && comboFallback !== getSaved('omni_combo_primary', '')) {
        try {
          const importedModel2 = importedModels.find(m => m.id === comboFallback);
          let res2, data2;
          if (importedModel2) {
            res2 = await fetch(`${importedModel2.baseUrl}/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(importedModel2.apiKey ? { Authorization: `Bearer ${importedModel2.apiKey}` } : {}) },
              body: JSON.stringify({ model: comboFallback, messages: next.map(m => ({ role: m.role, content: m.content })), temperature: 0.7 })
            });
          } else {
            res2 = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(getActiveKey() ? { Authorization: `Bearer ${getActiveKey()}` } : {}) },
              body: JSON.stringify({ model: comboFallback, messages: next.map(m => ({ role: m.role, content: m.content })), temperature: 0.7, stream: false })
            });
          }
          data2 = {};
          try { data2 = await res2.json(); } catch {}
          if (res2.ok && (data2?.choices?.[0]?.message?.content || data2?.choices?.[0]?.text)) {
            const reply = data2?.choices?.[0]?.message?.content || data2?.choices?.[0]?.text;
            setMessages([...next, { role: 'assistant', content: `[Combo fallback → ${comboFallback}] ${reply}` }]);
            setBusy(false);
            return;
          }
        } catch {}
      }
      if (apiKeys.length > 1) {
        rotateKey();
        setMessages([...next, { role: 'assistant', content: `Gagal (key ${currentKeyIndex + 1}/${apiKeys.length}): ${e.message}. Auto-switching...` }]);
      } else {
        setMessages([...next, { role: 'assistant', content: `Gagal: ${e.message}` }]);
      }
      setUsage(u => ({ ...u, errors: u.errors + 1 }));
    } finally { setBusy(false); }
  }

  return (
    <div className="app">
      <Header status={status} />
      <TopTabs page={page} setPage={setPage} />
      <main className="content">
        {page === 'dashboard' && <Dashboard status={status} models={models} usage={usage} setPage={setPage} loadModels={loadModels} />}
        {page === 'providers' && <Providers baseUrl={baseUrl} setBaseUrl={setBaseUrl} apiKey={apiKey} setApiKey={setApiKey} apiKeys={apiKeys} currentKeyIndex={currentKeyIndex} bulkInput={bulkInput} setBulkInput={setBulkInput} addBulkKeys={addBulkKeys} removeKey={removeKey} switchKey={switchKey} models={models} status={status} loadModels={loadModels} selectedModel={selectedModel} setSelectedModel={setSelectedModel} />}
        {page === 'chat' && <Chat selectedModel={selectedModel} setSelectedModel={setSelectedModel} modelNames={modelNames} messages={messages} input={input} setInput={setInput} busy={busy} sendChat={sendChat} />}
        {page === 'combos' && <Combos models={modelNames} />}
        {page === 'usage' && <Usage usage={usage} setUsage={setUsage} models={models} lastCost={lastCost} />}
        {page === 'cc' && <CCTools />}
        {page === 'tempmail' && <TempMail />}
        {page === 'video' && <VideoPage models={modelNames} />}
        {page === 'settings' && <SettingsPage baseUrl={baseUrl} setBaseUrl={setBaseUrl} apiKey={apiKey} setApiKey={setApiKey} loadModels={loadModels} />}
        {page === 'more' && <MorePage setPage={setPage} />}
        {page === 'routeradmin' && <RouterAdminPage importedModels={importedModels} setImportedModels={setImportedModels} />}
      </main>
      <BottomNav page={page} setPage={setPage} />
    </div>
  );
}

function Header({ status }) {
  return <header className="header">
    <div className="brand"><div className="botIcon"><Bot size={20}/></div><div><b>OmniRoute</b><span>Telegram Mini App</span></div></div>
    <div className={`status ${status}`}><span></span>{status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Checking'}</div>
  </header>;
}
function TopTabs({ page, setPage }) {
  const tabs = [['dashboard','Home'],['providers','Providers'],['combos','Combos'],['usage','Usage']];
  return <div className="tabs">{tabs.map(([id,label]) => <button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}>{label}</button>)}</div>;
}
function Stat({ icon, label, value }) { return <div className="stat"><div>{icon}</div><span>{label}</span><b>{value}</b></div>; }
function Dashboard({ status, models, usage, setPage, loadModels }) {
  return <section>
    <div className="hero"><Sparkles/><h1>Router Dashboard</h1><p>Terhubung ke OmniRoute kamu. Kelola model, chat, Luhn tools, dan temp mail dari Telegram.</p></div>
    <div className="grid2">
      <Stat icon={<Cable/>} label="Router" value={status}/>
      <Stat icon={<Bot/>} label="Models" value={models.length}/>
      <Stat icon={<Activity/>} label="Requests" value={usage.requests}/>
      <Stat icon={<Zap/>} label="Tokens" value={usage.tokens}/>
    </div>
    <div className="actions"><button onClick={loadModels}>Refresh Status</button><button onClick={()=>setPage('chat')}>Open Chat</button></div>
  </section>;
}
function Providers({ baseUrl, setBaseUrl, apiKey, setApiKey, apiKeys, currentKeyIndex, bulkInput, setBulkInput, addBulkKeys, removeKey, switchKey, models, status, loadModels, selectedModel, setSelectedModel }) {
  return <section><div className="title"><h2>Providers ({models.length})</h2><button onClick={loadModels}><RefreshCcw size={16}/> Test</button></div>
    <div className="card">
      <label>OmniRoute Base URL</label>
      <input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} />

      {apiKeys.length > 0 && (
        <>
          <label>API Key Pool</label>
          <div className="keyPoolInfo">Pool: {apiKeys.length} keys | Active: #{currentKeyIndex + 1}</div>
          <div className="keyList">{apiKeys.map((k,i)=>(
            <div key={i} className={`keyItem ${i===currentKeyIndex?'active':''}`}>
              <span onClick={()=>switchKey(i)}>Key {i+1}: {k.slice(0,12)}...</span>
              <button onClick={()=>removeKey(i)}><Trash2 size={12}/></button>
            </div>
          ))}</div>
        </>
      )}

      <label>Single API Key (optional)</label>
      <input value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Optional - atau gunakan pool keys di atas" />

      <label>Default Model</label>
      <select value={selectedModel} onChange={e=>setSelectedModel(e.target.value)}>
        {models.map(m=><option key={m.id} value={m.id}>{m.id}</option>)}
        {importedModels.length > 0 && <optgroup label="📥 Imported Models">
          {importedModels.map(m=><option key={m.id} value={m.id}>{m.id} ({m.provider})</option>)}
        </optgroup>}
      </select>
      <div className={`notice ${status}`}>Status: {status}. Catatan: Vercel/Telegram HTTPS bisa memblokir HTTP. Pakai HTTPS tunnel/proxy untuk production.</div>
    </div>
    <div className="modelList">{models.map(m=><div className="model" key={m.id}><b>{m.id}</b><span>{m.name || m.owned_by || 'model'}</span></div>)}</div>
  </section>;
}
function Chat({ selectedModel, setSelectedModel, modelNames, messages, input, setInput, busy, sendChat }) {
  return <section className="chatPage"><div className="title"><h2>AI Chat</h2><select value={selectedModel} onChange={e=>setSelectedModel(e.target.value)}>{modelNames.map(m=><option key={m}>{m}</option>)}</select></div>
    <div className="chatBox">{messages.map((m,i)=><div key={i} className={`bubble ${m.role}`}>{m.content}</div>)}{busy && <div className="bubble assistant">Typing...</div>}</div>
    <div className="composer"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendChat()}} placeholder="Tulis prompt..."/><button onClick={sendChat}><Send size={18}/></button></div>
  </section>;
}
function Combos({ models }) {
  const [primary, setPrimary] = useState(() => getSaved('omni_combo_primary', models[0] || 'hermes'));
  const [fallback, setFallback] = useState(() => getSaved('omni_combo_fallback', models[1] || 'kiro'));
  useEffect(() => setSaved('omni_combo_primary', primary), [primary]);
  useEffect(() => setSaved('omni_combo_fallback', fallback), [fallback]);
  return <section><div className="title"><h2>Combos</h2><span className="pill">UI Router</span></div><div className="card">
    <label>Primary Model</label><select value={primary} onChange={e=>setPrimary(e.target.value)}>{models.map(m=><option key={m}>{m}</option>)}</select>
    <label>Fallback Model</label><select value={fallback} onChange={e=>setFallback(e.target.value)}>{models.map(m=><option key={m}>{m}</option>)}</select>
    <div className="comboLine"><CheckCircle2/> {primary} → fallback ke {fallback}</div>
    <div className="notice">Combos saved automatic. Logic combo: primary dulu, kalo fail switch ke fallback (max 1x).</div>
  </div></section>;
}
function Usage({ usage, setUsage, models, lastCost }) {
  return <section><div className="title"><h2>Usage</h2><button onClick={()=>setUsage({requests:0,tokens:0,errors:0,cost:0})}>Reset</button></div>
    {lastCost && <div className={`costBanner ${lastCost.isFree?'free':'paid'}`}>
      <span>Last call: {lastCost.prompt_tokens} in / {lastCost.completion_tokens} out / {lastCost.total_tokens} total</span>
      <span>{lastCost.isFree ? 'FREE (no charge)' : `$${lastCost.cost.toFixed(6)}`}</span>
    </div>}
    <div className="grid2"><Stat icon={<Activity/>} label="Requests" value={usage.requests}/><Stat icon={<Zap/>} label="Tokens" value={usage.tokens}/><Stat icon={<ShieldCheck/>} label="Errors" value={usage.errors}/><Stat icon={<CreditCard/>} label="Total Cost" value={usage.cost ? '$'+usage.cost.toFixed(4) : '$0.0000'}/></div>
  </section>;
}
function VideoPage({ models }) { return <section><div className="title"><h2>Video</h2><Play/></div><div className="card"><p className="muted">Halaman video siap untuk model video yang muncul dari OmniRoute seperti VEO/Seedance. Endpoint video bisa disambungkan sesuai format API router kamu.</p>{models.filter(m=>/veo|seedance|video/i.test(m)).map(m=><div className="model" key={m}><b>{m}</b><span>video-capable candidate</span></div>)}</div></section>; }
function SettingsPage({ baseUrl, setBaseUrl, apiKey, setApiKey, loadModels }) { return <section><div className="title"><h2>Settings</h2><Settings/></div><div className="card"><label>Base URL</label><input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)}/><label>Authorization Bearer</label><input value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="optional"/><button className="wide" onClick={loadModels}>Save & Test</button></div></section>; }
function RouterAdminPage({ importedModels, setImportedModels }) {
  const [providers, setProviders] = useState([]);
  const [connections, setConnections] = useState([]);
  const [combos, setCombos] = useState([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ name: '', prefix: '', baseUrl: '', apiKey: '' });
  const [bulkInput, setBulkInput] = useState('');
  const [bulkBaseUrl, setBulkBaseUrl] = useState('https://router.susilo.my.id/v1');
  const [providerModels, setProviderModels] = useState({});
  const [expandedProvider, setExpandedProvider] = useState(null);

  async function loadProviders() {
    setMsg('Loading providers...');
    try {
      const res = await fetch('/api/adminproxy?p=providers');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setProviders(data.nodes || []);
      setConnections(data.connections || []);
      setMsg('Providers loaded');
    } catch (e) { setMsg(`Error: ${e.message}`); }
  }
  async function loadCombos() {
    try {
      const res = await fetch('/api/adminproxy?p=combos');
      const data = await res.json();
      if (res.ok) setCombos(data.combos || []);
    } catch (e) { console.error(e); }
  }
  async function addProvider() {
    setMsg('Adding provider...');
    try {
      const res = await fetch('/api/adminproxy?p=provider/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setForm({ name: '', prefix: '', baseUrl: '', apiKey: '' });
      setMsg('Provider added - importing models...');
      loadProviders();
      // Auto-import models after add
      if (data.provider?.id) {
        setTimeout(async () => {
          await importProviderModels({ id: data.provider.id, name: form.name, base_url: form.baseUrl, api_key: form.apiKey });
        }, 1000);
      }
    } catch (e) { setMsg(`Error: ${e.message}`); }
  }
  async function addBulkProviders(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (!lines.length) return;
    setMsg(`Adding ${lines.length} providers...`);
    let success = 0, fail = 0;
    for (let i = 0; i < lines.length; i++) {
      const apiKey = lines[i].trim();
      if (!apiKey || apiKey.length < 10) { fail++; continue; }
      const providerData = {
        name: `provider-${Date.now().toString(36)}-${i}`,
        prefix: `p${i+1}`,
        baseUrl: bulkBaseUrl,
        apiKey: apiKey
      };
      try {
        const res = await fetch('/api/adminproxy?p=provider/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(providerData)
        });
        if (res.ok) success++; else fail++;
      } catch (e) { fail++; }
    }
    setMsg(`Done: ${success} added, ${fail} failed`);
    setBulkInput('');
    loadProviders();
  }
  async function deleteProvider(providerId) {
    if (!confirm('Delete provider ini?')) return;
    setMsg('Deleting provider...');
    try {
      const res = await fetch('/api/adminproxy?p=provider/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMsg('Provider deleted');
      loadProviders();
    } catch (e) { setMsg(`Error: ${e.message}`); }
  }

  async function loadProviderModels(provider) {
    if (expandedProvider === provider.id) {
      setExpandedProvider(null);
      return;
    }
    setExpandedProvider(provider.id);
    if (providerModels[provider.id]) return;
    setMsg(`Loading models for ${provider.name}...`);
    try {
      const res = await fetch('/api/adminproxy?p=provider/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: provider.id, baseUrl: provider.base_url, apiKey: provider.api_key })
      });
      const data = await res.json();
      if (res.ok && data.models) {
        setProviderModels(prev => ({ ...prev, [provider.id]: data.models }));
        setMsg('');
      } else {
        setProviderModels(prev => ({ ...prev, [provider.id]: ['Error loading models'] }));
        setMsg(data.error || 'Failed to load models');
      }
    } catch (e) {
      setProviderModels(prev => ({ ...prev, [provider.id]: ['Error: ' + e.message] }));
      setMsg(`Error: ${e.message}`);
    }
  }

  async function importProviderModels(provider) {
    setMsg(`Importing models for ${provider.name}...`);
    try {
      // Fetch models directly from provider baseUrl
      const res = await fetch(`${provider.base_url}/models`, {
        headers: { 'Authorization': `Bearer ${provider.api_key}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      // Extract model IDs from OpenAI format or direct array
      const modelList = data.data?.map(m => m.id) || data.models || [];
      if (!modelList.length) throw new Error('No models found');
      
      // Save to imported models with provider tag
      // Store model ID without provider prefix for matching
      const newImports = modelList.map(id => {
        // Extract just the model name without provider prefix (e.g., "minimax-m2.5" from "lightning-ai/minimax-m2.5")
        const cleanId = id.includes('/') ? id.split('/').pop() : id;
        return {
          id: cleanId,
          fullId: id,
          provider: provider.name,
          baseUrl: provider.base_url,
          apiKey: provider.api_key
        };
      });
      
      setImportedModels(prev => {
        const filtered = prev.filter(m => m.provider !== provider.name);
        return [...filtered, ...newImports];
      });

      // Register models to OmniRoute
      try {
        const modelsToRegister = newImports.map(m => ({
          model: m.fullId,
          base_url: m.baseUrl,
          api_key: m.apiKey,
          provider: m.provider
        }));
        await fetch('/api/adminproxy?p=models/bulk-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ models: modelsToRegister })
        });
        setMsg(`✅ ${modelList.length} models imported from ${provider.name} & registered to OmniRoute!`);
      } catch (regErr) {
        // If registration fails, still show import success
        setMsg(`✅ ${modelList.length} models imported from ${provider.name}! (OmniRoute registration skipped)`);
      }
    } catch (e) {
      setMsg(`❌ Import failed: ${e.message}`);
    }
  }

  useEffect(() => { loadProviders(); loadCombos(); }, []);

  return <section>
    <div className="title"><h2>Router Admin</h2><span className="pill">OmniRoute</span></div>
    <div className="card">
      <h3>Add Provider</h3>
      <label>Name</label><input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="kimchi-new" />
      <label>Prefix</label><input value={form.prefix} onChange={e=>setForm({...form, prefix:e.target.value})} placeholder="kimchi-new" />
      <label>Base URL</label><input value={form.baseUrl} onChange={e=>setForm({...form, baseUrl:e.target.value})} placeholder="https://example.com/v1" />
      <label>API Key</label><input value={form.apiKey} onChange={e=>setForm({...form, apiKey:e.target.value})} placeholder="sk-..." />
      <button className="wide" onClick={addProvider}>Add Provider</button>
      <div className="notice">{msg}</div>
    </div>
    <div className="card">
      <h3>Bulk Add API Keys</h3>
      <label>Base URL (sama untuk semua)</label>
      <input value={bulkBaseUrl} onChange={e=>setBulkBaseUrl(e.target.value)} placeholder="https://router.susilo.my.id/v1" />
      <label>API Keys (satu per baris)</label>
      <textarea value={bulkInput} onChange={e=>setBulkInput(e.target.value)} placeholder={"sk-xxx\nsk-yyy\nsk-zzz"} rows={5} />
      <button className="wide" onClick={()=>addBulkProviders(bulkInput)}><Plus size={15}/> Add Bulk API Keys</button>
      <div className="notice">{msg}</div>
    </div>
    <div className="modelList">
      {providers.map(p => {
        const conn = connections.find(c => c.provider === p.id);
        const isExpanded = expandedProvider === p.id;
        const models = providerModels[p.id];
        return <div className="modelItem" key={p.id}>
          <div><b>{p.name}</b><div className="model-provider">{p.base_url}</div><div className="model-provider">active: {conn?.is_active ? 'yes' : 'no'} • status: {conn?.test_status || '-'}</div>
          {models && <div className="model-list">{models.map(m => <span key={m} className="model-tag">{m}</span>)}</div>}
          </div>
          <div className="provider-actions">
            <button onClick={() => loadProviderModels(p)}>{isExpanded ? '▲' : '▼'} Models</button>
            <button className="sync-btn" onClick={() => importProviderModels(p)}>📥 Import</button>
            <button onClick={() => deleteProvider(p.id)}>Delete</button>
          </div>
        </div>;
      })}
    </div>
    <div className="card">
      <h3>Combos</h3>
      {combos.length === 0 ? <div className="notice">No combos found</div> : combos.map(c => (
        <div key={c.id} className="modelItem">
          <div><b>{c.name || c.id}</b><div className="model-provider">{c.updated_at || c.created_at || '-'}</div></div>
        </div>
      ))}
    </div>
  </section>;
}
function MorePage({ setPage }) {
  const items = [
    ['chat','AI Chat',MessageCircle],
    ['cc','CC Tools 💳',CreditCard],
    ['tempmail','Temp Mail 📧',Mail],
    ['video','Video',Video],
    ['settings','Settings',Settings],
    ['routeradmin','Router Admin',Bot]
  ];
  return <section>
    <div className="title"><h2>More</h2><MoreHorizontal /></div>
    <div className="menuGrid">
      {items.map(([id,label,icon]) => {
        const Icon = icon;
        return <button key={id} onClick={() => setPage(id)}>
          <Icon size={18}/><span>{label}</span>
        </button>;
      })}
    </div>
  </section>;
}
function BottomNav({ page, setPage }) {
  const nav = [
    ['dashboard','Dashboard',Home],
    ['cc','CC Tools 💳',CreditCard],
    ['tempmail','Mail 📧',Mail],
    ['video','Video',Video],
    ['settings','Settings',Settings],
    ['more','More',MoreHorizontal]
  ];
  return <nav className="bottom">
    {nav.map(([id,label,icon]) => {
      const Icon = icon;
      return <button key={id} className={page===id?'active':''} onClick={() => setPage(id)}>
        <Icon size={18}/><span>{label}</span>
      </button>;
    })}
  </nav>;
}

createRoot(document.getElementById('root')).render(<App />);