import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Bot, Cable, CheckCircle2, ChevronDown, Clipboard, CreditCard, Home, Mail, MessageCircle, MoreHorizontal, Play, RefreshCcw, Send, Settings, ShieldCheck, Sparkles, Video, Zap } from 'lucide-react';
import './styles.css';

const DEFAULT_BASE_URL = 'https://router.susilo.my.id/v1';
const ADMIN_BASE_URL = 'https://admin.susilo.my.id/admin';
const ADMIN_TOKEN = 'ronksok-admin-123';
const TEMP_MAIL_BASE = 'https://api.mail.tm';

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
    if (doubleIt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
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
    if (doubleIt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
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
  if (/^4/.test(n)) return 'Visa-like';
  if (/^5[1-5]/.test(n) || /^2(2[2-9]|[3-6]|7[01]|720)/.test(n)) return 'Mastercard-like';
  if (/^3[47]/.test(n)) return 'Amex-like';
  if (/^6(?:011|5|4[4-9])/.test(n)) return 'Discover-like';
  return 'Unknown';
}

function App() {
  const tg = window.Telegram?.WebApp;
  const [page, setPage] = useState('dashboard');
  const [baseUrl, setBaseUrl] = useState(getSaved('omni_base_url', DEFAULT_BASE_URL));
  const [apiKey, setApiKey] = useState(getSaved('omni_api_key', ''));
  const [models, setModels] = useState([]);
  const [status, setStatus] = useState('checking');
  const [selectedModel, setSelectedModel] = useState(getSaved('omni_model', 'hermes'));
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Halo, saya siap via OmniRoute. Pilih model lalu kirim prompt.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState(() => JSON.parse(getSaved('omni_usage', '{"requests":0,"tokens":0,"errors":0}')));

  useEffect(() => {
    tg?.ready?.();
    tg?.expand?.();
    loadModels();
  }, []);

  useEffect(() => setSaved('omni_base_url', baseUrl), [baseUrl]);
  useEffect(() => setSaved('omni_api_key', apiKey), [apiKey]);
  useEffect(() => setSaved('omni_model', selectedModel), [selectedModel]);
  useEffect(() => setSaved('omni_usage', JSON.stringify(usage)), [usage]);

  const modelNames = useMemo(() => models.map(m => m.id || m.name).filter(Boolean), [models]);

  async function loadModels() {
    setStatus('checking');
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data.data) ? data.data : [];
      setModels(list);
      if (list[0] && !list.some(m => m.id === selectedModel)) setSelectedModel(list[0].id);
      setStatus('online');
    } catch (e) {
      setStatus('offline');
    }
  }

  async function sendChat() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
  },
  body: JSON.stringify({
    model: selectedModel,
    messages: next.map(m => ({ role: m.role, content: m.content })),
    temperature: 0.7,
    stream: false
  })
});

let data = {};
try {
  data = await res.json();
} catch {
  data = {};
}

if (!res.ok) {
  throw new Error(`HTTP ${res.status}: ${data?.error?.message || data?.message || 'request failed'}`);
}

const reply =
  data?.choices?.[0]?.message?.content ||
  data?.choices?.[0]?.text ||
  'Tidak ada output.';

setMessages([...next, { role: 'assistant', content: reply }]);
setUsage(u => ({
  requests: u.requests + 1,
  tokens: u.tokens + (data.usage?.total_tokens || 0),
  errors: u.errors
}));

     } catch (e) {
    setMessages([...next, {
      role: 'assistant',
      content: `Gagal connect ke OmniRoute: ${e.message}`
    }]);
    setUsage(u => ({ ...u, errors: u.errors + 1 }));
  } finally {
    setBusy(false);
  }
}
  return <div className="app">
    <Header status={status} />
    <TopTabs page={page} setPage={setPage} />
    <main className="content">
      {page === 'dashboard' && <Dashboard status={status} models={models} usage={usage} setPage={setPage} loadModels={loadModels} />}
      {page === 'providers' && <Providers baseUrl={baseUrl} setBaseUrl={setBaseUrl} apiKey={apiKey} setApiKey={setApiKey} models={models} status={status} loadModels={loadModels} selectedModel={selectedModel} setSelectedModel={setSelectedModel} />}
      {page === 'chat' && <Chat selectedModel={selectedModel} setSelectedModel={setSelectedModel} modelNames={modelNames} messages={messages} input={input} setInput={setInput} busy={busy} sendChat={sendChat} />}
      {page === 'combos' && <Combos models={modelNames} />}
      {page === 'usage' && <Usage usage={usage} setUsage={setUsage} models={models} />}
      {page === 'cc' && <CCTools />}
      {page === 'tempmail' && <TempMail />}
      {page === 'video' && <VideoPage models={modelNames} />}
      {page === 'settings' && <SettingsPage baseUrl={baseUrl} setBaseUrl={setBaseUrl} apiKey={apiKey} setApiKey={setApiKey} loadModels={loadModels} />}
      {page === 'more' && <MorePage setPage={setPage} />}
      {page === 'routeradmin' && <RouterAdminPage />}
    </main>
    <BottomNav page={page} setPage={setPage} />
  </div>;
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
function Providers({ baseUrl, setBaseUrl, apiKey, setApiKey, models, status, loadModels, selectedModel, setSelectedModel }) {
  return <section><div className="title"><h2>Providers ({models.length})</h2><button onClick={loadModels}><RefreshCcw size={16}/> Test</button></div>
    <div className="card">
      <label>OmniRoute Base URL</label><input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} />
      <label>API Key / Token optional</label><input value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="kosongkan kalau router tidak butuh key" />
      <label>Default Model</label><select value={selectedModel} onChange={e=>setSelectedModel(e.target.value)}>{models.map(m=><option key={m.id} value={m.id}>{m.id}</option>)}</select>
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
  const [primary, setPrimary] = useState(models[0] || 'hermes');
  const [fallback, setFallback] = useState(models[1] || 'kiro');
  return <section><div className="title"><h2>Combos</h2><span className="pill">UI Router</span></div><div className="card">
    <label>Primary Model</label><select value={primary} onChange={e=>setPrimary(e.target.value)}>{models.map(m=><option key={m}>{m}</option>)}</select>
    <label>Fallback Model</label><select value={fallback} onChange={e=>setFallback(e.target.value)}>{models.map(m=><option key={m}>{m}</option>)}</select>
    <div className="comboLine"><CheckCircle2/> {primary} → fallback ke {fallback}</div>
  </div></section>;
}
function Usage({ usage, setUsage, models }) {
  return <section><div className="title"><h2>Usage</h2><button onClick={()=>setUsage({requests:0,tokens:0,errors:0})}>Reset</button></div><div className="grid2"><Stat icon={<Activity/>} label="Requests" value={usage.requests}/><Stat icon={<Zap/>} label="Tokens" value={usage.tokens}/><Stat icon={<ShieldCheck/>} label="Errors" value={usage.errors}/><Stat icon={<Bot/>} label="Models" value={models.length}/></div></section>;
}
function CCTools() {
  const [card, setCard] = useState('');
  const [prefix, setPrefix] = useState('4');
  const [length, setLength] = useState(16);
  const [generated, setGenerated] = useState('');
  const valid = luhnCheck(card);
  return <section><div className="title"><h2>CC Tools</h2><span className="pill safe">Luhn Offline</span></div>
    <div className="card"><p className="muted">Tool ini hanya validasi format Luhn offline. Tidak mengecek kartu aktif, limit, bank, transaksi, atau data sensitif.</p>
      <label>Card Number</label><input value={card} onChange={e=>setCard(e.target.value)} placeholder="4111 1111 1111 1111" />
      <div className={`notice ${valid?'online':'offline'}`}>{card ? (valid ? 'Lulus Luhn / format valid' : 'Tidak lulus Luhn') : 'Masukkan nomor untuk cek format'} • {brandOf(card)}</div>
      <label>Generate Test Number Prefix</label><input value={prefix} onChange={e=>setPrefix(e.target.value)} />
      <label>Length</label><select value={length} onChange={e=>setLength(Number(e.target.value))}><option>13</option><option>15</option><option>16</option><option>19</option></select>
      <button className="wide" onClick={()=>setGenerated(generateLuhn(prefix,length))}>Generate Luhn Test Number</button>
      {generated && <div className="result"><b>{formatCard(generated)}</b><button onClick={()=>navigator.clipboard?.writeText(generated)}><Clipboard size={15}/>Copy</button></div>}
    </div></section>;
}
function TempMail() {
  const [account, setAccount] = useState(null); const [token, setToken] = useState(''); const [inbox, setInbox] = useState([]); const [loading, setLoading] = useState(false); const [msg, setMsg] = useState('');
  async function createMail() { setLoading(true); setMsg(''); try { const domains = await (await fetch(`${TEMP_MAIL_BASE}/domains`)).json(); const domain = domains['hydra:member']?.[0]?.domain; const address = `r${Math.random().toString(36).slice(2,10)}@${domain}`; const password = Math.random().toString(36).slice(2) + 'A1!'; await fetch(`${TEMP_MAIL_BASE}/accounts`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({address,password})}); const tk = await (await fetch(`${TEMP_MAIL_BASE}/token`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({address,password})})).json(); setAccount({address,password}); setToken(tk.token); setMsg('Temp mail dibuat.'); } catch(e){ setMsg('Gagal membuat temp mail: '+e.message); } finally{ setLoading(false); } }
  async function refreshInbox() { if(!token) return; setLoading(true); try { const data = await (await fetch(`${TEMP_MAIL_BASE}/messages`, {headers:{Authorization:`Bearer ${token}`}})).json(); setInbox(data['hydra:member'] || []); } catch(e){ setMsg('Gagal refresh inbox: '+e.message); } finally{ setLoading(false); } }
  return <section><div className="title"><h2>Temp Mail</h2><button onClick={refreshInbox}><RefreshCcw size={16}/>Refresh</button></div><div className="card">
    <button className="wide" onClick={createMail} disabled={loading}><Mail size={16}/> Generate Temp Mail</button>{account && <div className="result"><b>{account.address}</b><button onClick={()=>navigator.clipboard?.writeText(account.address)}><Clipboard size={15}/>Copy</button></div>}{msg && <p className="muted">{msg}</p>}
  </div><div className="modelList">{inbox.length===0 ? <div className="empty">Inbox kosong</div> : inbox.map(m=><div className="model" key={m.id}><b>{m.subject || '(no subject)'}</b><span>{m.from?.address}</span></div>)}</div></section>;
}
function VideoPage({ models }) { return <section><div className="title"><h2>Video</h2><Play/></div><div className="card"><p className="muted">Halaman video siap untuk model video yang muncul dari OmniRoute seperti VEO/Seedance. Endpoint video bisa disambungkan sesuai format API router kamu.</p>{models.filter(m=>/veo|seedance|video/i.test(m)).map(m=><div className="model" key={m}><b>{m}</b><span>video-capable candidate</span></div>)}</div></section>; }
function SettingsPage({ baseUrl, setBaseUrl, apiKey, setApiKey, loadModels }) { return <section><div className="title"><h2>Settings</h2><Settings/></div><div className="card"><label>Base URL</label><input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)}/><label>Authorization Bearer</label><input value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="optional"/><button className="wide" onClick={loadModels}>Save & Test</button></div></section>; }
function RouterAdminPage() {
  const [providers, setProviders] = useState([]);
  const [connections, setConnections] = useState([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    prefix: '',
    baseUrl: '',
    apiKey: ''
  });

  async function loadProviders() {
    setMsg('Loading providers...');
    try {
      const res = await fetch(`${ADMIN_BASE_URL}/providers`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setProviders(data.nodes || []);
      setConnections(data.connections || []);
      setMsg('Providers loaded');
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
  }

  async function addProvider() {
    setMsg('Adding provider...');
    try {
      const res = await fetch(`${ADMIN_BASE_URL}/provider/add`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setForm({ name: '', prefix: '', baseUrl: '', apiKey: '' });
      setMsg('Provider added');
      loadProviders();
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
  }

  async function deleteProvider(providerId) {
    if (!confirm('Delete provider ini?')) return;
    setMsg('Deleting provider...');
    try {
      const res = await fetch(`${ADMIN_BASE_URL}/provider/delete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ providerId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMsg('Provider deleted');
      loadProviders();
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
  }

  useEffect(() => {
    loadProviders();
  }, []);

  return <section>
    <div className="title"><h2>Router Admin</h2><span className="pill">OmniRoute</span></div>

    <div className="card">
      <h3>Add Provider</h3>
      <label>Name</label>
      <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="kimchi-new" />
      <label>Prefix</label>
      <input value={form.prefix} onChange={e=>setForm({...form, prefix:e.target.value})} placeholder="kimchi-new" />
      <label>Base URL</label>
      <input value={form.baseUrl} onChange={e=>setForm({...form, baseUrl:e.target.value})} placeholder="https://example.com/v1" />
      <label>API Key</label>
      <input value={form.apiKey} onChange={e=>setForm({...form, apiKey:e.target.value})} placeholder="sk-..." />
      <button className="wide" onClick={addProvider}>Add Provider</button>
      <div className="notice">{msg}</div>
    </div>

    <div className="modelList">
      {providers.map(p => {
        const conn = connections.find(c => c.provider === p.id);
        return <div className="modelItem" key={p.id}>
          <div>
            <b>{p.name}</b>
            <div className="model-provider">{p.base_url}</div>
            <div className="model-provider">active: {conn?.is_active ? 'yes' : 'no'} • status: {conn?.test_status || '-'}</div>
          </div>
          <button onClick={()=>deleteProvider(p.id)}>Delete</button>
        </div>
      })}
    </div>
  </section>;
}
function MorePage({ setPage }) { const items=[['chat','AI Chat',<MessageCircle/>],['cc','CC Tools',<CreditCard/>],['tempmail','Temp Mail',<Mail/>],['video','Video',<Video/>],['settings','Settings',<Settings/>,['routeradmin','Router Admin',Bot]]; return <section><div className="title"><h2>More</h2><MoreHorizontal/></div><div className="menuGrid">{items.map(([id,label,icon])=><button key={id} onClick={()=>setPage(id)}>{icon}<span>{label}</span><ChevronDown size={15}/></button>)}</div></section>; }
function BottomNav({ page, setPage }) { const nav=[['dashboard','Dashboard',Home],['cc','CC Tools',CreditCard],['tempmail','Temp Mail',Mail],['video','Video',Video],['settings','Settings',Settings],['more','More',MoreHorizontal]]; return <nav className="bottom">{nav.map(([id,label,icon])=>{const Icon=icon;return <button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={18}/><span>{label}</span></button>})}</nav>; }
createRoot(document.getElementById('root')).render(<App />);
