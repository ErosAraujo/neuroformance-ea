import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import axios, { AxiosError } from 'axios';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import './styles.css';

type Profile = 'student' | 'teacher';
type User = { id: number; name: string; email: string; profile: Profile; teacherCode?: string; photoUrl?: string; avatarUrl?: string; profilePhoto?: string; imageUrl?: string; picture?: string; photo?: string; avatar?: string };
type AuthContextType = { user: User | null; token: string | null; loading: boolean; login: (email: string, password: string, remember: boolean) => Promise<void>; registerStudent: (data: RegisterStudentPayload) => Promise<void>; logout: () => void };
type RegisterStudentPayload = { name: string; email: string; password: string; teacherCode: string };
type SleepRecord = { id: number; date: string; sleepTime?: string; wakeTime?: string; sleepStart?: string; sleepEnd?: string; scoreTotal: number; totalHours: number; classification: string; perceivedQuality: number; awakenings: number; morningState?: number; wakeState?: number; energy?: number; mood?: number; stress?: number; generalPain?: number; bodyHeaviness?: number; timeToSleep?: number; sleepLatencyMinutes?: number; nap?: boolean; caffeine?: boolean; alcohol?: boolean; screenBeforeSleep?: boolean; pain?: boolean; notes?: string; scoreDuration?: number; scoreQuality?: number; scoreContinuity?: number; scoreState?: number; scoreRegularity?: number };
type WeeklySummary = { averageScore?: number; averageHours?: number; averageQuality?: number; averageEnergy?: number; nightsRecorded?: number; goodNights?: number; badNights?: number; regularityAverage?: number; adherence?: number; trend?: string };
type RecoverySummary = { hasData: boolean; recoveryLevel: string | null; readinessScore: number | null; fatigueRisk: string | null; recoveryScore: number | null; weeklyTrendPercent: number | null; trainingSuggestion?: string };
type StudentListItem = { id: number; name: string; email?: string; login?: string; username?: string; status?: string; studentStatus?: string; trackingStatus?: string; priority?: string; weeklyAverage?: number; monthlyAverage?: number; trend?: string; lastRecord?: any; recentRecords?: SleepRecord[]; records?: SleepRecord[]; allRecords?: SleepRecord[]; adherence?: number; alertCount?: number; risk?: string; recommendation?: string };
type AlertItem = { id: number | string; studentId?: number | string; studentName?: string; type?: string; description: string; level?: string; severity?: string; action?: string; date?: string; status?: string; source?: 'backend' };
type InsightItem = { title?: string; message?: string; description?: string; level?: string; type?: string } | string;
type SleepGoal = { id?: number; hoursGoal?: number; sleepTimeGoal?: string; wakeTimeGoal?: string; regularityGoal?: number; active?: boolean; createdAt?: string } | null;
type DashboardStudent = StudentListItem & { activeGoal?: SleepGoal; alerts?: AlertItem[]; records?: SleepRecord[]; detailLoaded?: boolean; detailError?: string };
type FatigueResult = { riskFinal: number | null; level: 'baixo' | 'moderado' | 'alto' | 'elevado/crítico' | 'dados insuficientes'; media?: number; risco1?: number; risco2?: number; risco3?: number; reason?: string };
type GoalNotMetResult = { hasGoal: boolean; isNotMet: boolean; severeDeficit: boolean; averageHours: number | null; goalHours: number | null; baseReduced: boolean; recordsUsed: number };
type DashboardModalState = { title: string; description?: string; items: React.ReactNode[] } | null;

function resolveApiUrl() {
  const envUrl = String(import.meta.env.VITE_API_URL || '').trim();

  // Em teste local, usar /api evita CORS porque o Vite faz proxy para o backend em :3000.
  // Isso cobre localhost, 127.0.0.1 e acesso pelo IP da rede no celular.
  if (!envUrl) return '/api';

  const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname) || /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(window.location.hostname);
  const isLocalBackend = /^https?:\/\/(localhost|127\.0\.0\.1):3000\/api\/?$/i.test(envUrl);

  if (isLocalFrontend && isLocalBackend) return '/api';
  return envUrl.replace(/\/$/, '');
}

const API_URL = resolveApiUrl();
const STUDENT_APP_URL = String(import.meta.env.VITE_STUDENT_APP_URL || '').trim();
const api = axios.create({ baseURL: API_URL, timeout: 15000 });

function isPublicAuthRoute(url?: string) {
  const route = String(url || '');
  return ['/auth/login', '/auth/register'].some((publicRoute) => route.includes(publicRoute));
}

function messageFromError(error: unknown) {
  const err = error as AxiosError<{ message?: string }>;
  const status = err.response?.status;
  const url = err.config?.url || '';
  if (status === 401 && String(url).includes('/auth/login')) return 'E-mail ou senha inválidos.';
  if (status === 401) return 'Sessão expirada. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para acessar esta área.';
  if (status === 404) return 'Rota não encontrada. No teste local, use VITE_API_URL=/api e deixe o backend ligado em http://localhost:3000.';
  if (!err.response && err.message === 'Network Error') return 'Não foi possível conectar ao backend. No teste local, confirme: backend rodando em http://localhost:3000, frontend usando VITE_API_URL=/api e cache/PWA limpo.';
  if (err.code === 'ECONNABORTED') return 'A conexão demorou demais. Verifique se o backend está respondendo.';
  return err.response?.data?.message || err.message || 'Erro inesperado.';
}

function clearAuthStorage() {
  localStorage.removeItem('token'); sessionStorage.removeItem('token'); localStorage.removeItem('user'); sessionStorage.removeItem('user');
}

api.interceptors.request.use((config) => {
  const url = config.url || '';
  if (isPublicAuthRoute(url)) {
    if (config.headers) delete (config.headers as any).Authorization;
    return config;
  }
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) {
    if (!config.headers) config.headers = {} as any;
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error?.config?.url || '';
    if (error?.response?.status === 401 && !isPublicAuthRoute(url)) {
      clearAuthStorage();
      if (window.location.pathname !== '/login') window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

const AuthContext = createContext<AuthContextType | null>(null);
const useAuth = () => useContext(AuthContext)!;

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokenState, setTokenState] = useState(localStorage.getItem('token') || sessionStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const logout = () => { clearAuthStorage(); setUser(null); setTokenState(null); };

  useEffect(() => {
    async function boot() {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await api.get('/auth/me');
        const me = data.user || data;
        const fullUser = { ...me, teacherCode: data.teacherCode };
        setUser(fullUser); setTokenState(token);
      } catch (err) { console.warn('Sessão inválida ou expirada:', err); logout(); }
      finally { setLoading(false); }
    }
    boot();
  }, []);

  const login = async (email: string, password: string, remember: boolean) => {
    const { data } = await api.post('/auth/login', { email, password });
    const storage = remember ? localStorage : sessionStorage;
    clearAuthStorage();
    storage.setItem('token', data.token); storage.setItem('user', JSON.stringify({ ...data.user, teacherCode: data.teacherCode }));
    setUser({ ...data.user, teacherCode: data.teacherCode }); setTokenState(data.token);
  };

  const registerStudent = async (payload: RegisterStudentPayload) => {
    const { data } = await api.post('/auth/register', { ...payload, profile: 'student' });
    clearAuthStorage();
    localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user); setTokenState(data.token);
  };

  return <AuthContext.Provider value={{ user, token: tokenState, loading, login, registerStudent, logout }}>{children}</AuthContext.Provider>;
}

function Splash() {
  return <main className="splash"><div className="orb"/><h1>Neuroformance EA</h1><p>Carregando análise de prontidão e performance...</p></main>;
}

function Protected({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.profile !== profile) return <Navigate to={user.profile === 'teacher' ? '/professor' : '/aluno'} replace />;
  return <>{children}</>;
}

function LoginPage() {
  const { login, registerStudent, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) navigate(user.profile === 'teacher' ? '/professor' : '/aluno', { replace: true }); }, [user, navigate]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'login') await login(email, password, remember);
      else await registerStudent({ name, email, password, teacherCode });
    } catch (err) { setError(messageFromError(err)); }
    finally { setBusy(false); }
  }

  const features = [
    ['◎', 'Acompanhamento em tempo real', 'Monitore a prontidão e o desempenho dos alunos minuto a minuto.'],
    ['♙', 'Visão completa da turma', 'Tenha um panorama claro de todos os alunos e segmentos da sua equipe.'],
    ['⚠', 'Detecção de risco de sobrecarga', 'Identifique sinais de fadiga e risco antes que virem problema.'],
    ['⌁', 'Acompanhamento de adesão', 'Veja quem está engajado e quem precisa de atenção para manter a consistência.'],
    ['ϟ', 'Decisões rápidas e assertivas', 'Indicadores claros para agir no momento certo e obter melhores resultados.'],
    ['♢', 'Segurança dos dados', 'Dados seus e dos seus alunos protegidos com boas práticas.']
  ];

  return <main className="teacherEntrance">
    <div className="teacherEntranceGrid" aria-hidden="true" />
    <section className="teacherEntranceLeft">
      <div className="teacherEntranceBrand">
        <img src="/brand/logo-icon.png" alt="Neuroformance EA" />
        <div>
          <strong>Neuroformance <b>EA</b></strong>
          <small>Sistema de prontidão, reflexo e performance</small>
          <em>by Araújo E.</em>
        </div>
      </div>

      <div className="teacherEntranceHeroText">
        <h1>Acompanhe seus alunos em tempo real e tome <span>decisões melhores em segundos.</span></h1>
        <p>Reduza o trabalho manual e centralize os indicadores essenciais da sua turma em um só lugar. Identifique padrões, antecipe riscos e intervenha com precisão para <b>elevar a performance</b> de cada aluno.</p>
      </div>

      <section className="teacherEntranceDashboardPreview" aria-label="Prévia visual do painel do professor">
        <aside>
          <img src="/brand/logo-icon.png" alt="" />
          <span className="active">▦</span><span>♙</span><span>▥</span><span>◷</span><span>⚙</span>
        </aside>
        <div className="teacherPreviewBody">
          <div className="teacherPreviewTop">
            <div><strong>Visão geral da turma</strong><small>Acompanhe os principais indicadores em tempo real</small></div>
            <button type="button">Turma A</button>
            <span>● Ao vivo</span>
          </div>
          <div className="teacherPreviewCards">
            <article><small>Alunos cadastrados</small><b>48</b><em>100% da turma</em></article>
            <article><small>Registraram hoje</small><b>42</b><em>87% da turma</em></article>
            <article><small>Em risco</small><b className="warn">6</b><em>12% da turma</em></article>
            <article><small>Baixa adesão</small><b className="danger">5</b><em>10% da turma</em></article>
            <article><small>Prontidão média</small><b>7,6</b><em>↑ 0,8 vs ontem</em></article>
          </div>
          <div className="teacherPreviewPanels">
            <div><strong>Evolução da prontidão média</strong><svg viewBox="0 0 500 150" preserveAspectRatio="none"><path d="M0 120 C40 55 80 95 120 62 S200 108 250 74 330 49 390 84 455 39 500 25"/><polyline points="0,120 40,70 80,86 120,62 160,45 205,78 250,74 300,52 350,70 390,84 435,48 500,25"/></svg></div>
            <div><strong>Alertas prioritários</strong><p>⚠ 3 alunos em risco de sobrecarga</p><p>⌁ 2 alunos com baixa adesão</p><p>↘ 1 aluno com queda de prontidão</p></div>
          </div>
        </div>
      </section>
    </section>

    <section className="teacherEntranceFeatures">
      {features.map(([icon, title, text]) => <article key={title}><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div></article>)}
    </section>

    <form className="teacherEntranceCard" onSubmit={submit}>
      <div className="teacherEntranceTabs"><button type="button" className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Entrar</button><button type="button" className={mode==='register'?'active':''} onClick={()=>setMode('register')}>Criar conta</button></div>
      <div className="teacherEntranceAvatar">♙</div>
      <h2>{mode === 'login' ? 'Bem-vindo, professor!' : 'Criar conta de aluno'}</h2>
      <p>{mode === 'login' ? 'Acesse sua conta para continuar.' : 'Cadastre o aluno usando o código do professor.'}</p>
      {mode==='register' && <label>Nome completo<input value={name} onChange={e=>setName(e.target.value)} required placeholder="Nome do aluno" /></label>}
      <label>{mode === 'login' ? 'E-mail profissional' : 'E-mail ou nome do aluno'}<input value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required placeholder={mode === 'login' ? 'seu.email@instituicao.com.br' : 'E-mail ou nome'} /></label>
      <label>Senha<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete={mode==='login'?'current-password':'new-password'} required placeholder="••••••••••••" /></label>
      {mode==='register' && <label>Código do professor<input value={teacherCode} onChange={e=>setTeacherCode(e.target.value)} required placeholder="Ex.: 1" /></label>}
      {mode==='login' && <div className="teacherEntranceOptions"><label className="teacherEntranceCheck"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} /> Lembrar login</label><button type="button" disabled>Esqueci minha senha</button></div>}
      {error && <div className="error">{error}</div>}
      <button className="teacherEntrancePrimary" disabled={busy}>{busy ? 'Processando...' : mode==='login' ? 'Entrar na plataforma' : 'Criar acesso'} <span>→</span></button>
    </form>
  </main>;
}

const hasNumber = (n?: number | null) => n !== null && n !== undefined && Number.isFinite(Number(n));
const pct = (n?: number | null) => hasNumber(n) ? `${Math.round(Number(n))}%` : '—';
const score = (n?: number | null) => hasNumber(n) ? `${Math.round(Number(n))}` : '—';
function safeDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
const brDate = (d?: string) => { const date = safeDate(d); return date ? date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'; };
const brDateTime = (d?: string) => { const date = safeDate(d); return date ? date.toLocaleString('pt-BR') : '—'; };
const hour = (n?: number | null) => hasNumber(n) ? `${Number(n).toFixed(1).replace('.', ',')}h` : '—';
function todayLocalISO() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const year = parts.find(part => part.type === 'year')?.value || '1970';
  const month = parts.find(part => part.type === 'month')?.value || '01';
  const day = parts.find(part => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}
function levelClass(value?: number | null) {
  if (!hasNumber(value)) return 'neutral';
  const v = Number(value);
  if (v >= 70) return 'good';
  if (v >= 55) return 'warn';
  if (v >= 40) return 'low';
  return 'danger';
}
function partClass(value?: number | null, max = 100) { if (!hasNumber(value)) return 'neutral'; return levelClass((Number(value) / max) * 100); }
function levelFromScore(value?: number | null) { if (!hasNumber(value)) return 'Sem dados'; const v = Number(value); return v >= 85 ? 'Excelente' : v >= 70 ? 'Alto' : v >= 55 ? 'Médio' : v >= 40 ? 'Baixo' : 'Crítico'; }
function riskClass(risk?: string | null) { const r = String(risk || '').toLowerCase(); if (!r) return 'neutral'; if (r.includes('crítico') || r.includes('crítica') || r.includes('critico') || r.includes('critica') || r.includes('danger') || r.includes('critical') || r.includes('alto') || r.includes('alta') || r.includes('elevado')) return 'danger'; if (r.includes('warning') || r.includes('moderado') || r.includes('moderada') || r.includes('média') || r.includes('medio') || r.includes('médio')) return 'warn'; if (r.includes('baixo') || r.includes('controlado') || r.includes('normal')) return 'good'; return 'neutral'; }
function scoreValueFromStudent(s: StudentListItem) { if (hasNumber(s.weeklyAverage)) return Number(s.weeklyAverage); if (hasNumber(s.lastRecord?.scoreTotal)) return Number(s.lastRecord.scoreTotal); return undefined; }
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
function normalizeArray<T>(value: any): T[] { return Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.records) ? value.records : []; }
function assertArrayPayload(value: any, routeName: string): any[] {
  const arrayValue = normalizeArray<any>(value);
  if (!Array.isArray(arrayValue)) throw new Error(`Resposta inválida de ${routeName}: era esperado uma lista real.`);
  if (!Array.isArray(value) && !Array.isArray(value?.data) && !Array.isArray(value?.records)) {
    throw new Error(`Resposta inválida de ${routeName}: campo de lista ausente.`);
  }
  return arrayValue;
}
function assertDashboardSummaryPayload(data: any) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.students)) {
    throw new Error('Resposta inválida de /teacher/dashboard-summary: campo students ausente ou não é lista.');
  }
}
function normalizeStudentRecords(d: any): SleepRecord[] { return normalizeArray<SleepRecord>(d?.allRecords || d?.recentRecords || d?.records || d?.sleepRecords || []); }
function explainScorePart(name: string, value?: number) {
  if (!hasNumber(value)) return `${name}: ainda sem dado suficiente.`;
  const v = Math.round(Number(value));
  if (v >= 85) return `${name}: excelente, mantendo padrão forte.`;
  if (v >= 70) return `${name}: bom, mas ainda com margem de ajuste.`;
  if (v >= 55) return `${name}: médio, merece atenção.`;
  if (v >= 40) return `${name}: baixo, provavelmente afetando recuperação.`;
  return `${name}: crítico, precisa de correção prioritária.`;
}
function calcDurationPart(hours?: number | null) { const h = Number(hours); if (!Number.isFinite(h) || h <= 0) return undefined; if (h < 4) return 0; if (h < 5) return 5; if (h < 6) return 10; if (h < 7) return 17; if (h <= 8.5) return 25; if (h <= 9.5) return 22; return 18; }
function calcQualityPart(q?: number | null) { const v = Number(q); if (!Number.isFinite(v) || v <= 0) return undefined; return ({1:5,2:10,3:15,4:20,5:25} as Record<number,number>)[Math.round(v)] ?? undefined; }
function calcContinuityPart(a?: number | null) { const v = Number(a); if (!Number.isFinite(v) || v < 0) return undefined; if (v <= 0) return 20; if (v === 1) return 16; if (v === 2) return 12; if (v === 3) return 8; return 4; }
function calcStatePart(st?: number | null) { const v = Number(st); if (!Number.isFinite(v) || v <= 0) return undefined; return ({1:3,2:6,3:9,4:12,5:15} as Record<number,number>)[Math.round(v)] ?? undefined; }
function partValue(record: SleepRecord | null | undefined, key: keyof SleepRecord, replacementValue?: number) { const raw = record?.[key]; const n = Number(raw); return Number.isFinite(n) && n >= 0 ? n : replacementValue; }
function scoreText(value?: number | null) { return value === null || value === undefined || Number.isNaN(Number(value)) ? 'Sem dado' : `${Math.round(Number(value))}`; }
function studentCardExplanation(s: StudentListItem) {
  const avg = Number(s.weeklyAverage ?? s.lastRecord?.scoreTotal);
  if (!Number.isFinite(avg) || avg <= 0) return 'Sem registros suficientes: precisa marcar sono para gerar score, risco e tendência.';
  if (avg >= 85) return 'Recuperação excelente: manter rotina e observar consistência.';
  if (avg >= 70) return 'Recuperação alta: bom cenário para treinar, com atenção à continuidade.';
  if (avg >= 55) return 'Recuperação média: ajustar sono e controlar intensidade do treino.';
  if (avg >= 40) return 'Recuperação baixa: reduzir cobrança e priorizar recuperação.';
  return 'Recuperação crítica: prioridade máxima para sono e rotina.';
}
function recommendationFromRecord(record?: SleepRecord | null) {
  if (!record) return 'Sem registro: ainda não existe base real para recomendação.';
  const v = Number(record.scoreTotal || 0);
  if (v >= 85) return 'Sono forte: corpo tende a responder bem ao treino planejado.';
  if (v >= 70) return 'Sono bom: seguir treino normal, monitorando fadiga.';
  if (v >= 55) return 'Sono médio: treino moderado e atenção a volume/intensidade.';
  if (v >= 40) return 'Sono baixo: reduzir intensidade e priorizar recuperação.';
  return 'Sono crítico: evitar heroísmo; recuperar primeiro.';
}

function BackButton({ backPath }: { backPath?: string }) {
  const navigate = useNavigate();
  return <button className="ghost small" onClick={() => backPath ? navigate(backPath) : navigate(-1)}>← Voltar</button>;
}

// Tela 404 exibida quando o usuário acessa uma rota inexistente.
function NotFound() {
  const navigate = useNavigate();
  return (
    <main className="app">
      <section className="card" style={{ textAlign: 'center', marginTop: '40px' }}>
        <h2>Página não encontrada</h2>
        <p className="muted">A página que você tentou acessar não existe ou não está disponível.</p>
        <button className="primary" onClick={() => navigate('/login')}>Ir para o login</button>
      </section>
    </main>
  );
}


function StudentAppRedirect() {
  const { user, logout } = useAuth();
  return <main className="app">
    <section className="card" style={{ textAlign: 'center', marginTop: '40px' }}>
      <span className="eyebrow">Área do aluno</span>
      <h2>Use o app do aluno Neuroformance EA</h2>
      <p className="muted">Este painel web foi fechado para uso do professor. As telas antigas do aluno foram bloqueadas para evitar registro em fluxo desatualizado.</p>
      <p className="muted">Conta conectada: <strong>{user?.name}</strong></p>
      <div className="actions" style={{ justifyContent: 'center' }}>
        {STUDENT_APP_URL && <button className="primary" onClick={() => { window.location.href = STUDENT_APP_URL; }}>Abrir app do aluno</button>}
        <button className="secondary" onClick={logout}>Sair</button>
      </div>
    </section>
  </main>;
}

function StudentBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const items = [
    ['/aluno', 'Início'], ['/aluno/registrar', 'Registrar'], ['/aluno/historico', 'Histórico'], ['/aluno/evolucao', 'Gráficos'], ['/aluno/insights', 'Insights'], ['/aluno/perfil', 'Perfil']
  ];
  return <nav className="bottomNav">{items.map(([path,label]) => <button key={path} className={location.pathname===path?'active':''} onClick={()=>navigate(path)}>{label}</button>)}</nav>;
}

function TeacherNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const items = [
    ['/professor','Dashboard'],
    ['/professor/alunos','Alunos'],
    ['/professor/acessos','Acessos'],
    ['/professor/alertas','Alertas']
  ];
  return <nav className="teacherTabs" aria-label="Navegação do professor">{items.map(([path,label]) => <button key={path} className={location.pathname===path?'active':''} onClick={()=>navigate(path)}>{label}</button>)}</nav>;
}

function teacherGreeting() {
  const hourNow = new Date().getHours();
  if (hourNow < 12) return 'Bom dia';
  if (hourNow < 18) return 'Boa tarde';
  return 'Boa noite';
}

function nameInitials(name?: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'P';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
}

const PHOTO_FOLDER = '/fotos';
const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

function avatarUrlFromEntity(entity: any) {
  const candidates = [entity?.photoUrl, entity?.avatarUrl, entity?.profilePhoto, entity?.imageUrl, entity?.picture, entity?.photo, entity?.avatar];
  return candidates.find(value => typeof value === 'string' && value.trim().length > 0);
}

function photoNameFromEntity(entity: any, fallbackName?: string) {
  return String(entity?.name || entity?.studentName || entity?.fullName || fallbackName || '').trim();
}

function photoCandidatesFromName(name?: string) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return [];
  const encodedName = encodeURIComponent(cleanName);
  return PHOTO_EXTENSIONS.map(extension => `${PHOTO_FOLDER}/${encodedName}.${extension}`);
}

function avatarSourcesFromEntity(entity: any, fallbackName?: string) {
  const explicit = avatarUrlFromEntity(entity);
  const namedPhotos = photoCandidatesFromName(photoNameFromEntity(entity, fallbackName));
  return [...(explicit ? [String(explicit).trim()] : []), ...namedPhotos];
}

function EntityAvatar({ entity, size = 'md', className = 'studentAvatar', fallbackName }: { entity: any; size?: 'sm' | 'md' | 'lg' | ''; className?: string; fallbackName?: string }) {
  const displayName = photoNameFromEntity(entity, fallbackName) || fallbackName || 'Usuário';
  const sources = avatarSourcesFromEntity(entity, displayName);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => { setSourceIndex(0); }, [displayName, sources[0] || '']);
  const src = sources[sourceIndex];
  const classes = `${className}${size ? ` ${size}` : ''}`;
  return <div className={classes}>{src ? <img src={src} alt={`Foto de ${displayName}`} onError={() => setSourceIndex(index => index + 1)} /> : <span>{nameInitials(displayName)}</span>}</div>;
}

function StudentAvatar({ student, size = 'md' }: { student: any; size?: 'sm' | 'md' | 'lg' }) {
  return <EntityAvatar entity={student} size={size} className="studentAvatar" fallbackName={student?.name || student?.studentName || 'Aluno'} />;
}

function TeacherProfileAvatar({ user, name }: { user: any; name: string }) {
  return <EntityAvatar entity={{ ...user, name }} size="" className="profileAvatar" fallbackName={name} />;
}

function openStudentInStudentsPage(navigate: (path: string, options?: { state?: any; replace?: boolean }) => void, studentId?: number | string) {
  if (!studentId) return;
  navigate('/professor/alunos', { state: { openStudentId: studentId } });
}

function Shell({ children, title, eyebrow, subtitle, backTo, nav, headerAction }: { children: React.ReactNode; title: string; eyebrow?: string; subtitle?: string; backTo?: string; nav?: React.ReactNode; headerAction?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.profile === 'teacher';
  if (isTeacher) {
    const professorName = user?.name || 'Professor';
    const professorFirstName = String(professorName).trim().split(/\s+/)[0] || 'Professor';
    return <main className="app teacherAppShell">
      <header className="teacherPremiumHeader">
        <div className="teacherHeaderGlow" aria-hidden="true" />
        <section className="teacherHeaderBrand">
          <div className="moonBadge brandImageBadge" aria-hidden="true"><img src="/brand/logo-icon.png" alt="" /></div>
          <div>
            <strong>PAINEL DO<br/>PROFESSOR</strong>
            <small>NEUROFORMANCE EA</small>
          </div>
        </section>
        <section className="teacherHeaderGreeting">
          <h1>{teacherGreeting()}, <b>{professorFirstName}</b></h1>
          <p>Acompanhe prontidão, recuperação e risco dos seus alunos com clareza.</p>
          <div className="statusPill"><span /> MONITORAMENTO ATIVO</div>
        </section>
        <section className="teacherHeaderProfile">
          <div className="teacherHeaderActions teacherHeaderActionsFloating">
            <button className="ghost headerDashboardButton" onClick={() => navigate('/professor')}>Dashboard</button>
            <button className="ghost logoutButton" onClick={logout}>Sair</button>
          </div>
          <div className="profileCapsule">
            <TeacherProfileAvatar user={user} name={professorName} />
            <div>
              <strong>{professorName}</strong>
              <small>Código do Professor: {user?.teacherCode || '—'}</small>
              <em>by Araújo E.</em>
            </div>
          </div>
        </section>
      </header>
      <section className="teacherNavDock">{nav}</section>
      <section className="teacherPageTitle">
        <div>
          <span className="eyebrow">{eyebrow || 'Área do professor'}</span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="teacherPageActions">{backTo !== undefined && <BackButton backPath={backTo}/>} {headerAction}</div>
      </section>
      {children}
    </main>;
  }
  return <main className="app">
    <header className="top">
      <div className="topLeft">{backTo !== undefined && <BackButton backPath={backTo}/>}<div><span className="eyebrow">{eyebrow || 'Área do Aluno'}</span><h1>{title}</h1>{subtitle && <p className="topSubtitle">{subtitle}</p>}</div></div>
      <div className="topActions">{headerAction}<button className="ghost" onClick={logout}>Sair</button></div>
    </header>
    {nav}
    {children}
  </main>;
}

function Kpi({title,value,tone='', hint}:{title:string; value:any; tone?:string; hint?: string}) { return <article className="kpi"><span>{title}</span><strong className={tone}>{value}</strong>{hint && <small>{hint}</small>}</article>; }
function Empty({ text }: { text: string }) { return <p className="muted empty">{text}</p>; }
function LoadingCard() { return <section className="card"><p className="muted">Carregando...</p></section>; }

function metricMax(field: keyof SleepRecord) {
  if (field === 'scoreDuration') return 25;
  if (field === 'scoreQuality') return 25;
  if (field === 'scoreContinuity') return 20;
  if (field === 'scoreState') return 15;
  if (field === 'scoreRegularity') return 15;
  if (field === 'totalHours') return 10;
  if (field === 'perceivedQuality' || field === 'energy' || field === 'mood') return 5;
  return 100;
}
function MiniBars({ data, field, suffix='' }: { data: SleepRecord[]; field: keyof SleepRecord; suffix?: string }) {
  const values = [...data].reverse().filter((record) => hasNumber(Number(record[field]))).slice(-7);
  if (!values.length) return <Empty text="Sem dados para gráfico."/>;
  return <div className="bars">{values.map((r, idx) => {
    const v = Number(r[field]);
    const max = metricMax(field);
    const visualScore = (v / max) * 100;
    return <div className="barWrap" key={`${r.id || recordDateKey(r)}-${idx}`} title={`${brDate(r.date)}: ${v}`}>
      <span className={levelClass(visualScore)} style={{height: `${Math.max(6, Math.min(100, visualScore))}%`}}/>
      <small>{field==='totalHours'?v.toFixed(1):Math.round(v)}{suffix}</small>
    </div>;
  })}</div>;
}

function ScoreGuide() {
  const rows = [ ['85–100','Excelente','Sono forte. Tende a sustentar treino intenso.'], ['70–84','Alto','Bom cenário. Dá para treinar bem, observando fadiga.'], ['55–69','Médio','Zona de atenção. Ajustar volume/intensidade pode ser inteligente.'], ['40–54','Baixo','Recuperação limitada. Melhor evitar heroísmo burro.'], ['0–39','Crítico','Prioridade é recuperar. Treino pesado aqui cobra juros.'] ];
  return <section className="card"><div className="sectionHeader"><div><h3>Como interpretar o score</h3><p>O score resume duração, qualidade, despertares, estado ao acordar e regularidade. Ele não é diagnóstico médico; é um painel prático de recuperação.</p></div></div><div className="scoreTable">{rows.map(([range,name,text])=><div key={range}><strong>{range}</strong><b>{name}</b><span>{text}</span></div>)}</div></section>;
}

function ScoreBreakdown({ record }: { record?: SleepRecord | null }) {
  const duration = partValue(record, 'scoreDuration');
  const quality = partValue(record, 'scoreQuality');
  const continuity = partValue(record, 'scoreContinuity');
  const state = partValue(record, 'scoreState');
  const regularity = partValue(record, 'scoreRegularity');
  const parts = [
    ['Duração', duration, 25, 'Até 25 pontos. Mede se a quantidade de horas ficou dentro de uma faixa útil de recuperação.'],
    ['Qualidade', quality, 25, 'Até 25 pontos. Vem da percepção do aluno sobre a noite, de 1 a 5.'],
    ['Continuidade', continuity, 20, 'Até 20 pontos. Penaliza despertares, porque sono picado cobra imposto.'],
    ['Estado ao acordar', state, 15, 'Até 15 pontos. Mede como o corpo acordou para o dia.'],
    ['Regularidade', regularity, 15, 'Até 15 pontos. Compara o horário com o padrão recente do aluno.'],
  ] as const;
  return <section className="card"><div className="sectionHeader"><div><h3>Explicação dos pontos</h3><p>O score total é formado por cinco blocos. Cada bloco é colorido pela proporção atingida dentro do próprio peso; por isso 25/25, 20/20 e 15/15 aparecem como excelente, não como vermelho.</p></div><b className={levelClass(record?.scoreTotal)}>{record ? `${score(record.scoreTotal)}/100` : 'Sem registro'}</b></div><div className="breakdown">{parts.map(([name,value,max,desc])=><article key={String(name)}><div><strong>{name}</strong><small>{desc}</small>{value !== undefined && <em>{explainScorePart(String(name), Number(value) / Number(max) * 100)}</em>}</div><b className={partClass(value, Number(max))}>{value === undefined ? 'Sem dado' : `${scoreText(value)}/${max}`}</b></article>)}</div></section>;
}

function StudentHome() {
  const { user } = useAuth(); const navigate = useNavigate();
  const [summary, setSummary] = useState<RecoverySummary | null>(null); const [records, setRecords] = useState<SleepRecord[]>([]); const [weekly, setWeekly] = useState<WeeklySummary | null>(null); const [alerts, setAlerts] = useState<AlertItem[]>([]); const [goal, setGoal] = useState<SleepGoal>(null); const [error, setError] = useState(''); const [loading,setLoading]=useState(true);
  async function loadHome(){
    setLoading(true); setError('');
    const res = await Promise.allSettled([api.get('/sleep-records/recovery-summary'), api.get('/sleep-records?days=30'), api.get('/sleep-records/weekly-summary'), api.get('/alerts/mine'), api.get(`/sleep-goals/active?_=${Date.now()}`)]);
    if (res[0].status === 'fulfilled') setSummary(res[0].value.data);
    if (res[1].status === 'fulfilled') setRecords(sortRecordsRecent(normalizeArray<SleepRecord>(res[1].value.data)));
    if (res[2].status === 'fulfilled') setWeekly(res[2].value.data);
    if (res[3].status === 'fulfilled') setAlerts(normalizeArray<AlertItem>(res[3].value.data));
    if (res[4].status === 'fulfilled') setGoal(normalizeGoal(res[4].value.data));
    const rejected = res.find((item) => item.status === 'rejected') as PromiseRejectedResult | undefined;
    if (rejected) setError(messageFromError(rejected.reason));
    setLoading(false);
  }
  useEffect(() => { loadHome(); }, []);
  const last = records[0];
  const hasRecoveryData = Boolean(summary?.hasData || last);
  const readiness = hasRecoveryData ? (summary?.readinessScore ?? summary?.recoveryScore ?? last?.scoreTotal ?? null) : null;
  return <Shell title={`${greeting()}, ${user?.name?.split(' ')[0] || 'aluno'}`} nav={<StudentBottomNav/>}>
    {error && <div className="error">{error}<button type="button" className="secondary smallInline" onClick={loadHome}>Tentar novamente</button></div>}
    {loading ? <LoadingCard/> : <>
    <section className="heroCard premiumHero">
      <div><span className="eyebrow">Nível de Recuperação</span><h2 className={levelClass(summary?.recoveryScore ?? scoreNumberFromRecord(last))}>{summary?.recoveryLevel || (last ? levelFromScore(last.scoreTotal) : 'Sem dados')}</h2><p>{summary?.trainingSuggestion || 'Registre sua primeira noite para liberar uma sugestão automática de recuperação.'}</p><div className="heroMeta"><span>Base: últimas 3 noites + tendência recente</span><span>{alerts.length} alerta(s) ativo(s)</span></div></div>
      <div className="ring" style={{'--value': `${Number(readiness || 0) * 3.6}deg`} as React.CSSProperties}><strong>{pct(readiness)}</strong><small>Prontidão Hoje</small></div>
    </section>
    <section className="kpiGrid"><Kpi title="Prontidão Hoje" value={pct(summary?.readinessScore ?? scoreNumberFromRecord(last))} tone={levelClass(summary?.readinessScore ?? scoreNumberFromRecord(last))} hint="Aptidão prática para render hoje"/><Kpi title="Risco de Cansaço" value={summary?.fatigueRisk || '—'} tone={riskClass(summary?.fatigueRisk)} hint="Estimativa pela tendência do sono"/><Kpi title="Recuperação Corporal" value={summary?.recoveryScore !== null && summary?.recoveryScore !== undefined ? `${summary.recoveryScore}/100` : last ? `${Math.round(last.scoreTotal)}/100` : '—'} tone={levelClass(summary?.recoveryScore ?? scoreNumberFromRecord(last))} hint="Nota central de recuperação"/><Kpi title="Adesão 7 dias" value={weekly?.adherence !== undefined ? pct(weekly.adherence) : `${Math.min(records.length,7)}/7`} hint="Noites registradas"/></section>
    <section className="actions"><button className="primary big" onClick={()=>navigate('/aluno/registrar')}>Registrar Sono Hoje</button><button className="secondary" onClick={()=>navigate('/aluno/historico')}>Histórico</button><button className="secondary" onClick={()=>navigate('/aluno/evolucao')}>Gráficos</button></section>
    <section className="grid2"><section className="card"><h3>Últimas 3 noites</h3><div className="list">{records.slice(0,3).map(r=><button className="row clickable" key={r.id} onClick={()=>navigate(`/aluno/registros/${r.id}`)}><div><strong>{brDate(r.date)}</strong><small>{r.classification} • {hour(r.totalHours)} • qualidade {r.perceivedQuality}/5</small></div><b className={levelClass(r.scoreTotal)}>{score(r.scoreTotal)}</b></button>)}{records.length===0 && <Empty text="Nenhuma noite registrada ainda."/>}</div></section><section className="card"><h3>Meta atual</h3>{goal ? <div className="goalBox"><b>{hour(goal.hoursGoal)}</b><span>Horário alvo: {formatGoalTime(goal.sleepTimeGoal) || '—'} → {formatGoalTime(goal.wakeTimeGoal) || '—'}</span><span>Regularidade: até {goal.regularityGoal || '—'} min de variação</span><small>Meta definida pelo professor.</small></div> : <p className="muted">Nenhuma meta ativa definida pelo professor.</p>}</section></section>
    <ScoreBreakdown record={last}/>
    <ScoreGuide/>
    </>}
  </Shell>;
}

function formatGoalTime(value?: string) {
  if (!value) return '';
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const d = safeDate(value);
  if (!d) return '';
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function SleepForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const today = todayLocalISO();
  const editId = new URLSearchParams(location.search).get('edit');
  const [form, setForm] = useState({ date: today, sleepTime: '23:00', wakeTime: '07:00', perceivedQuality: 3, awakenings: 0, morningState: 3, energy: 3, mood: 3, stress: 3, timeToSleep: 20, nap: false, caffeine: false, alcohol: false, screenBeforeSleep: false, pain: false, notes: '' });
  const [status, setStatus] = useState<'idle'|'loading'|'saving'|'done'>('idle');
  const [error, setError] = useState('');
  const [duplicateDate, setDuplicateDate] = useState('');
  const totalHours = useMemo(() => calcHours(form.sleepTime, form.wakeTime), [form.sleepTime, form.wakeTime]);
  const set = (k:string,v:any)=>setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    if(!editId) return;
    setStatus('loading');
    setError('');
    api.get(`/sleep-records/${editId}`).then(({data})=>{
      setForm({
        date: String(data.date || today).slice(0,10),
        sleepTime: formatGoalTime(data.sleepTime) || '23:00',
        wakeTime: formatGoalTime(data.wakeTime) || '07:00',
        perceivedQuality: Number(data.perceivedQuality ?? 3),
        awakenings: Number(data.awakenings ?? 0),
        morningState: Number(data.morningState ?? 3),
        energy: Number(data.energy ?? 3),
        mood: Number(data.mood ?? 3),
        stress: Number(data.stress ?? 3),
        timeToSleep: Number(data.timeToSleep ?? 20),
        nap: Boolean(data.nap),
        caffeine: Boolean(data.caffeine),
        alcohol: Boolean(data.alcohol),
        screenBeforeSleep: Boolean(data.screenBeforeSleep),
        pain: Boolean(data.pain),
        notes: String(data.notes || '')
      });
    }).catch(err=>setError(messageFromError(err))).finally(()=>setStatus('idle'));
  },[editId]);

  function validateSleepForm() {
    if(!form.date) return 'Informe a data da noite de sono.';
    if(form.date > today) return 'Não é permitido registrar sono em data futura.';
    if(!/^\d{2}:\d{2}$/.test(form.sleepTime) || !/^\d{2}:\d{2}$/.test(form.wakeTime)) return 'Informe horários válidos para dormir e acordar.';
    if(totalHours < 1 || totalHours > 18) return 'A duração do sono deve ficar entre 1h e 18h.';
    if(form.perceivedQuality < 1 || form.perceivedQuality > 5) return 'Qualidade percebida deve ficar entre 1 e 5.';
    if(form.awakenings < 0 || form.awakenings > 20) return 'Despertares deve ficar entre 0 e 20.';
    if(form.morningState < 1 || form.morningState > 5) return 'Estado ao acordar deve ficar entre 1 e 5.';
    if(form.energy < 0 || form.energy > 5) return 'Energia deve ficar entre 0 e 5.';
    if(form.notes.length > 1000) return 'Notas devem ter no máximo 1000 caracteres.';
    return '';
  }

  async function findExistingRecordByDate(date: string) {
    try {
      const params = new URLSearchParams({ start: date, end: date });
      const { data } = await api.get(`/sleep-records?${params.toString()}`);
      const records = normalizeArray<SleepRecord>(data);
      return records.find(r=>recordDateKey(r) === date) || records[0] || null;
    } catch (err) { setError(messageFromError(err)); return null; }
  }

  async function openExistingRecord() {
    const existing = await findExistingRecordByDate(duplicateDate || form.date);
    if (existing?.id) navigate(`/aluno/registrar?edit=${existing.id}`);
    else navigate('/aluno/historico');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setError('');
    setDuplicateDate('');
    const validation = validateSleepForm();
    if(validation){ setError(validation); setStatus('idle'); return; }
    try {
      const { data } = editId ? await api.put(`/sleep-records/${editId}`, form) : await api.post('/sleep-records', form);
      setStatus('done');
      const savedId = data?.id || editId;
      setTimeout(()=> savedId ? navigate(`/aluno/registros/${savedId}`) : navigate('/aluno'), 650);
    } catch(err) {
      const msg = messageFromError(err);
      const duplicate = /exist|duplic|já|ja|data/i.test(msg);
      if(duplicate) setDuplicateDate(form.date);
      setError(duplicate ? 'Já existe um registro para essa data. Abra o registro existente para editar em vez de criar outro.' : msg);
      setStatus('idle');
    }
  }

  if(status==='loading') return <Shell title="Registrar Sono" backTo="/aluno" nav={<StudentBottomNav/>}><LoadingCard/></Shell>;
  return <Shell title={editId ? 'Editar Sono' : 'Registrar Sono'} backTo="/aluno" nav={<StudentBottomNav/>}>
    <form className="formCard richForm" onSubmit={submit}>
      <section className="formIntro"><div><span className="eyebrow">{editId ? 'Edição de registro' : 'Registro diário'}</span><h2>Noite de sono</h2><p>Depois de salvar, o app abre o detalhe da noite salva para confirmar que o registro entrou no histórico.</p></div><div className="totalBox"><span>Total estimado</span><b>{hour(totalHours)}</b></div></section>
      <div className="two"><Field label="Data" hint="A data da noite que está sendo registrada."><input type="date" value={form.date} max={today} onChange={e=>set('date',e.target.value)} /></Field><Field label="Tempo para pegar no sono" hint="Minutos aproximados até dormir."><input type="number" min="0" max="240" value={form.timeToSleep} onChange={e=>set('timeToSleep',Number(e.target.value))} /></Field><Field label="Hora que dormiu" hint="Horário aproximado em que pegou no sono."><input type="time" value={form.sleepTime} onChange={e=>set('sleepTime',e.target.value)} /></Field><Field label="Hora que acordou" hint="Horário final do sono principal."><input type="time" value={form.wakeTime} onChange={e=>set('wakeTime',e.target.value)} /></Field></div>
      <div className="selectorGrid"><NumberSelector label="Qualidade percebida" hint="1 péssima · 5 excelente" options={[1,2,3,4,5]} value={form.perceivedQuality} onChange={v=>set('perceivedQuality',v)} /><NumberSelector label="Despertares" hint="Quantas vezes acordou durante a noite" options={[0,1,2,3,4,5,6,7,8,9,10]} value={form.awakenings} onChange={v=>set('awakenings',v)} /><NumberSelector label="Como acordou" hint="1 destruído · 5 renovado" options={[1,2,3,4,5]} value={form.morningState} onChange={v=>set('morningState',v)} /><NumberSelector label="Energia" hint="0 sem energia · 5 alta energia" options={[0,1,2,3,4,5]} value={form.energy} onChange={v=>set('energy',v)} /><NumberSelector label="Humor" hint="1 ruim · 5 ótimo" options={[1,2,3,4,5]} value={form.mood} onChange={v=>set('mood',v)} /><NumberSelector label="Estresse" hint="1 baixo · 5 alto" options={[1,2,3,4,5]} value={form.stress} onChange={v=>set('stress',v)} /></div>
      <section className="toggleGrid"><Toggle label="Cochilo" value={form.nap} onChange={v=>set('nap',v)} /><Toggle label="Cafeína à noite" value={form.caffeine} onChange={v=>set('caffeine',v)} /><Toggle label="Álcool" value={form.alcohol} onChange={v=>set('alcohol',v)} /><Toggle label="Tela antes de dormir" value={form.screenBeforeSleep} onChange={v=>set('screenBeforeSleep',v)} /><Toggle label="Dor ao acordar" value={form.pain} onChange={v=>set('pain',v)} /></section>
      <Field label="Notas opcionais" hint="Contexto livre: treino pesado, ansiedade, viagem, doença, dor, etc."><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} maxLength={1000} placeholder="Algo importante sobre a noite?" /></Field>
      {error && <div className="error">{error}{duplicateDate && <button type="button" className="secondary smallInline" onClick={openExistingRecord}>Abrir registro existente</button>}</div>}{status==='done' && <div className="success">Registro salvo com sucesso. Abrindo o detalhe da noite...</div>}
      <button className="primary big" disabled={status==='saving'}>{status==='saving'?'Salvando...': editId ? 'Salvar alterações' : 'Salvar e ver resultado'}</button>
      <p className="muted disclaimer">Este app acompanha padrões de sono e recuperação. Não substitui avaliação médica.</p>
    </form>
  </Shell>;
}
function calcHours(sleep: string, wake: string) {
  const [sh,sm]=sleep.split(':').map(Number);
  const [wh,wm]=wake.split(':').map(Number);
  if (![sh,sm,wh,wm].every(Number.isFinite)) return 0;
  let start=sh*60+sm; let end=wh*60+wm; if(end<=start) end+=1440; return (end-start)/60;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function Slider({label,hint,min,max,value,onChange}:{label:string;hint?:string;min:number;max:number;value:number;onChange:(v:number)=>void}) { return <label className="slider"><span>{label}<b>{value}</b></span><input type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))}/>{hint && <small>{hint}</small>}</label>; }
function NumberSelector({label,hint,options,value,onChange}:{label:string;hint?:string;options:number[];value:number;onChange:(v:number)=>void}) { return <div className="numberSelector"><div><strong>{label}</strong><b>{value}</b></div><div className="numberOptions">{options.map(option=><button type="button" key={option} className={option===value?'selected':''} onClick={()=>onChange(option)}>{option}</button>)}</div>{hint && <small>{hint}</small>}</div>; }
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) { return <button type="button" className={`toggle ${value ? 'on' : ''}`} onClick={()=>onChange(!value)}><span>{label}</span><b>{value ? 'Sim' : 'Não'}</b></button>; }

function HistoryPage() {
  const [records,setRecords]=useState<SleepRecord[]>([]);
  const [filter,setFilter]=useState<'7'|'30'|'all'>('7');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const navigate=useNavigate();

  async function loadHistory(){
    setLoading(true); setError('');
    try {
      const query = filter==='all'?'':`?days=${filter}`;
      const { data } = await api.get(`/sleep-records${query}`);
      setRecords(sortRecordsRecent(normalizeArray<SleepRecord>(data)));
    } catch(err) {
      setError(messageFromError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ loadHistory(); },[filter]);

  return <Shell title="Histórico" backTo="/aluno" nav={<StudentBottomNav/>}>
    <section className="card">
      <div className="sectionHeader">
        <div><h3>Registros de sono</h3><p>Toque em uma noite para ver detalhes e composição do score.</p></div>
        <div className="segmented compact"><button className={filter==='7'?'active':''} onClick={()=>setFilter('7')}>7 dias</button><button className={filter==='30'?'active':''} onClick={()=>setFilter('30')}>30 dias</button><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Tudo</button></div>
      </div>
      {error && <div className="error">{error}<button type="button" className="secondary smallInline" onClick={loadHistory}>Tentar novamente</button></div>}
      {loading ? <p className="muted">Carregando...</p> : <div className="list">{records.map(r=><button className="row clickable" key={r.id || recordDateKey(r)} onClick={()=>navigate(`/aluno/registros/${r.id}`)} disabled={!r.id}><div><strong>{brDate(r.date)}</strong><small>{r.classification || 'Sem classificação'} • {hour(r.totalHours)} • despertares {hasNumber(r.awakenings) ? r.awakenings : '—'}</small></div><b className={levelClass(r.scoreTotal)}>{score(r.scoreTotal)}</b></button>)}{!records.length && <Empty text="Nenhum registro encontrado."/>}</div>}
    </section>
  </Shell>;
}

function Evolution() {
  const [records,setRecords]=useState<SleepRecord[]>([]);
  const [weekly,setWeekly]=useState<WeeklySummary | null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);

  async function loadEvolution(){
    setLoading(true); setError('');
    const [a,b] = await Promise.allSettled([api.get('/sleep-records?days=30'), api.get('/sleep-records/weekly-summary')]);
    if(a.status==='fulfilled') setRecords(sortRecordsRecent(normalizeArray<SleepRecord>(a.value.data)));
    if(b.status==='fulfilled') setWeekly(b.value.data);
    const rejected = [a,b].find((item) => item.status === 'rejected') as PromiseRejectedResult | undefined;
    if(rejected) setError(messageFromError(rejected.reason));
    setLoading(false);
  }

  useEffect(()=>{ loadEvolution(); },[]);

  return <Shell title="Gráficos" backTo="/aluno" nav={<StudentBottomNav/>}>
    {error && <div className="error">{error}<button type="button" className="secondary smallInline" onClick={loadEvolution}>Tentar novamente</button></div>}
    {loading ? <LoadingCard/> : <>
      <section className="kpiGrid"><Kpi title="Média do score" value={hasNumber(weekly?.averageScore) ? pct(weekly?.averageScore) : '—'} /><Kpi title="Horas médias" value={hasNumber(weekly?.averageHours) ? hour(weekly?.averageHours) : '—'} /><Kpi title="Energia média" value={hasNumber(weekly?.averageEnergy) ? score(weekly?.averageEnergy) : '—'} /><Kpi title="Tendência" value={weekly?.trend || '—'} /></section>
      <section className="card"><h3>Score — últimos 7 dias</h3><MiniBars data={records.slice(0,7)} field="scoreTotal" /></section>
      <section className="card"><h3>Horas — últimos 7 dias</h3><MiniBars data={records.slice(0,7)} field="totalHours" suffix="h" /></section>
      <section className="card"><h3>Energia — últimos 7 dias</h3><MiniBars data={records.slice(0,7)} field="energy" /></section>
      <section className="card"><h3>Regularidade — últimos 7 dias</h3><MiniBars data={records.slice(0,7)} field="scoreRegularity" /></section>
      <ScoreGuide/>
    </>}
  </Shell>;
}

function SleepRecordDetail(){
  const {id}=useParams();
  const navigate=useNavigate();
  const [record,setRecord]=useState<SleepRecord | null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{setLoading(true); setError(''); api.get(`/sleep-records/${id}`).then(r=>setRecord(r.data)).catch(err=>setError(messageFromError(err))).finally(()=>setLoading(false));},[id]);
  if(loading) return <Shell title="Detalhe do registro" backTo="/aluno/historico" nav={<StudentBottomNav/>}><LoadingCard/></Shell>;
  if(error) return <Shell title="Detalhe do registro" backTo="/aluno/historico" nav={<StudentBottomNav/>}><div className="error">{error}</div></Shell>;
  if(!record) return <Shell title="Detalhe do registro" backTo="/aluno/historico" nav={<StudentBottomNav/>}><Empty text="Registro não encontrado."/></Shell>;
  return <Shell title={`Noite de ${brDate(record.date)}`} backTo="/aluno/historico" nav={<StudentBottomNav/>}>
    <section className="heroCard"><div><span className="eyebrow">Score da noite</span><h2 className={levelClass(record.scoreTotal)}>{score(record.scoreTotal)} pontos</h2><p>{record.classification} • {hour(record.totalHours)} dormidas • {record.awakenings} despertar(es)</p></div><div className="stackActions"><button className="secondary" onClick={()=>navigate(`/aluno/registrar?edit=${record.id}`)}>Editar esta noite</button><button className="ghost" onClick={()=>navigate('/aluno/registrar')}>Novo registro</button></div></section>
    <section className="kpiGrid"><Kpi title="Qualidade" value={`${record.perceivedQuality}/5`} /><Kpi title="Estado ao acordar" value={`${record.morningState ?? '—'}/5`} /><Kpi title="Energia" value={`${record.energy ?? '—'}/5`} /><Kpi title="Humor" value={`${record.mood ?? '—'}/5`} /></section>
    <ScoreBreakdown record={record}/>
    {record.notes && <section className="card"><h3>Observação</h3><p>{record.notes}</p></section>}
  </Shell>;
}
function Insights(){
  const [items,setItems]=useState<InsightItem[]>([]);
  const [alerts,setAlerts]=useState<AlertItem[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);

  async function loadInsights(){
    setLoading(true); setError('');
    const [a,b]=await Promise.allSettled([api.get('/insights/mine'), api.get('/alerts/mine')]);
    if(a.status==='fulfilled') setItems(normalizeArray<InsightItem>(a.value.data));
    if(b.status==='fulfilled') setAlerts(normalizeArray<AlertItem>(b.value.data));
    const rejected = [a,b].find((item) => item.status === 'rejected') as PromiseRejectedResult | undefined;
    if(rejected) setError(messageFromError(rejected.reason));
    setLoading(false);
  }

  useEffect(()=>{ loadInsights(); },[]);

  return <Shell title="Insights" backTo="/aluno" nav={<StudentBottomNav/>}>
    {error && <div className="error">{error}<button type="button" className="secondary smallInline" onClick={loadInsights}>Tentar novamente</button></div>}
    {loading ? <LoadingCard/> : <>
      <section className="card"><h3>Insights automáticos</h3><div className="list">{items.map((it,idx)=> typeof it==='string' ? <div className="row" key={idx}><span>{it}</span></div> : <div className="row" key={idx}><div><strong>{it.title || it.type || 'Insight'}</strong><small>{it.message || it.description}</small></div><b className={riskClass(it.level)}>{it.level || ''}</b></div>)}{!items.length && <Empty text="Ainda sem insight suficiente. Registre mais noites."/>}</div></section>
      <section className="card"><h3>Alertas</h3><div className="list">{alerts.map(a=><div className="row" key={a.id}><div><strong>{a.type || 'Alerta'}</strong><small>{a.description}</small></div><b className={riskClass(a.level)}>{a.level}</b></div>)}{!alerts.length && <Empty text="Nenhum alerta ativo."/>}</div></section>
    </>}
  </Shell>;
}
function StudentProfile(){ const {user}=useAuth(); return <Shell title="Perfil" backTo="/aluno" nav={<StudentBottomNav/>}><section className="card profile"><h3>{user?.name}</h3><p>{user?.email}</p><p className="muted">Conta de aluno vinculada ao professor.</p></section><section className="card"><h3>Acesso rápido</h3><p className="muted">As metas são definidas pelo professor. O aluno acompanha a meta ativa na tela inicial.</p><div className="actions"><button className="secondary" onClick={()=>location.href='/aluno/insights'}>Insights</button><button className="secondary" onClick={()=>location.href='/aluno/historico'}>Histórico</button><button className="secondary" onClick={()=>location.href='/aluno/evolucao'}>Gráficos</button></div></section></Shell>; }

function isValidNumber(value: any) { return value !== null && value !== undefined && Number.isFinite(Number(value)); }
function safeScore(value: any) { const n = Number(value); return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined; }
function safeMetricNumber(value: any) { const n = Number(value); return Number.isFinite(n) ? n : undefined; }
function normalizeLocalDate(value?: string | Date | null) {
  if (!value) return null;
  if (typeof value === 'string') { const direct = value.match(/^(\d{4}-\d{2}-\d{2})/); if (direct) return direct[1]; }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value || '1970';
  const month = parts.find(part => part.type === 'month')?.value || '01';
  const day = parts.find(part => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}
function isToday(value?: string | Date | null) { return normalizeLocalDate(value) === todayLocalISO(); }
function localDaysAgoISO(days: number) { const base = new Date(`${todayLocalISO()}T12:00:00`); base.setDate(base.getDate() - Math.max(0, days)); return `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`; }
function expectedSleepCheckInDateISO() { return localDaysAgoISO(1); }
function isExpectedSleepCheckInRecordDate(value?: string | Date | null) { return normalizeLocalDate(value) === expectedSleepCheckInDateISO(); }
function getStudentRecords(student: DashboardStudent | StudentListItem | any): SleepRecord[] {
  const possible = normalizeArray<SleepRecord>(student?.allRecords || student?.records || student?.recentRecords || student?.sleepRecords || []);
  const last = student?.lastRecord ? [student.lastRecord as SleepRecord] : [];
  const byKey = new Map<string, SleepRecord>();
  [...possible, ...last].forEach((record, idx) => { const key = record?.id ? `id-${record.id}` : `${normalizeLocalDate(record?.date) || 'sem-data'}-${idx}`; if (record && normalizeLocalDate(record.date)) byKey.set(key, record); });
  return sortRecordsRecent([...byKey.values()]);
}
function getLastValidRecords(records: SleepRecord[], limit = 3) { return sortRecordsRecent(records).filter(record => normalizeLocalDate(record.date) && safeScore(record.scoreTotal) !== undefined).slice(0, limit); }
function getRecordsLastDays(records: SleepRecord[], days: number) { const start = localDaysAgoISO(days - 1); const today = todayLocalISO(); return sortRecordsRecent(records).filter(record => { const key = normalizeLocalDate(record.date); return !!key && key >= start && key <= today; }); }
function averageScores(records: SleepRecord[]) { const scores = records.map(record => safeScore(record.scoreTotal)).filter((value): value is number => value !== undefined); return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : undefined; }
function averageSleepHours(records: SleepRecord[]) { const hours = records.map(record => safeMetricNumber(record.totalHours)).filter((value): value is number => value !== undefined && value >= 0); return hours.length ? hours.reduce((sum, value) => sum + value, 0) / hours.length : undefined; }
function getLatestRecord(records: SleepRecord[]) { return sortRecordsRecent(records).find(record => normalizeLocalDate(record.date)); }
function daysSinceRecord(record?: SleepRecord | null) { const key = normalizeLocalDate(record?.date); if (!key) return Number.POSITIVE_INFINITY; const start = new Date(`${key}T12:00:00`); const end = new Date(`${todayLocalISO()}T12:00:00`); return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)); }
function getStudentSearchText(student: StudentListItem) { return normalizeText(`${student.name || ''} ${student.email || ''} ${student.login || ''} ${student.username || ''}`); }
function getReadinessScore(student: DashboardStudent) {
  const candidates = [(student as any).readinessScore, (student as any).readiness, (student as any).prontidao, (student as any).recoverySummary?.readinessScore, (student as any).summary?.readinessScore];
  const direct = candidates.map(safeScore).find(value => value !== undefined);
  return direct;
}
function countTodayRegistrations(students: DashboardStudent[]) { return students.filter(student => getStudentRecords(student).some(record => isExpectedSleepCheckInRecordDate(record.date))); }
function calculateRiskStudents(students: DashboardStudent[]) { return students.filter(student => { const lastValid = getLastValidRecords(getStudentRecords(student), 3); const avg = averageScores(lastValid); const latestScore = safeScore(lastValid[0]?.scoreTotal); return (avg !== undefined && avg < 55) || (latestScore !== undefined && latestScore < 40); }); }
function calculateLowAdherence(students: DashboardStudent[]) { const entries = students.map(student => ({ student, count: getRecordsLastDays(getStudentRecords(student), 7).length })); return { low: entries.filter(item => item.count < 3), critical: entries.filter(item => item.count === 0) }; }
function calculateFatigueRisk(student: DashboardStudent): FatigueResult {
  const lastThree = getLastValidRecords(getStudentRecords(student), 3).reverse();
  if (lastThree.length < 3) return { riskFinal: null, level: 'dados insuficientes', reason: 'Menos de 3 registros válidos com score.' };
  const scores = lastThree.map(record => safeScore(record.scoreTotal)).filter((value): value is number => value !== undefined);
  const energy = safeMetricNumber(lastThree[lastThree.length - 1]?.energy);
  if (scores.length < 3) return { riskFinal: null, level: 'dados insuficientes', reason: 'Scores insuficientes.' };
  if (energy === undefined || energy < 1 || energy > 5) return { riskFinal: null, level: 'dados insuficientes', media: scores.reduce((sum, value) => sum + value, 0) / scores.length, reason: 'Energia ausente no registro mais recente.' };
  const media = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const risco1 = 100 - media;
  const risco2 = Math.max(0, Math.min(((scores[0] - scores[scores.length - 1]) / 20) * 100, 100));
  const risco3 = Math.max(0, Math.min(((5 - energy) / 4) * 100, 100));
  const riskFinal = (risco1 * 0.50) + (risco2 * 0.30) + (risco3 * 0.20);
  const level = riskFinal > 75 ? 'elevado/crítico' : riskFinal >= 60 ? 'alto' : riskFinal >= 40 ? 'moderado' : 'baixo';
  return { riskFinal, level, media, risco1, risco2, risco3 };
}
function calculateGoalNotMet(student: DashboardStudent): GoalNotMetResult {
  const goalHours = safeMetricNumber(student.activeGoal?.hoursGoal);
  if (!student.activeGoal || goalHours === undefined) return { hasGoal: false, isNotMet: false, severeDeficit: false, averageHours: null, goalHours: null, baseReduced: false, recordsUsed: 0 };
  const weekRecords = getRecordsLastDays(getStudentRecords(student), 7).filter(record => safeMetricNumber(record.totalHours) !== undefined);
  const avgHours = averageSleepHours(weekRecords);
  if (avgHours === undefined) return { hasGoal: true, isNotMet: false, severeDeficit: false, averageHours: null, goalHours, baseReduced: false, recordsUsed: 0 };
  return { hasGoal: true, isNotMet: avgHours < goalHours, severeDeficit: avgHours < goalHours - 1, averageHours: avgHours, goalHours, baseReduced: false, recordsUsed: weekRecords.length };
}

function toneFromCount(count: number, total: number) { if (count <= 0) return 'good'; const ratio = total ? count / total : 0; if (ratio >= 0.35) return 'danger'; if (ratio >= 0.15) return 'low'; return 'warn'; }
function severityTone(level?: string) { return riskClass(level || ''); }
function fatigueText(result?: FatigueResult) { return result?.riskFinal === null || !result ? 'Dados insuficientes' : `${Math.round(result.riskFinal)}/100`; }
function TeacherDonut({ value, total, tone = 'good' }: { value: number; total: number; tone?: string }) { const pctValue = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0; return <div className={`teacherDonut ${tone}`} style={{ '--value': `${pctValue * 3.6}deg` } as React.CSSProperties}><strong>{value}/{total}</strong><small>{Math.round(pctValue)}%</small></div>; }
function TeacherMetricCard({ title, value, description, tone = '', children, onClick, action }: { title: string; value: React.ReactNode; description: string; tone?: string; children?: React.ReactNode; onClick?: () => void; action?: string }) { return <article className={`teacherMetricCard ${tone} ${onClick ? 'clickableCard' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={e=>{ if(onClick && (e.key === 'Enter' || e.key === ' ')) onClick(); }}><div className="metricTop"><span>{title}</span>{action && <button type="button" className="ghost tiny" onClick={(e)=>{e.stopPropagation(); onClick?.();}}>{action}</button>}</div><strong className="metricValue">{value}</strong><p>{description}</p>{children}</article>; }
function TeacherDashboardModal({ modal, onClose }: { modal: DashboardModalState; onClose: () => void }) { if (!modal) return null; return <div className="modalOverlay" role="dialog" aria-modal="true"><section className="modalCard teacherModal"><div className="sectionHeader"><div><span className="eyebrow">Detalhamento</span><h3>{modal.title}</h3>{modal.description && <p>{modal.description}</p>}</div><button className="ghost small" onClick={onClose}>Fechar</button></div><div className="list">{modal.items.length ? modal.items : [<Empty key="empty" text="Nenhum aluno nesta regra agora."/>]}</div></section></div>; }
function studentSummaryRow(student: DashboardStudent, openStudent: (studentId: number | string | undefined) => void, extra?: React.ReactNode) { const records = getStudentRecords(student); const latest = getLatestRecord(records); const avg = safeScore((student as any).averageLast3Score) ?? averageScores(getLastValidRecords(records, 3)); return <button className="studentRow" key={`${student.id}-${String(extra)}`} onClick={()=>openStudent(student.id)}><StudentAvatar student={student} size="sm"/><div><strong>{student.name}</strong><small>{student.email || student.login || student.username || 'sem e-mail/login'} • último registro {latest ? brDate(latest.date) : 'sem registro'}{avg !== undefined ? ` • média ${score(avg)}` : ''}</small>{extra && <em>{extra}</em>}</div><b className={levelClass(avg ?? latest?.scoreTotal)}>{avg !== undefined ? score(avg) : score(latest?.scoreTotal)}</b></button>; }
function severityToLevel(severity?: string) {
  const value = String(severity || '').toLowerCase();
  if (value === 'critical') return 'crítica';
  if (value === 'high') return 'alta';
  if (value === 'moderate') return 'moderada';
  if (value === 'low') return 'baixa';
  return severity;
}
function backendAlertToDashboard(alert: AlertItem): AlertItem {
  const raw = alert as any;
  return {
    ...alert,
    source: 'backend' as const,
    description: alert.description || raw.message || raw.title || raw.type || 'Alerta do backend',
    level: alert.level || severityToLevel(alert.severity) || alert.status || 'moderada',
    action: alert.action || raw.actionSuggestion,
    date: alert.date || raw.createdAt,
  };
}
function alertIdentityKey(alert: AlertItem) {
  const owner = alert.studentId ? `id:${alert.studentId}` : `name:${normalizeText(alert.studentName || '')}`;
  const type = normalizeText(alert.type || '');
  if (type) return `${owner}|type:${type}`;
  const description = normalizeText(alert.description || 'sem_descricao').slice(0, 120);
  return `${owner}|desc:${description}`;
}
function dedupeAlerts(alerts: AlertItem[]) {
  const map = new Map<string, AlertItem>();
  alerts.forEach((alert, index) => {
    const normalized = { ...alert, id: alert.id || `alerta-${index}`, level: alert.level || alert.severity || alert.status || 'moderada' };
    const key = alertIdentityKey(normalized);
    const existing = map.get(key);
    if (!existing || existing.source !== 'backend') map.set(key, normalized);
  });
  return [...map.values()];
}
function attachStudentIdToBackendAlerts(alerts: AlertItem[], students: DashboardStudent[]) {
  return alerts.map(alert => {
    const matched = students.find(student =>
      Number((alert as any).studentId) === student.id ||
      normalizeText(student.name) === normalizeText(alert.studentName || '') ||
      normalizeText(student.email) === normalizeText((alert as any).studentEmail || '')
    );
    return { ...alert, studentId: alert.studentId || matched?.id, studentName: alert.studentName || matched?.name };
  });
}
function collectTeacherAlerts(students: DashboardStudent[], backendAlerts: AlertItem[]) {
  const backend = attachStudentIdToBackendAlerts(backendAlerts.map(backendAlertToDashboard), students);
  return dedupeAlerts(backend);
}

function normalizeTeacherSummaryStudent(raw: any): DashboardStudent {
  const recentRecords = normalizeArray<SleepRecord>(raw?.recentRecords || []);
  const recordsLast7Days = normalizeArray<SleepRecord>(raw?.recordsLast7Days || []);
  const activeGoal = normalizeGoal(raw?.activeSleepGoal || raw?.activeGoal);
  const alertList = normalizeArray<AlertItem>(raw?.alerts || []).map(backendAlertToDashboard);
  const mergedRecords = getStudentRecords({ ...raw, recentRecords, recordsLast7Days, activeGoal } as DashboardStudent);
  const weeklyAverage = safeScore(raw?.averageLast7Score) ?? safeScore(raw?.averageLast3Score) ?? safeScore(raw?.weeklyAverage);
  const lastScore = safeScore(raw?.lastRecord?.scoreTotal ?? raw?.lastRecord?.score);
  const lifecycleStatus = raw?.studentStatus || raw?.status || 'active';
  const trackingStatus = raw?.trackingStatus || (raw?.registeredToday ? 'check-in do dia' : raw?.lastRecord ? 'com registro' : 'sem dados');
  return {
    ...raw,
    id: Number(raw?.id),
    name: raw?.name || raw?.studentName || 'Aluno',
    email: raw?.email || '',
    login: raw?.login,
    username: raw?.username,
    weeklyAverage,
    monthlyAverage: safeScore(raw?.averageLast3Score) ?? safeScore(raw?.monthlyAverage) ?? weeklyAverage,
    lastRecord: raw?.lastRecord || null,
    recentRecords,
    records: mergedRecords,
    allRecords: mergedRecords,
    activeGoal,
    alerts: alertList,
    adherence: hasNumber(raw?.adherence) ? Number(raw.adherence) : recordsLast7Days.length ? Math.min(100, (recordsLast7Days.length / 7) * 100) : 0,
    alertCount: hasNumber(raw?.alertCount) ? Number(raw.alertCount) : alertList.length,
    status: lifecycleStatus,
    studentStatus: lifecycleStatus,
    trackingStatus,
    priority: raw?.priority || (raw?.isRiskStudent ? 'alta' : raw?.isLowAdherence ? 'moderada' : lastScore !== undefined && lastScore >= 70 ? 'normal' : 'acompanhamento'),
    risk: raw?.risk || (raw?.isRiskStudent || raw?.fatigueRiskLevel === 'alto' || raw?.fatigueRiskLevel === 'elevado' ? 'Alto' : raw?.fatigueRiskLevel || 'Controlado'),
    recommendation: raw?.recommendation || (raw?.isRiskStudent ? 'Aluno exige atenção pelo score recente.' : 'Acompanhar rotina e evolução de sono.'),
  } as DashboardStudent;
}

async function loadTeacherDashboardSummary() {
  const { data } = await api.get('/teacher/dashboard-summary');
  assertDashboardSummaryPayload(data);
  const students: DashboardStudent[] = data.students.map(normalizeTeacherSummaryStudent);
  const backendAlerts = students.flatMap(student => normalizeArray<AlertItem>(student.alerts || [])).map(backendAlertToDashboard);
  return { data, students, backendAlerts };
}

async function loadTeacherStudentsList() {
  const summary = await loadTeacherDashboardSummary();
  return summary.students;
}

function TeacherDashboard() {
  const [data,setData]=useState<any>(null);
  const [students,setStudents]=useState<DashboardStudent[]>([]);
  const [backendAlerts,setBackendAlerts]=useState<AlertItem[]>([]);
  const [search,setSearch]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState<DashboardModalState>(null);
  const navigate=useNavigate();
  const openStudent = (studentId: number | string | undefined) => openStudentInStudentsPage(navigate, studentId);

  async function loadDashboard(){
    setLoading(true); setError('');
    try {
      const summary = await loadTeacherDashboardSummary();
      setData(summary.data);
      setStudents(summary.students);
      setBackendAlerts(summary.backendAlerts);
    } catch (summaryError) {
      setData(null);
      setStudents([]);
      setBackendAlerts([]);
      setError(messageFromError(summaryError));
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ loadDashboard(); },[]);

  const totalStudents = Number(data?.totalStudents ?? students.length);
  const todayRegistered = data?.students ? students.filter(student => (student as any).registeredToday === true) : countTodayRegistrations(students);
  const riskStudents = students.filter(student => (student as any).isRiskStudent === true);
  const lowAdherence = {
    low: students.filter(student => (student as any).isLowAdherence === true).map(student => ({ student, count: normalizeArray<SleepRecord>((student as any).recordsLast7Days || []).length })),
    critical: students.filter(student => (student as any).isCriticalAdherence === true).map(student => ({ student, count: 0 })),
  };
  const worstRecovery = normalizeArray<any>(data?.topWorstRecoveries || []).flatMap((item): { student: DashboardStudent; average: number; latest?: SleepRecord }[] => {
    const student = students.find(candidate => String(candidate.id) === String(item.studentId));
    const average = safeScore(item.averageLast3Score);
    if (!student || average === undefined) return [];
    const latest = item.latestRecordDate ? { id: Number(item.studentId) || 0, date: item.latestRecordDate, scoreTotal: item.latestScore, totalHours: 0, classification: '', perceivedQuality: 0, awakenings: 0 } as SleepRecord : undefined;
    return [{ student, average, latest }];
  });
  const fatigueStudents = students
    .filter(student => safeMetricNumber((student as any).fatigueRisk) !== undefined && Number((student as any).fatigueRisk) > 75)
    .map(student => ({ student, fatigue: { riskFinal: Number((student as any).fatigueRisk), level: ((student as any).fatigueRiskLevel || 'insuficiente') as FatigueResult['level'] } as FatigueResult }))
    .sort((a,b)=>Number(b.fatigue.riskFinal)-Number(a.fatigue.riskFinal));
  const readinessLow = students.filter(student => { const value = safeMetricNumber((student as any).readinessScore); return value !== undefined && value < 55; });
  const fatigueHighNew = students.filter(student => { const value = safeMetricNumber((student as any).fatigue?.value); return value !== undefined && value >= 70; });
  const overloadHigh = students.filter(student => { const value = safeMetricNumber((student as any).overloadRisk?.value); return value !== undefined && value >= 70; });
  const lowestBodyRecovery = students.map(student => ({ student, value: safeMetricNumber((student as any).recovery?.value) })).filter((item): item is { student: DashboardStudent; value: number } => item.value !== undefined).sort((a,b)=>a.value-b.value).slice(0,3);
  const alertnessLow = students.filter(student => { const value = safeMetricNumber((student as any).alertness?.value); return value !== undefined && value < 55; });
  const focusLow = students.filter(student => { const value = safeMetricNumber((student as any).mentalFocus?.value); return value !== undefined && value < 55; });
  const goalResults = students.map(student => ({
    student,
    goal: {
      hasGoal: Boolean((student as any).activeGoal || (student as any).activeSleepGoal),
      isNotMet: Boolean((student as any).isGoalNotMet),
      severeDeficit: Boolean((student as any).isSevereSleepDeficit),
      averageHours: safeMetricNumber((student as any).averageSleepHoursLast7Days) ?? null,
      goalHours: safeMetricNumber((student as any).activeGoal?.hoursGoal ?? (student as any).activeSleepGoal?.hoursGoal) ?? null,
      baseReduced: false,
      recordsUsed: normalizeArray<SleepRecord>((student as any).recordsLast7Days || []).length,
    } as GoalNotMetResult
  }));
  const goalNotMet = goalResults.filter(item => item.goal.isNotMet);
  const allAlerts = collectTeacherAlerts(students, backendAlerts);
  const alertsByStudent = new Map<number, AlertItem[]>();
  allAlerts.forEach(alert => {
    const studentId = Number(alert.studentId);
    if (Number.isFinite(studentId)) alertsByStudent.set(studentId, [...(alertsByStudent.get(studentId) || []), alert]);
  });
  const studentsWithAlerts = [...alertsByStudent.entries()].map(([studentId, alerts]) => ({ student: students.find(s=>Number(s.id)===studentId), alerts })).filter(item => item.student) as { student: DashboardStudent; alerts: AlertItem[] }[];
  const q = normalizeText(search);
  const searched = students.filter(s=>q && getStudentSearchText(s).includes(q));
  const openStudentList = (title: string, description: string, selected: DashboardStudent[], extra?: (student: DashboardStudent) => React.ReactNode) => setModal({ title, description, items: selected.map(student => studentSummaryRow(student, openStudent, extra?.(student))) });

  return <Shell title="Dashboard" eyebrow="PAINEL DO PROFESSOR" subtitle="Acompanhe prontidão, recuperação e risco dos seus alunos com clareza." nav={<TeacherNav/>} headerAction={<button className="primary" onClick={()=>navigate('/professor/alunos')}>Ver todos os alunos</button>}>
    <TeacherDashboardModal modal={modal} onClose={()=>setModal(null)}/>
    {error && <div className="error premiumError">{error}<button type="button" className="secondary smallInline" onClick={loadDashboard}>Tentar novamente</button></div>}
    <section className="card quickSearch teacherQuickSearch">
      <div className="sectionHeader">
        <div><h3>Busca rápida de aluno</h3><p>Digite o nome, e-mail ou login para abrir a ficha do aluno dentro da área de Alunos.</p></div>
        <input className="search" placeholder="Buscar aluno por nome, e-mail ou login..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      {q && <div className="list">{searched.slice(0,8).map(s=><button className="studentRow" key={s.id} onClick={()=>openStudent(s.id)}><StudentAvatar student={s} size="sm"/><div><strong>{s.name}</strong><small>{s.email || s.login || 'sem e-mail/login'} • prioridade {s.priority || priorityFromStudent(s)}</small></div><b className={levelClass(scoreValueFromStudent(s))}>{score(scoreValueFromStudent(s))}</b></button>)}{!searched.length && <Empty text="Nenhum aluno encontrado nessa busca."/>}</div>}
    </section>
    {loading ? <LoadingCard/> : <>
      <section className="teacherDashboardGrid three">
        <TeacherMetricCard title="Prontidão baixa/crítica" value={readinessLow.length} description="Alunos com prontidão para treino abaixo de 55%." tone={toneFromCount(readinessLow.length,totalStudents)} action="Ver alunos" onClick={()=>openStudentList('Prontidão baixa/crítica', 'Alunos com prontidão para treino em faixa baixa ou crítica.', readinessLow, student => `Prontidão: ${metricDisplay((student as any).readinessScore, '%')} • ${(student as any).readinessClassification || 'sem classificação'}`)} />
        <TeacherMetricCard title="Fadiga alta/crítica" value={fatigueHighNew.length} description="Alunos com fadiga geral em faixa alta ou crítica." tone={toneFromCount(fatigueHighNew.length,totalStudents)} action="Ver fadiga" onClick={()=>openStudentList('Fadiga alta/crítica', 'Alunos com fadiga geral acima de 70/100.', fatigueHighNew, student => `Fadiga: ${metricDisplay((student as any).fatigue?.value)}/100 • ${(student as any).fatigue?.classification || 'sem classificação'}`)} />
        <TeacherMetricCard title="Risco de sobrecarga alto/crítico" value={overloadHigh.length} description="Alunos com risco de sobrecarga acima de 70/100." tone={toneFromCount(overloadHigh.length,totalStudents)} action="Ver risco" onClick={()=>openStudentList('Risco de sobrecarga alto/crítico', 'Alunos com risco de sobrecarga em faixa alta ou crítica.', overloadHigh, student => `Risco: ${metricDisplay((student as any).overloadRisk?.value)}/100 • ${(student as any).overloadRisk?.classification || 'sem classificação'}`)} />
      </section>
      <section className="teacherDashboardGrid three">
        <TeacherMetricCard title="Top 3 menores recuperações corporais" value={lowestBodyRecovery.length ? `${score(lowestBodyRecovery[0].value)}/100` : 'Sem dados'} description="Ranking pela recuperação corporal calculada nos indicadores." tone={lowestBodyRecovery[0]?.value !== undefined ? levelClass(lowestBodyRecovery[0].value) : 'neutral'} action="Abrir ranking" onClick={()=>setModal({ title: 'Top 3 menores recuperações corporais', description: 'Ranking pelo indicador recuperação corporal.', items: lowestBodyRecovery.map(item => studentSummaryRow(item.student, openStudent, `Recuperação corporal: ${score(item.value)}/100 • ${(item.student as any).recovery?.classification || 'sem classificação'}`)) })} />
        <TeacherMetricCard title="Estado de alerta baixo/crítico" value={alertnessLow.length} description="Alunos com atenção/alerta abaixo de 55/100." tone={toneFromCount(alertnessLow.length,totalStudents)} action="Ver alerta" onClick={()=>openStudentList('Estado de alerta baixo/crítico', 'Alunos com estado de alerta baixo ou crítico.', alertnessLow, student => `Estado de alerta: ${metricDisplay((student as any).alertness?.value)}/100 • ${(student as any).alertness?.classification || 'sem classificação'}`)} />
        <TeacherMetricCard title="Foco mental baixo/crítico" value={focusLow.length} description="Alunos com foco mental abaixo de 55/100." tone={toneFromCount(focusLow.length,totalStudents)} action="Ver foco" onClick={()=>openStudentList('Foco mental baixo/crítico', 'Alunos com foco mental baixo ou crítico.', focusLow, student => `Foco mental: ${metricDisplay((student as any).mentalFocus?.value)}/100 • ${(student as any).mentalFocus?.classification || 'sem classificação'}`)} />
      </section>
      <section className="teacherDashboardGrid three">
        <TeacherMetricCard title="Total de alunos" value={totalStudents} description="Alunos ativos cadastrados/retornados pela API." tone="info" onClick={()=>openStudentList('Total de alunos', 'Base completa de alunos ativos retornados pela API.', students)} action="Ver alunos" />
        <TeacherMetricCard title="Registraram hoje" value={`${todayRegistered.length}/${totalStudents}`} description="Alunos com registro da noite anterior, esperado no check-in de hoje." tone="good" onClick={()=>openStudentList('Registraram hoje', 'Aluno conta aqui quando possui registro da noite anterior à manhã atual.', todayRegistered)} action="Ver lista"><TeacherDonut value={todayRegistered.length} total={totalStudents} tone="good" /></TeacherMetricCard>
        <TeacherMetricCard title="Alunos em risco" value={riskStudents.length} description="Média dos 3 últimos registros abaixo de 55 ou último score abaixo de 40." tone={toneFromCount(riskStudents.length,totalStudents)} onClick={()=>openStudentList('Alunos em risco', 'Regra A: média dos 3 últimos scores válidos abaixo de 55. Regra B: último score válido abaixo de 40.', riskStudents, student => { const last = getLastValidRecords(getStudentRecords(student),3)[0]; const avg = averageScores(getLastValidRecords(getStudentRecords(student),3)); return `Média recente: ${avg !== undefined ? score(avg) : 'sem dados'} • Último score: ${last ? score(last.scoreTotal) : 'sem dados'}`; })} action="Ver risco"><TeacherDonut value={riskStudents.length} total={totalStudents} tone={toneFromCount(riskStudents.length,totalStudents)} /></TeacherMetricCard>
      </section>
      <section className="teacherDashboardGrid three">
        <TeacherMetricCard title="Alunos com baixa adesão" value={lowAdherence.low.length} description="Menos de 3 registros nos últimos 7 dias." tone={toneFromCount(lowAdherence.low.length,totalStudents)} onClick={()=>openStudentList('Alunos com baixa adesão', 'Separação: baixa adesão = menos de 3 registros em 7 dias; crítico = 0 registros.', lowAdherence.low.map(item=>item.student), student => `${getRecordsLastDays(getStudentRecords(student),7).length} registro(s) nos últimos 7 dias${getRecordsLastDays(getStudentRecords(student),7).length === 0 ? ' • crítico sem registro na semana' : ''}`)} action="Ver adesão"><div className="metricSplit"><span>{lowAdherence.critical.length} crítico(s)</span><small>Sem registro na semana</small></div></TeacherMetricCard>
        <TeacherMetricCard title="Top 3 Piores Recuperações" value={worstRecovery.length ? `${score(worstRecovery[0].average)}/100` : 'Sem dados'} description="Menores médias dos últimos 3 registros válidos." tone={worstRecovery[0]?.average !== undefined ? levelClass(worstRecovery[0].average) : 'neutral'} action="Abrir lista" onClick={()=>setModal({ title: 'Top 3 Piores Recuperações', description: 'Ranking calculado pela média dos últimos 3 registros válidos. Alunos sem score válido ficam fora do ranking.', items: worstRecovery.map(item => <button className="studentRow" key={item.student.id} onClick={()=>openStudent(item.student.id)}><StudentAvatar student={item.student} size="sm"/><div><strong>{item.student.name}</strong><small>Média: {score(item.average)} • último registro: {item.latest ? brDate(item.latest.date) : 'sem registro'}</small><em>Abrir ficha</em></div><b className={levelClass(item.average)}>{score(item.average)}</b></button>) })}><div className="miniRanking">{worstRecovery.map(item=><span key={item.student.id}>{item.student.name}: <b className={levelClass(item.average)}>{score(item.average)}</b></span>)}{!worstRecovery.length && <small>Sem registros válidos para ranking.</small>}</div></TeacherMetricCard>
        <TeacherMetricCard title="Alunos em risco de fadiga" value={fatigueStudents.length} description="Conta apenas riscoFinal acima de 75 pela fórmula oficial." tone={toneFromCount(fatigueStudents.length,totalStudents)} action="Ver fadiga" onClick={()=>setModal({ title: 'Alunos em risco de fadiga', description: 'Fórmula: 50% risco por média + 30% queda recente + 20% energia ao acordar.', items: fatigueStudents.map(item => studentSummaryRow(item.student, openStudent, `Risco de fadiga: ${fatigueText(item.fatigue)} • nível ${item.fatigue.level}`)) })}><div className="miniRanking">{fatigueStudents.slice(0,3).map(item=><span key={item.student.id}>{item.student.name}: <b className="danger">{fatigueText(item.fatigue)}</b></span>)}{!fatigueStudents.length && <small>Dados insuficientes ou nenhum aluno acima de 75.</small>}</div></TeacherMetricCard>
      </section>
      <section className="teacherDashboardGrid twoWide">
        <TeacherMetricCard title="Meta de Sono Não Cumprida" value={goalNotMet.length} description="Alunos com meta ativa e média real de horas abaixo da meta configurada." tone={toneFromCount(goalNotMet.length,totalStudents)} action="Ver metas" onClick={()=>setModal({ title: 'Meta de Sono Não Cumprida', description: 'Não usa meta inventada: só conta aluno com meta ativa definida pelo professor e registros válidos.', items: goalNotMet.map(item => studentSummaryRow(item.student, openStudent, `Média: ${item.goal.averageHours !== null ? hour(item.goal.averageHours) : 'sem dados'} • Meta: ${item.goal.goalHours !== null ? hour(item.goal.goalHours) : 'sem meta'}${item.goal.baseReduced ? ' • base reduzida' : ''}${item.goal.severeDeficit ? ' • déficit severo' : ''}`)) })}><div className="metricSplit"><span>{goalResults.filter(item=>!item.goal.hasGoal).length} sem meta ativa</span><small>Não entram como erro</small></div></TeacherMetricCard>
        <TeacherMetricCard title="Alertas ativos" value={studentsWithAlerts.length} description="Cada aluno conta uma vez, mesmo com múltiplos alertas ativos." tone={toneFromCount(studentsWithAlerts.length,totalStudents)} action="Abrir alertas" onClick={()=>setModal({ title: 'Alunos com Alertas', description: 'Alertas oficiais calculados pelo backend.', items: studentsWithAlerts.map(item => <button className="studentRow" key={item.student.id} onClick={()=>openStudent(item.student.id)}><StudentAvatar student={item.student} size="sm"/><div><strong>{item.student.name}</strong><small>{item.alerts.length} alerta(s): {item.alerts.slice(0,3).map(alert=>alert.description).join(' | ')}</small><em>Abrir ficha</em></div><b className={severityTone(item.alerts.some(a=>String(a.level).includes('crítica')) ? 'crítica' : item.alerts[0]?.level)}>{item.alerts.length}</b></button>) })}><div className="metricSplit"><span>{allAlerts.length} alerta(s) ativo(s)</span><small>Backend oficial</small></div></TeacherMetricCard>
      </section>
    </>}
  </Shell>;
}

function statusFromStudent(s: StudentListItem){ if(s.trackingStatus) return s.trackingStatus; if(s.lastRecord) return 'com registro'; if((s.weeklyAverage || 0)>0) return 'acompanhamento inicial'; return 'sem dados'; }

// Atualiza o status textual considerando estados arquivado/deletado
function userStatusLabel(s: StudentListItem) {
  const st = String((s as any).studentStatus || (s as any).status || '').toLowerCase();
  if (st === 'archived') return 'arquivado';
  if (st === 'deleted') return 'deletado';
  return statusFromStudent(s);
}
function priorityFromStudent(s: StudentListItem){ const avg = scoreValueFromStudent(s); if(!hasNumber(avg)) return 'acompanhamento'; if(Number(avg)<55) return 'alta'; if(Number(avg)<70) return 'moderada'; return 'normal'; }
function normalizeText(value?: string) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

function recordDateKey(record?: Pick<SleepRecord, 'date'> | null) { return record?.date ? String(record.date).slice(0, 10) : ''; }
function recordTimeMs(record?: Pick<SleepRecord, 'date'> | null) { const d = safeDate(record?.date); return d ? d.getTime() : 0; }
function sortRecordsRecent(records: SleepRecord[]) { return [...records].sort((a,b)=>recordTimeMs(b)-recordTimeMs(a)); }
function filterRecordsByRange(records: SleepRecord[], range: '7'|'30'|'all') {
  if (range === 'all') return sortRecordsRecent(records);
  return getRecordsLastDays(records, Number(range));
}
function scoreNumberFromRecord(record?: SleepRecord | null) { return hasNumber(record?.scoreTotal) ? Number(record?.scoreTotal) : undefined; }
function studentSortValue(student: StudentListItem, mode: string) {
  const scoreValue = scoreValueFromStudent(student);
  if (mode === 'score') return scoreValue ?? 999;
  if (mode === 'recent') return -recordTimeMs(student.lastRecord);
  if (mode === 'sem-registro') return student.lastRecord ? 1 : 0;
  if (mode === 'prioridade') {
    const p = priorityFromStudent(student);
    return p === 'alta' ? 0 : p === 'moderada' ? 1 : p === 'normal' ? 2 : 3;
  }
  return normalizeText(student.name).charCodeAt(0) || 0;
}
function metricDisplay(value?: number | null, suffix = '') {
  return hasNumber(value) ? `${score(value)}${suffix}` : '—';
}

function StudentProfileCard({ student, onOpen }: { student: StudentListItem; onOpen: (studentId: number | string | undefined) => void }) {
  // Score da noite mais recente do aluno
  const lastScore = scoreValueFromStudent(student);
  // Prontidão calculada no backend (readinessScore) ou derivada via função original de fallback
  const readinessBackend = safeMetricNumber((student as any).readinessScore);
  const readiness = readinessBackend !== undefined ? readinessBackend : getReadinessScore(student as DashboardStudent);
  // Indicadores devolvidos pelo backend
  const recoveryValue = (student as any).recovery?.value;
  const recoveryClass = hasNumber(recoveryValue) ? levelClass(recoveryValue) : 'neutral';
  const recoveryLabel = hasNumber(recoveryValue) ? `${Math.round(Number(recoveryValue))}/100` : '—';
  const overloadValue = (student as any).overloadRisk?.value;
  const overloadClassif = (student as any).overloadRisk?.classification;
  const overloadLabel = hasNumber(overloadValue) ? `${Math.round(Number(overloadValue))}/100` : (overloadClassif || (student as any).risk || '—');
  const status = userStatusLabel(student);
  return <article className="studentProfileCard">
    <div className="studentCardTop">
      <StudentAvatar student={student} size="lg" />
      <span className={`studentStatusDot ${riskClass((student as any).risk || priorityFromStudent(student))}`} />
    </div>
    <div className="studentCardIdentity">
      <h3>{student.name}</h3>
      <p>{student.email || student.login || student.username || 'sem e-mail/login'}</p>
    </div>
    <div className="studentMetricMiniGrid">
      <span><small>Último score</small><b className={levelClass(lastScore)}>{metricDisplay(lastScore)}</b></span>
      <span><small>Prontidão</small><b className={levelClass(readiness)}>{hasNumber(readiness) ? pct(readiness) : '—'}</b></span>
      <span><small>Recuperação</small><b className={recoveryClass}>{recoveryLabel}</b></span>
      <span><small>Risco</small><b className={riskClass(overloadClassif || String(overloadLabel))}>{overloadLabel}</b></span>
      <span><small>Último registro</small><b>{student.lastRecord ? brDate((student.lastRecord as any).date) : 'Sem registro'}</b></span>
    </div>
    <div className="studentCardFooter">
      <span>{status} • acompanhamento {student.trackingStatus || statusFromStudent(student)} • prioridade {student.priority || priorityFromStudent(student)}</span>
      <button className="secondary" type="button" onClick={()=>onOpen(student.id)}>Abrir ficha</button>
    </div>
  </article>;
}

function TeacherStudents(){
  const [students,setStudents]=useState<StudentListItem[]>([]);
  const [search,setSearch]=useState('');
  const [sortMode,setSortMode]=useState<'prioridade'|'nome'|'recent'|'score'|'sem-registro'>('prioridade');
  const [selectedStudentId,setSelectedStudentId]=useState<number | string | null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  // Filtro de status: active, archived, all
  const [statusFilter,setStatusFilter] = useState<'active'|'archived'|'all'>('active');
  const location = useLocation();
  const navigate=useNavigate();

  // Carrega alunos conforme o filtro de status.
  useEffect(() => {
    async function loadStudents() {
      setLoading(true);
      setError('');
      try {
        // Consulta a API de alunos filtrando por status. Quando statusFilter é 'all', enviamos explicitamente.
        const params: any = {};
        if (statusFilter !== 'active') params.status = statusFilter;
        const { data } = await api.get('/students', { params });
        const list = assertArrayPayload(data, '/students').map(normalizeTeacherSummaryStudent);
        setStudents(list);
      } catch (err) {
        setError(messageFromError(err));
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, [statusFilter]);
  useEffect(()=>{
    const incoming = (location.state as any)?.openStudentId;
    if (incoming) {
      setSelectedStudentId(incoming);
      navigate('/professor/alunos', { replace: true, state: {} });
    }
  },[location.state, navigate]);

  const query = normalizeText(search);
  const filtered = students
    .filter(s=>!query || getStudentSearchText(s).includes(query))
    .sort((a,b)=> sortMode === 'nome' ? normalizeText(a.name).localeCompare(normalizeText(b.name)) : studentSortValue(a, sortMode)-studentSortValue(b, sortMode));

  return <Shell title="Alunos" eyebrow="LISTA DE ALUNOS" subtitle="Cards premium com dados reais de sono, prontidão, risco e adesão." backTo="/professor" nav={<TeacherNav/>}>
    <StudentDetailModal studentId={selectedStudentId} onClose={()=>setSelectedStudentId(null)}/>
    <section className="card teacherControlPanel">
      <div className="sectionHeader">
        <div><h3>Lista de alunos</h3><p>Busca, prioridade e ficha integrada sem abrir página separada.</p></div>
        <input className="search" placeholder="Buscar aluno por nome, e-mail ou login" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div className="filterBar"><button className={sortMode==='prioridade'?'active':''} onClick={()=>setSortMode('prioridade')}>Prioridade</button><button className={sortMode==='nome'?'active':''} onClick={()=>setSortMode('nome')}>A-Z</button><button className={sortMode==='recent'?'active':''} onClick={()=>setSortMode('recent')}>Mais recentes</button><button className={sortMode==='score'?'active':''} onClick={()=>setSortMode('score')}>Pior score</button><button className={sortMode==='sem-registro'?'active':''} onClick={()=>setSortMode('sem-registro')}>Sem registro</button></div>
      {/* Filtro de status dos alunos */}
      <div className="filterBar statusFilterBar">
        <button className={statusFilter==='active'?'active':''} onClick={()=>setStatusFilter('active')}>Ativos</button>
        <button className={statusFilter==='archived'?'active':''} onClick={()=>setStatusFilter('archived')}>Arquivados</button>
        <button className={statusFilter==='all'?'active':''} onClick={()=>setStatusFilter('all')}>Todos</button>
      </div>
    </section>
    {error && <div className="error premiumError">{error}</div>}
    {loading ? <LoadingCard/> : <section className="studentCardGrid">{filtered.map(s=><StudentProfileCard key={s.id} student={s} onOpen={(studentId)=>studentId && setSelectedStudentId(studentId)}/>)}{!filtered.length && <Empty text="Nenhum aluno encontrado."/>}</section>}
  </Shell>;
}

function TeacherAccesses(){
  const [students,setStudents]=useState<StudentListItem[]>([]);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const navigate=useNavigate();
  const openStudent = (studentId: number | string | undefined) => openStudentInStudentsPage(navigate, studentId);
  useEffect(()=>{setLoading(true); setError(''); loadTeacherStudentsList().then(setStudents).catch(err=>setError(messageFromError(err))).finally(()=>setLoading(false));},[]);
  const q = normalizeText(search);
  const filtered = students.filter(s=>!q || normalizeText(`${getStudentSearchText(s)} ${s.status || ''}`).includes(q)).sort((a,b)=>normalizeText(a.name).localeCompare(normalizeText(b.name)));
  return <Shell title="Acessos" eyebrow="ACESSOS" subtitle="Dados operacionais reais de conta, login e último registro disponível." backTo="/professor" nav={<TeacherNav/>}>
    <section className="card teacherControlPanel"><div className="sectionHeader"><div><h3>Logins e acessos dos alunos</h3><p>Use esta tela para encontrar rapidamente o e-mail/login do aluno. Senhas não são exibidas por segurança.</p></div><input className="search" placeholder="Buscar nome, e-mail ou login" value={search} onChange={e=>setSearch(e.target.value)}/></div></section>
    {error && <div className="error premiumError">{error}</div>}
    {loading ? <LoadingCard/> : <div className="accessGrid">{filtered.map(s=><article className="accessCard" key={s.id}><div className="accessCardHeader"><StudentAvatar student={s} size="md"/><div><span className="eyebrow">Aluno</span><h3>{s.name}</h3><p>{s.email || s.login || s.username || 'E-mail/login não informado'}</p></div></div><div className="accessMetaGrid"><span><small>Status</small><b>{userStatusLabel(s)}</b></span><span><small>Acompanhamento</small><b>{s.trackingStatus || statusFromStudent(s)}</b></span><span><small>Prioridade</small><b className={riskClass(s.priority || priorityFromStudent(s))}>{s.priority || priorityFromStudent(s)}</b></span><span><small>Último registro</small><b>{s.lastRecord ? brDate(s.lastRecord.date) : 'sem registro'}</b></span></div><div className="accessActions"><button className="secondary" onClick={()=>navigator.clipboard?.writeText(s.email || s.login || s.username || '')}>Copiar e-mail</button><button className="primary" onClick={()=>openStudent(s.id)}>Abrir ficha</button></div></article>)}{!filtered.length && <Empty text="Nenhum aluno encontrado."/>}</div>}
  </Shell>;
}

function alertPriority(alert: AlertItem) {
  const raw = normalizeText(`${alert.severity || ''} ${alert.level || ''} ${alert.status || ''}`);
  if (raw.includes('critical') || raw.includes('critica') || raw.includes('critico')) return 0;
  if (raw.includes('high') || raw.includes('alta') || raw.includes('alto') || raw.includes('elevado')) return 1;
  if (raw.includes('moderate') || raw.includes('moderada') || raw.includes('moderado') || raw.includes('medio') || raw.includes('médio')) return 2;
  if (raw.includes('low') || raw.includes('baixa') || raw.includes('baixo')) return 3;
  return 4;
}

function alertPriorityLabel(priority: number) {
  return priority === 0 ? 'Crítico' : priority === 1 ? 'Alto' : priority === 2 ? 'Moderado' : priority === 3 ? 'Baixo' : 'Acompanhar';
}

function TeacherAlerts(){
  const [alerts,setAlerts]=useState<AlertItem[]>([]);
  const [students,setStudents]=useState<DashboardStudent[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const navigate=useNavigate();
  const openStudent = (studentId: number | string | undefined) => openStudentInStudentsPage(navigate, studentId);

  async function loadAlerts(){
    setLoading(true); setError('');
    try {
      const summary = await loadTeacherDashboardSummary();
      setStudents(summary.students);
      setAlerts(collectTeacherAlerts(summary.students, summary.backendAlerts));
    } catch (summaryError) {
      setStudents([]);
      setAlerts([]);
      setError(messageFromError(summaryError));
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ loadAlerts(); },[]);

  const groupedAlerts = Array.from(alerts.reduce((map, alert) => {
    const key = alert.studentId ? `id-${alert.studentId}` : `name-${normalizeText(alert.studentName || 'sem-aluno')}`;
    const current = map.get(key) || { student: students.find(s => String(s.id) === String(alert.studentId)), studentName: alert.studentName || 'Aluno sem identificação', alerts: [] as AlertItem[] };
    current.alerts.push(alert);
    map.set(key, current);
    return map;
  }, new Map<string, { student?: DashboardStudent; studentName: string; alerts: AlertItem[] }>()).values()).map(group => {
    const sortedAlerts = [...group.alerts].sort((a,b)=>alertPriority(a)-alertPriority(b));
    return { ...group, alerts: sortedAlerts, firstPriority: alertPriority(sortedAlerts[0]) };
  }).sort((a,b)=>a.firstPriority-b.firstPriority || a.studentName.localeCompare(b.studentName));
  const criticalCount = alerts.filter(alert => alertPriority(alert) === 0).length;

  return <Shell title="Alertas" eyebrow="ALERTAS" subtitle="Problemas agrupados por aluno e ordenados pela maior prioridade." backTo="/professor" nav={<TeacherNav/>}>
    <section className="card teacherControlPanel"><div className="sectionHeader"><div><h3>Alertas dos alunos</h3><p>Aluno → problemas → ação recomendada. Lista oficial calculada pelo backend.</p></div><button className="secondary" onClick={loadAlerts}>Atualizar</button></div></section>
    {error && <div className="error premiumError">{error}<button type="button" className="secondary smallInline" onClick={loadAlerts}>Tentar novamente</button></div>}
    {loading ? <LoadingCard/> : <>
      <section className="kpiGrid"><Kpi title="Alunos com alerta" value={groupedAlerts.length} /><Kpi title="Total de alertas" value={alerts.length} /><Kpi title="Críticos" value={criticalCount} tone={criticalCount ? 'danger' : 'good'} /><Kpi title="Base analisada" value={students.length} /></section>
      <section className="alertStudentGrid">{groupedAlerts.map(group => {
        const student = group.student;
        const displayName = student?.name || group.studentName;
        return <article className="alertStudentCard" key={`${displayName}-${group.alerts.length}`}>
          <div className="alertStudentHeader">
            <StudentAvatar student={student || { name: displayName }} size="md" />
            <div><h3>{displayName}</h3><p>{group.alerts.length} alerta(s) ativo(s)</p></div>
            <b className={riskClass(alertPriorityLabel(group.firstPriority))}>{alertPriorityLabel(group.firstPriority)}</b>
          </div>
          <div className="alertList">{group.alerts.map(alert => <div className="alertItem" key={alert.id}>
            <div><strong>{alert.type || alert.status || 'Alerta'}</strong><small>{alert.description}</small>{alert.action && <em>{alert.action}</em>}</div>
            <b className={riskClass(alert.level || alert.severity || alert.status)}>{alert.level || severityToLevel(alert.severity) || alert.status}</b>
          </div>)}</div>
          {student?.id && <button className="secondary" onClick={()=>openStudent(student.id)}>Abrir ficha do aluno</button>}
        </article>;
      })}{!groupedAlerts.length && <Empty text="Nenhum alerta ativo."/>}</section>
    </>}
  </Shell>;
}

function normalizeGoal(data: any): SleepGoal {
  if (!data || typeof data !== 'object') return null;
  return {
    id: data.id,
    hoursGoal: Number(data.hoursGoal),
    sleepTimeGoal: data.sleepTimeGoal,
    wakeTimeGoal: data.wakeTimeGoal,
    regularityGoal: Number(data.regularityGoal),
    active: data.active,
    createdAt: data.createdAt,
  };
}

function TeacherGoalManager({ studentId }: { studentId: string | undefined }) {
  const [goal, setGoal] = useState({ hoursGoal: 8, sleepTimeGoal: '23:00', wakeTimeGoal: '07:00', regularityGoal: 60 });
  const [activeGoal, setActiveGoal] = useState<SleepGoal>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loadingGoal, setLoadingGoal] = useState(false);
  const hourOptions = Array.from({ length: 17 }, (_, i) => 4 + i * 0.5);
  const regularityOptions = [15, 30, 45, 60, 75, 90, 120, 150, 180];
  const timeOptions = Array.from({ length: 96 }, (_, i) => `${String(Math.floor((i * 15) / 60)).padStart(2, '0')}:${String((i * 15) % 60).padStart(2, '0')}`);

  const studentIdNumber = Number(studentId);
  const validStudentId = Number.isFinite(studentIdNumber) && studentIdNumber > 0;

  function hydrateGoalForm(data: SleepGoal) {
    if (!data) return;
    setGoal({
      hoursGoal: Number(data.hoursGoal || 8),
      sleepTimeGoal: formatGoalTime(data.sleepTimeGoal) || '23:00',
      wakeTimeGoal: formatGoalTime(data.wakeTimeGoal) || '07:00',
      regularityGoal: Number(data.regularityGoal || 60)
    });
  }

  async function loadGoal(){
    if (!validStudentId) { setError('ID do aluno inválido na URL. Abra a ficha pela lista oficial de alunos.'); return null; }
    setLoadingGoal(true); setError('');
    try {
      const { data } = await api.get(`/sleep-goals/student/${studentIdNumber}/active?_=${Date.now()}`);
      const normalized = normalizeGoal(data);
      setActiveGoal(normalized);
      hydrateGoalForm(normalized);
      return normalized;
    } catch (err) {
      setError(messageFromError(err));
      return null;
    } finally {
      setLoadingGoal(false);
    }
  }

  useEffect(() => { loadGoal(); }, [studentId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Salvando meta...'); setError('');
    if (!validStudentId) { setError('Aluno inválido. Volte para /professor/alunos e abra a ficha novamente.'); setStatus(''); return; }
    if (goal.hoursGoal < 4 || goal.hoursGoal > 12) { setError('A meta de horas deve ficar entre 4 e 12 horas.'); setStatus(''); return; }
    if (goal.regularityGoal < 15 || goal.regularityGoal > 180) { setError('A regularidade deve ficar entre 15 e 180 minutos.'); setStatus(''); return; }
    try {
      const payload = {
        hoursGoal: Number(goal.hoursGoal),
        sleepTimeGoal: goal.sleepTimeGoal,
        wakeTimeGoal: goal.wakeTimeGoal,
        regularityGoal: Number(goal.regularityGoal)
      };
      const { data: saved } = await api.post(`/sleep-goals/student/${studentIdNumber}`, payload);
      const savedGoal = normalizeGoal(saved);
      if (savedGoal) { setActiveGoal(savedGoal); hydrateGoalForm(savedGoal); }
      const confirmed = await loadGoal();
      if (!confirmed && savedGoal) setActiveGoal(savedGoal);
      setStatus(confirmed ? 'Meta salva, confirmada no backend e recarregada.' : 'Meta enviada ao backend. Recarregue a ficha para confirmar a leitura.');
    } catch (err) { setError(messageFromError(err)); setStatus(''); }
  }

  return <section className="card">
    <div className="sectionHeader">
      <div><h3>Meta do aluno</h3><p>Esta meta é definida pelo professor. O aluno apenas visualiza a meta ativa na página inicial.</p></div>
      <button className="secondary" type="button" onClick={loadGoal} disabled={loadingGoal}>{loadingGoal ? 'Atualizando...' : 'Recarregar meta'}</button>
    </div>
    {error && <div className="error">{error}</div>}
    {activeGoal ? <div className="goalBox currentGoal"><b>{hour(activeGoal.hoursGoal)}</b><span>Meta ativa: {formatGoalTime(activeGoal.sleepTimeGoal) || '—'} → {formatGoalTime(activeGoal.wakeTimeGoal) || '—'}</span><span>Regularidade: até {activeGoal.regularityGoal || '—'} min</span><small>ID do aluno: {studentIdNumber}</small></div> : <p className="muted">Nenhuma meta ativa encontrada para este aluno.</p>}
    <form className="goalForm" onSubmit={submit}>
      <Field label="Meta de horas" hint="Selecione a quantidade alvo de sono."><select value={goal.hoursGoal} onChange={e=>setGoal(g=>({...g,hoursGoal:Number(e.target.value)}))}>{hourOptions.map(v=><option key={v} value={v}>{String(v).replace('.', ',')} horas</option>)}</select></Field>
      <Field label="Regularidade máxima" hint="Variação máxima aceitável no horário."><select value={goal.regularityGoal} onChange={e=>setGoal(g=>({...g,regularityGoal:Number(e.target.value)}))}>{regularityOptions.map(v=><option key={v} value={v}>{v} minutos</option>)}</select></Field>
      <Field label="Dormir por volta de"><select value={goal.sleepTimeGoal} onChange={e=>setGoal(g=>({...g,sleepTimeGoal:e.target.value}))}>{timeOptions.map(v=><option key={v} value={v}>{v}</option>)}</select></Field>
      <Field label="Acordar por volta de"><select value={goal.wakeTimeGoal} onChange={e=>setGoal(g=>({...g,wakeTimeGoal:e.target.value}))}>{timeOptions.map(v=><option key={v} value={v}>{v}</option>)}</select></Field>
      <button className="primary big" disabled={status === 'Salvando meta...' || !validStudentId}>{status === 'Salvando meta...' ? 'Salvando...' : 'Salvar meta para este aluno'}</button>
    </form>
    {status && status !== 'Salvando meta...' && <div className="success">{status}</div>}
  </section>;
}

function BoolBadge({ label, value }: { label: string; value?: boolean | null }) {
  return <Kpi title={label} value={value === true ? 'Sim' : value === false ? 'Não' : '—'} />;
}

function SleepRecordSummaryModal({ record, onClose }: { record: SleepRecord; onClose: () => void }) {
  const sleepStart = record.sleepTime || record.sleepStart;
  const sleepEnd = record.wakeTime || record.sleepEnd;
  return <div className="modalOverlay" role="dialog" aria-modal="true">
    <section className="modalCard">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Detalhe completo da noite</span>
          <h3>{brDate(record.date)}</h3>
          <p>{record.classification} • {hour(record.totalHours)} • qualidade {record.perceivedQuality}/5 • {record.awakenings} despertar(es)</p>
        </div>
        <button className="ghost small" onClick={onClose}>Fechar</button>
      </div>
      <section className="kpiGrid">
        <Kpi title="Score" value={`${score(record.scoreTotal)}/100`} tone={levelClass(record.scoreTotal)} />
        <Kpi title="Horas" value={hour(record.totalHours)} />
        <Kpi title="Dormiu" value={sleepStart ? formatGoalTime(sleepStart) || '—' : '—'} />
        <Kpi title="Acordou" value={sleepEnd ? formatGoalTime(sleepEnd) || '—' : '—'} />
        <Kpi title="Qualidade" value={`${record.perceivedQuality}/5`} />
        <Kpi title="Como acordou" value={`${record.morningState ?? record.wakeState ?? '—'}/5`} />
        <Kpi title="Energia" value={record.energy !== undefined ? `${record.energy}/5` : '—'} />
        <Kpi title="Estresse" value={record.stress !== undefined ? `${record.stress}/5` : '—'} />
        <Kpi title="Humor" value={record.mood !== undefined ? `${record.mood}/5` : '—'} />
        <Kpi title="Dor muscular geral" value={record.generalPain !== undefined ? `${record.generalPain}/5` : '—'} />
        <Kpi title="Corpo pesado" value={record.bodyHeaviness !== undefined ? `${record.bodyHeaviness}/5` : '—'} />
        <Kpi title="Despertares" value={hasNumber(record.awakenings) ? String(record.awakenings) : '—'} />
        <BoolBadge label="Cochilo" value={record.nap} />
        <BoolBadge label="Cafeína após 18h" value={record.caffeine} />
        <BoolBadge label="Álcool" value={record.alcohol} />
        <BoolBadge label="Tela antes de dormir" value={record.screenBeforeSleep} />
        <BoolBadge label="Dor ao acordar" value={record.pain} />
      </section>
      <ScoreBreakdown record={record}/>
      {record.notes && <section className="card"><h3>Observação</h3><p>{record.notes}</p></section>}
    </section>
  </div>;
}

function StudentDetailModal({ studentId, onClose }: { studentId: number | string | null; onClose: () => void }){
  const [d,setD]=useState<any>(null);
  const [obs,setObs]=useState('');
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [historyFilter,setHistoryFilter]=useState<'7'|'30'|'all'>('30');
  const [historySearch,setHistorySearch]=useState('');
  const [loading,setLoading]=useState(false);
  const [selectedRecord,setSelectedRecord]=useState<SleepRecord | null>(null);
  const id = studentId ? String(studentId) : '';

  async function loadStudent(){
    if(!id) return;
    setLoading(true); setError('');
    try {
      const [detailRes, recordsRes] = await Promise.all([api.get(`/students/${id}`), api.get(`/teacher/students/${id}/sleep-records`)]);
      const fullRecords = normalizeArray<SleepRecord>(recordsRes.data);
      setD({ ...detailRes.data, allRecords: fullRecords, recentRecords: fullRecords });
    }
    catch(err){ setError(messageFromError(err)); }
    finally{ setLoading(false); }
  }
  useEffect(()=>{ if(id) loadStudent(); },[id]);
  async function saveObservation(){
    if(!obs.trim()) return;
    setStatus('Salvando...');
    try{ await api.post(`/observations/students/${id}`, { text: obs }); setObs(''); await loadStudent(); setStatus('Observação salva.'); }
    catch(err){ setStatus(messageFromError(err)); }
  }

  if(!studentId) return null;
  if(loading) return <div className="modalOverlay studentDetailOverlay" role="dialog" aria-modal="true"><section className="modalCard studentDetailModal"><div className="sectionHeader"><div><span className="eyebrow">Ficha do aluno</span><h3>Carregando...</h3></div><button className="ghost small" onClick={onClose}>Fechar</button></div><LoadingCard/></section></div>;
  if(error) return <div className="modalOverlay studentDetailOverlay" role="dialog" aria-modal="true"><section className="modalCard studentDetailModal"><div className="sectionHeader"><div><span className="eyebrow">Ficha do aluno</span><h3>Erro ao carregar</h3></div><button className="ghost small" onClick={onClose}>Fechar</button></div><div className="error">{error}</div><button className="secondary" onClick={loadStudent}>Tentar novamente</button></section></div>;
  if(!d) return <div className="modalOverlay studentDetailOverlay" role="dialog" aria-modal="true"><section className="modalCard studentDetailModal"><div className="sectionHeader"><div><span className="eyebrow">Ficha do aluno</span><h3>Aluno</h3></div><button className="ghost small" onClick={onClose}>Fechar</button></div><Empty text="Aluno não encontrado."/></section></div>;

  const records = sortRecordsRecent(normalizeStudentRecords(d));
  const filteredRecords = filterRecordsByRange(records, historyFilter).filter(r=>!historySearch || normalizeText(`${brDate(r.date)} ${r.classification} ${r.notes || ''}`).includes(normalizeText(historySearch)));
  const last = d.lastRecord || records[0];
  return <div className="modalOverlay studentDetailOverlay" role="dialog" aria-modal="true">
    <section className="modalCard studentDetailModal">
      {selectedRecord && <SleepRecordSummaryModal record={selectedRecord} onClose={()=>setSelectedRecord(null)}/>} 
      <div className="sectionHeader detailModalHeader"><div><span className="eyebrow">Ficha integrada do aluno</span><h3>{d.name}</h3><p>A ficha fica dentro da página /professor/alunos, sem página visual separada.</p></div><button className="ghost small" onClick={onClose}>Fechar</button></div>
      <section className="heroCard"><div><span className="eyebrow">Ficha completa do aluno</span><h2 className={levelClass(d.weeklyAverage ?? last?.scoreTotal)}>{d.risk || levelFromScore(d.weeklyAverage ?? last?.scoreTotal)}</h2><p>{d.recommendation || 'Acompanhe histórico, tendência, meta e observações do aluno em uma única área.'}</p></div><div className="stackActions"><div className="ring" style={{'--value': `${Number(d.weeklyAverage ?? last?.scoreTotal ?? 0) * 3.6}deg`} as React.CSSProperties}><strong>{score(d.weeklyAverage ?? last?.scoreTotal)}</strong><small>Média/score</small></div><button className="secondary" onClick={loadStudent}>Atualizar dados</button></div></section>
      <section className="kpiGrid"><Kpi title="Média semanal" value={hasNumber(d.weeklyAverage) ? `${score(d.weeklyAverage)}/100` : '—'} tone={levelClass(d.weeklyAverage)} /><Kpi title="Média mensal" value={hasNumber(d.monthlyAverage) ? `${score(d.monthlyAverage)}/100` : '—'} tone={levelClass(d.monthlyAverage)} /><Kpi title="Adesão" value={d.adherence !== undefined ? pct(d.adherence) : '—'} /><Kpi title="Último registro" value={last ? score(last.scoreTotal) : '—'} tone={levelClass(last?.scoreTotal)} /></section>
      <TeacherGoalManager studentId={id}/>
      <section className="grid2"><section className="card"><h3>Evolução recente</h3><p className="muted">Ordem cronológica: registros mais recentes à direita no gráfico.</p><MiniBars data={records.slice(0,14)} field="scoreTotal" /></section><section className="card"><h3>Leitura técnica rápida</h3><p>{recommendationFromRecord(last)}</p><div className="scoreTable compact"><div><strong>Score</strong><b>{last ? score(last.scoreTotal) : '—'}</b><span>{last ? levelFromScore(last.scoreTotal) : 'Sem registro'}</span></div><div><strong>Horas</strong><b>{last ? hour(last.totalHours) : '—'}</b><span>Quantidade de sono informada</span></div><div><strong>Qualidade</strong><b>{last?.perceivedQuality ? `${last.perceivedQuality}/5` : '—'}</b><span>Percepção subjetiva da noite</span></div></div></section></section>
      <ScoreBreakdown record={last}/>
      {/* Seção de leitura de recuperação e treino com indicadores do backend */}
      <section className="card">
        <h3>Leitura de recuperação e treino</h3>
        <p className="muted">Indicadores calculados a partir das últimas noites para orientar decisão de treino e recuperação.</p>
        <div className="scoreTable compact">
          {/* Prontidão para treino */}
          <div>
            <strong>Prontidão</strong>
            <b>{hasNumber((d as any).readinessScore) ? `${Math.round(Number((d as any).readinessScore))}/100` : '—'}</b>
            <span>{(d as any).readinessClassification || '—'}</span>
          </div>
          {/* Risco de sobrecarga */}
          <div>
            <strong>Risco de sobrecarga</strong>
            <b>{hasNumber((d as any).overloadRisk?.value) ? `${Math.round(Number((d as any).overloadRisk.value))}/100` : '—'}</b>
            <span>{(d as any).overloadRisk?.classification || '—'}</span>
          </div>
          {/* Recuperação corporal */}
          <div>
            <strong>Recuperação corporal</strong>
            <b>{hasNumber((d as any).recovery?.value) ? `${Math.round(Number((d as any).recovery.value))}/100` : '—'}</b>
            <span>{(d as any).recovery?.classification || '—'}</span>
          </div>
          {/* Fadiga geral */}
          <div>
            <strong>Fadiga geral</strong>
            <b>{hasNumber((d as any).fatigue?.value) ? `${Math.round(Number((d as any).fatigue.value))}/100` : '—'}</b>
            <span>{(d as any).fatigue?.classification || '—'}</span>
          </div>
          {/* Estado de alerta */}
          <div>
            <strong>Estado de alerta</strong>
            <b>{hasNumber((d as any).alertness?.value) ? `${Math.round(Number((d as any).alertness.value))}/100` : '—'}</b>
            <span>{(d as any).alertness?.classification || '—'}</span>
          </div>
          {/* Foco mental */}
          <div>
            <strong>Foco mental</strong>
            <b>{hasNumber((d as any).mentalFocus?.value) ? `${Math.round(Number((d as any).mentalFocus.value))}/100` : '—'}</b>
            <span>{(d as any).mentalFocus?.classification || '—'}</span>
          </div>
        </div>
      </section>
      <section className="card"><div className="sectionHeader"><div><h3>Histórico do aluno</h3><p>Histórico oficial dentro da ficha do aluno. Clique em uma noite para abrir o detalhe completo sem sair da ficha.</p></div><input className="search" placeholder="Buscar no histórico" value={historySearch} onChange={e=>setHistorySearch(e.target.value)}/></div><div className="filterBar"><button className={historyFilter==='7'?'active':''} onClick={()=>setHistoryFilter('7')}>7 dias</button><button className={historyFilter==='30'?'active':''} onClick={()=>setHistoryFilter('30')}>30 dias</button><button className={historyFilter==='all'?'active':''} onClick={()=>setHistoryFilter('all')}>Todos carregados</button><button className="secondary" onClick={loadStudent}>Atualizar histórico</button></div><div className="historyList">{filteredRecords.map((r:SleepRecord)=><button className="historyItem clickable" key={r.id} onClick={()=>setSelectedRecord(r)}><div><strong>{brDate(r.date)}</strong><small>{hour(r.totalHours)} • qualidade {r.perceivedQuality}/5 • energia {r.energy ?? '—'}/5 • dor {r.generalPain ?? '—'}/5 • {r.awakenings} despertar(es) • {r.classification}</small>{r.notes && <em>{r.notes}</em>}</div><b className={levelClass(r.scoreTotal)}>{score(r.scoreTotal)}</b></button>)}{!filteredRecords.length && <Empty text="Nenhum registro encontrado para esse filtro."/>}</div></section>
      <section className="card"><h3>Observações do professor</h3><div className="list">{normalizeArray<any>(d.observations).map((o,idx)=><div className="row" key={idx}><div><strong>{brDateTime(o.date)}</strong><small>{o.text}</small></div></div>)}{!normalizeArray<any>(d.observations).length && <Empty text="Nenhuma observação registrada."/>}</div><textarea value={obs} onChange={e=>setObs(e.target.value)} maxLength={500} placeholder="Escreva uma observação para acompanhamento..."/><small className="muted">{obs.length}/500 caracteres</small><button className="primary" type="button" onClick={saveObservation}>Salvar observação</button>{status && <p className="muted">{status}</p>}</section>

      {/* Seção de gerenciamento de aluno: arquivar, restaurar ou deletar */}
      <section className="card">
        <h3>Gerenciar aluno</h3>
        {/* Exibe o status atual do aluno */}
        <p className="muted">Status atual: {String((d as any).status || 'ativo')}</p>
        <div className="actions">
          {String((d as any).status).toLowerCase() !== 'archived' && String((d as any).status).toLowerCase() !== 'deleted' && (
            <button className="secondary" type="button" onClick={async()=>{
              const confirm = window.confirm('Deseja guardar este aluno?\nEste aluno sairá da lista principal, mas todos os dados serão mantidos. Você poderá restaurá-lo depois.');
              if (!confirm) return;
              try {
                await api.patch(`/students/${id}/archive`);
                alert('Aluno arquivado com sucesso.');
                onClose();
              } catch(err) {
                alert(messageFromError(err));
              }
            }}>Guardar aluno</button>
          )}
          {String((d as any).status).toLowerCase() === 'archived' && (
            <button className="secondary" type="button" onClick={async()=>{
              const confirm = window.confirm('Deseja restaurar este aluno?');
              if (!confirm) return;
              try {
                await api.patch(`/students/${id}/restore`);
                alert('Aluno restaurado com sucesso.');
                onClose();
              } catch(err) {
                alert(messageFromError(err));
              }
            }}>Restaurar aluno</button>
          )}
          {String((d as any).status).toLowerCase() !== 'deleted' && (
            <button className="danger" type="button" onClick={async()=>{
              const text = prompt('Tem certeza que deseja deletar este aluno?\nEste aluno será removido do painel, dos alertas e das métricas. Para confirmar, digite DELETAR');
              if (text !== 'DELETAR') return;
              try {
                await api.delete(`/students/${id}`);
                alert('Aluno deletado com sucesso.');
                onClose();
              } catch(err) {
                alert(messageFromError(err));
              }
            }}>Deletar aluno</button>
          )}
        </div>
      </section>
    </section>
  </div>;
}

function App() {
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Falha ao registrar service worker:', err));
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/aluno" element={<Protected profile="student"><StudentAppRedirect /></Protected>} />
          <Route path="/aluno/*" element={<Protected profile="student"><StudentAppRedirect /></Protected>} />

          <Route path="/professor" element={<Protected profile="teacher"><TeacherDashboard /></Protected>} />
          <Route path="/professor/alunos" element={<Protected profile="teacher"><TeacherStudents /></Protected>} />
          <Route path="/professor/acessos" element={<Protected profile="teacher"><TeacherAccesses /></Protected>} />
          <Route path="/professor/alertas" element={<Protected profile="teacher"><TeacherAlerts /></Protected>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
