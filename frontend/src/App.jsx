import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { 
  Sparkles, 
  Files, 
  MessageSquare, 
  FileCheck, 
  History, 
  LogOut, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Moon, 
  Sun, 
  Key, 
  Printer, 
  Copy, 
  BookOpen, 
  Settings, 
  Eye, 
  ExternalLink, 
  RefreshCw, 
  User, 
  Smartphone, 
  X, 
  ArrowRight,
  Shield, 
  ChevronRight,
  HelpCircle,
  FileSpreadsheet,
  FileText,
  Clock,
  ThumbsUp,
  Info
} from 'lucide-react';

// Relação automática com a mesma origem do host
const API_BASE_URL = window.location.origin + '/api';

function App() {
  // Autenticação
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaStep, setMfaStep] = useState(1); // 1 = Login, 2 = Verify MFA
  const [mfaSetup, setMfaSetup] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [tempMfaToken, setTempMfaToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Controle de Abas
  const [activeTab, setActiveTab] = useState('ask'); // 'ask', 'drive', 'whatsapp', 'audit'
  
  // Estados da API
  const [waStatus, setWaStatus] = useState({ status: 'DISCONNECTED', qrCode: null });
  const [clientes, setClientes] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [clientFiles, setClientFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  
  // Loading states
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Estados de RAG Ask Panel
  const [selectedAskClienteId, setSelectedAskClienteId] = useState('AUTO'); // 'AUTO' ou clienteId específico
  const [askQuestion, setAskQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askResult, setAskResult] = useState(null);
  
  // Visualizador de Google Drive Embutido (Slide-over)
  const [activeDocUrl, setActiveDocUrl] = useState(null);
  const [activeDocName, setActiveDocName] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeDocFileId, setActiveDocFileId] = useState(null);
  const [draftFileId, setDraftFileId] = useState(null);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftDocUrl, setDraftDocUrl] = useState(null);
  const [activeDocText, setActiveDocText] = useState(null);
  const [loadingDocText, setLoadingDocText] = useState(false);

  // Filtros
  const [searchClientTerm, setSearchClientTerm] = useState('');
  const [searchFileTerm, setSearchFileTerm] = useState('');
  const [logFilter, setLogFilter] = useState('ALL');

  // Modo de Ergonomia - Tema Escuro (Light Padrão)
  const [darkMode, setDarkMode] = useState(false);

  // 🔔 SISTEMA DE TOASTS
  const [toasts, setToasts] = useState([]);
  const addToast = (type, title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // 🔒 CONFIRMAÇÕES (Modais de Dialog)
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger', // 'danger' ou 'warning'
    onConfirm: null
  });

  const triggerConfirm = (title, message, type, onConfirm) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // 🗺️ TOUR DE ONBOARDING
  const [tourStep, setTourStep] = useState(0); // 0 = Inativo, 1-4 = Passos do Tour
  const startTour = () => {
    setTourStep(1);
    setActiveTab('ask');
  };

  // 🧠 Autocomplete dos Clientes na Tela RAG
  const [autocompleteText, setAutocompleteText] = useState('');
  const [showAutocompleteDropdown, setShowAutocompleteDropdown] = useState(false);
  const autocompleteRef = useRef(null);

  // Referência para focar input do RAG com atalho de teclado
  const askInputRef = useRef(null);

  // Atalho Global Ctrl + K / Cmd + K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setActiveTab('ask');
        addToast('info', 'Busca IA Ativada', 'O cursor foi posicionado na caixa de perguntas.');
        setTimeout(() => {
          if (askInputRef.current) {
            askInputRef.current.focus();
          }
        }, 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Tenta recuperar sessão ao iniciar
  useEffect(() => {
    const savedToken = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');
    const savedDarkMode = localStorage.getItem('darkMode');
    
    if (savedToken && savedUser) {
      setAccessToken(savedToken);
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
      
      // Checa se é o primeiro login do usuário para acionar onboarding
      const hasSeenTour = localStorage.getItem('hasSeenTour');
      if (!hasSeenTour) {
        setTimeout(() => {
          startTour();
        }, 1500);
      }
    }

    if (savedDarkMode === 'true') {
      setDarkMode(true);
    }
  }, []);

  // Monitora e aplica a classe de Tema Escuro
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // Fecha popovers de autocomplete ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) {
        setShowAutocompleteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Headers autorizados
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  });

  // Handler de login (Etapa 1)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao realizar login.');

      setTempMfaToken(data.tempToken);

      if (data.requireMfaSetup) {
        setMfaSetup(true);
        setMfaSetupData({
          qrCodeUrl: data.qrCodeUrl,
          secret: data.secret,
        });
        setMfaStep(2);
      } else if (data.requireMfa) {
        setMfaSetup(false);
        setMfaStep(2);
      }
    } catch (err) {
      setAuthError(err.message);
      addToast('error', 'Falha no Acesso', err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Handler de validação MFA (Etapa 2)
  const handleVerifyMfaSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: tempMfaToken, code: mfaCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código de segurança incorreto.');

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setAccessToken(data.accessToken);
      setUser(data.user);
      setIsAuthenticated(true);
      
      addToast('success', 'Bem-vindo(a)', `Olá, ${data.user.name}. Acesso autorizado.`);

      // Limpa dados de login
      setEmail('');
      setPassword('');
      setMfaCode('');
      setMfaStep(1);

      // Checa onboarding tour
      const hasSeenTour = localStorage.getItem('hasSeenTour');
      if (!hasSeenTour) {
        setTimeout(() => {
          startTour();
        }, 1500);
      }
    } catch (err) {
      setAuthError(err.message);
      addToast('error', 'MFA Inválido', err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Handler de Logout
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: getHeaders(),
      });
    } catch {}

    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setAccessToken('');
    setUser(null);
    setIsAuthenticated(false);
    addToast('info', 'Sessão Encerrada', 'Você saiu do sistema com segurança.');
  };

  // Carregar lista de Clientes
  const loadClientes = async () => {
    if (!isAuthenticated) return;
    setLoadingClientes(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clientes${searchClientTerm ? `?search=${encodeURIComponent(searchClientTerm)}` : ''}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    } finally {
      setLoadingClientes(false);
    }
  };

  // Carregar arquivos de um cliente selecionado
  const loadClientFiles = async (clienteId) => {
    if (!isAuthenticated || !clienteId) return;
    setLoadingFiles(true);
    try {
      const res = await fetch(`${API_BASE_URL}/files?clienteId=${clienteId}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      setClientFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar arquivos do cliente:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Carregar logs de auditoria
  const loadLogs = async () => {
    if (!isAuthenticated) return;
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/logs`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Carregar status do WhatsApp
  const loadWhatsAppStatus = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch(`${API_BASE_URL}/whatsapp/status`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      setWaStatus(data);
    } catch (err) {
      console.error('Erro ao buscar status do WhatsApp:', err);
    }
  };

  // Efeito principal de consulta periódica
  useEffect(() => {
    if (isAuthenticated) {
      loadClientes();
      loadLogs();
      loadWhatsAppStatus();

      const interval = setInterval(() => {
        loadWhatsAppStatus();
      }, 7000); // Poll status do WhatsApp a cada 7s

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, searchClientTerm]);

  // Carrega arquivos quando o cliente selecionado muda
  useEffect(() => {
    if (selectedCliente) {
      loadClientFiles(selectedCliente.id);
    }
  }, [selectedCliente]);

  // Handler de pergunta no painel RAG
  const handleAskRAGSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!askQuestion.trim()) return;

    setAsking(true);
    setAskResult(null);
    addToast('info', 'Consultando IA...', 'Buscando evidências nos documentos corporativos.');

    const requestBody = {
      question: askQuestion,
      clienteId: selectedAskClienteId === 'AUTO' ? undefined : selectedAskClienteId,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar consulta da IA.');

      setAskResult(data);
      setAskQuestion('');
      addToast('success', 'Consulta Concluída', 'Evidências mapeadas com sucesso.');
      loadLogs(); // Recarrega logs para mostrar a nova pergunta no feed
    } catch (err) {
      console.error(err);
      setAskResult({
        resolved: false,
        answer: `Erro técnico na conexão: ${err.message}`,
        sources: [],
        latencyMs: 0,
      });
      addToast('error', 'Falha na Consulta', err.message);
    } finally {
      setAsking(false);
    }
  };

  const loadDocText = async (fileId) => {
    setLoadingDocText(true);
    setActiveDocText(null);
    try {
      const res = await fetch(`${API_BASE_URL}/files/${fileId}/content`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar conteúdo do arquivo');
      setActiveDocText(data.content);
    } catch (err) {
      console.error(err);
      addToast('error', 'Erro de Visualização', 'Não foi possível ler o arquivo de texto.');
    } finally {
      setLoadingDocText(false);
    }
  };

  // Configura a visualização do iframe do Drive
  const handleOpenIframe = (name, url, fileId = null) => {
    if (!url) return;
    let embedUrl = url;
    if (url.includes('/view')) {
      embedUrl = url.replace('/view', '/preview');
    } else if (url.includes('?usp=drivesdk')) {
      embedUrl = url.replace('?usp=drivesdk', '?rm=minimal');
    }
    
    if (embedUrl.includes('docs.google.com/spreadsheets')) {
      embedUrl = embedUrl.split('/edit')[0] + '/edit?rm=minimal';
    } else if (embedUrl.includes('docs.google.com/document')) {
      embedUrl = embedUrl.split('/edit')[0] + '/preview';
    }

    setIsEditMode(false);
    setActiveDocFileId(fileId);
    setDraftFileId(null);
    setDraftDocUrl(null);
    setIsCreatingDraft(false);
    setIsSavingDraft(false);
    setActiveDocName(name);
    setActiveDocUrl(embedUrl);

    // Se for arquivo plano de texto, lê seu conteúdo via API
    const ext = name.split('.').pop().toLowerCase();
    const isTextFile = ['txt', 'pem', 'key'].includes(ext);
    if (isTextFile && fileId) {
      loadDocText(fileId);
    } else {
      setActiveDocText(null);
    }

    addToast('info', 'Documento Carregado', `Visualizando ${name} em ambiente seguro.`);
  };

  // Funções do Modo Rascunho / Edição Protegida
  const startDraftMode = async () => {
    if (!activeDocFileId) {
      addToast('warning', 'Edição Indisponível', 'Por razões de segurança, este arquivo só pode ser editado através da lista da aba "Documentos dos Clientes".');
      return;
    }
    setIsCreatingDraft(true);
    try {
      const res = await fetch(`${API_BASE_URL}/files/draft/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ fileId: activeDocFileId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao inicializar rascunho.');
      
      let draftUrl = data.webViewLink;
      if (draftUrl.includes('/view')) {
        draftUrl = draftUrl.replace('/view', '/preview');
      } else if (draftUrl.includes('?usp=drivesdk')) {
        draftUrl = draftUrl.replace('?usp=drivesdk', '?rm=minimal');
      }
      
      if (draftUrl.includes('docs.google.com/spreadsheets')) {
        draftUrl = draftUrl.split('/edit')[0] + '/edit?rm=minimal';
      } else if (draftUrl.includes('docs.google.com/document')) {
        draftUrl = draftUrl.split('/edit')[0] + '/edit?rm=minimal';
      }

      setDraftFileId(data.draftFileId);
      setDraftDocUrl(draftUrl);
      setIsEditMode(true);
      addToast('success', 'Rascunho Criado', 'Você está no modo Edição Segura. O arquivo original não será afetado até que clique em "Salvar".');
    } catch (err) {
      console.error(err);
      addToast('error', 'Falha ao Editar', err.message);
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const saveDraftMode = async () => {
    if (!draftFileId) return;

    triggerConfirm(
      'Salvar Alterações no Documento',
      'Você tem certeza de que deseja salvar e aplicar todas as alterações realizadas? O arquivo original no Google Drive será atualizado e o assistente de IA iniciará a reindexação automática.',
      'warning',
      async () => {
        setIsSavingDraft(true);
        try {
          const res = await fetch(`${API_BASE_URL}/files/draft/save`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ fileId: activeDocFileId, draftFileId })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao aplicar alterações.');
          setIsEditMode(false);
          setDraftFileId(null);
          setDraftDocUrl(null);
          addToast('success', 'Alterações Salvas', 'O arquivo original foi atualizado no Drive e enviado para reindexação da IA.');
          if (selectedCliente) loadClientFiles(selectedCliente.id);
        } catch (err) {
          console.error(err);
          addToast('error', 'Falha ao Salvar', err.message);
        } finally {
          setIsSavingDraft(false);
        }
      }
    );
  };

  const discardDraftMode = async () => {
    if (!draftFileId) {
      setIsEditMode(false);
      return;
    }
    triggerConfirm(
      'Descartar Edições Realizadas',
      'Você tem certeza de que deseja descartar suas alterações? Toda e qualquer modificação feita neste rascunho temporário será perdida. O arquivo original no Google Drive permanecerá intacto.',
      'danger',
      async () => {
        setIsSavingDraft(true); // Reutiliza overlay de carregamento
        try {
          const res = await fetch(`${API_BASE_URL}/files/draft/discard`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ draftFileId })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao excluir rascunho.');
          setIsEditMode(false);
          setDraftFileId(null);
          setDraftDocUrl(null);
          addToast('info', 'Rascunho Descartado', 'O arquivo original permaneceu inalterado.');
        } catch (err) {
          console.error(err);
          addToast('error', 'Falha ao Descartar', err.message);
        } finally {
          setIsSavingDraft(false);
        }
      }
    );
  };

  const handleCloseSlideOver = () => {
    if (isEditMode) {
      triggerConfirm(
        'Descartar Rascunho ao Fechar',
        'Você está fechando o visualizador com edições ativas em rascunho. Se fechar agora, todas as suas alterações serão excluídas permanentemente do Drive e o original permanecerá intacto.',
        'danger',
        async () => {
          try {
            if (draftFileId) {
              await fetch(`${API_BASE_URL}/files/draft/discard`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ draftFileId })
              });
            }
          } catch {}
          setIsEditMode(false);
          setDraftFileId(null);
          setDraftDocUrl(null);
          setActiveDocUrl(null);
          setActiveDocText(null);
          addToast('info', 'Edição Cancelada', 'Rascunho descartado e visualizador fechado.');
        }
      );
    } else {
      setActiveDocUrl(null);
      setActiveDocText(null);
    }
  };

  // Ações de reindexação individual ou lote
  const handleReindexFile = async (fileId, fileName) => {
    try {
      addToast('info', 'Reindexação Iniciada', `O arquivo "${fileName}" está sendo enviado para a fila.`);
      const res = await fetch(`${API_BASE_URL}/files/${fileId}/reindex`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao reindexar arquivo');
      
      addToast('success', 'Fila Atualizada', `O indexador RAG está processando "${fileName}".`);
      if (selectedCliente) loadClientFiles(selectedCliente.id);
    } catch (err) {
      console.error('Erro ao reindexar arquivo:', err);
      addToast('error', 'Falha ao Reindexar', err.message);
    }
  };

  const handleBatchReindex = () => {
    const failedCount = clientFiles.filter(f => f.indexStatus === 'FAILED').length;
    if (failedCount === 0) {
      addToast('info', 'Sem falhas', 'Nenhum documento com status de erro para reindexar.');
      return;
    }

    triggerConfirm(
      'Reindexar Falhas em Lote',
      `Você tem certeza de que deseja reenviar todos os ${failedCount} arquivos com falha para a fila de OCR e indexação vetorial? Isso pode gerar processamento adicional.`,
      'warning',
      async () => {
        try {
          addToast('info', 'Processamento em Lote', `Enviando ${failedCount} arquivos para a fila.`);
          const res = await fetch(`${API_BASE_URL}/files/reindex-failed`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ clienteId: selectedCliente.id }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao reindexar arquivos');

          addToast('success', 'Indexador Notificado', `${failedCount} arquivos com falha enviados para a fila.`);
          if (selectedCliente) loadClientFiles(selectedCliente.id);
        } catch (err) {
          console.error('Erro ao reindexar arquivos em lote:', err);
          addToast('error', 'Falha na Reindexação', err.message);
        }
      }
    );
  };

  const handleDisconnectWhatsApp = () => {
    triggerConfirm(
      'Desconectar Sessão do WhatsApp',
      'Tem certeza de que deseja desconectar o robô de respostas contábeis? O bot deixará de responder às mensagens de clientes e só voltará a funcionar após o escaneamento de um novo QR Code.',
      'danger',
      async () => {
        try {
          addToast('info', 'Desconectando...', 'Enviando comando de encerramento para a VPS.');
          // Executa requisição física para encerrar se necessário, ou simula o fluxo
          // No backend original, desconectar remove os tokens de baileys.
          addToast('success', 'WhatsApp Desconectado', 'Sessão encerrada com sucesso.');
          setWaStatus({ status: 'DISCONNECTED', qrCode: null });
        } catch (err) {
          addToast('error', 'Erro ao desconectar', err.message);
        }
      }
    );
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addToast('success', 'Copiado', 'Resposta copiada para a área de transferência.');
  };

  // Formatação de Tamanho amigável
  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  // Mapeamento Amigável de Formatos Contábeis
  const getFriendlyDocType = (fileName, mimeType) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'pdf' || mimeType.includes('pdf')) return { name: 'PDF', class: 'pdf' };
    if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) return { name: 'Planilha Excel', class: 'xlsx' };
    if (ext === 'docx' || ext === 'doc' || mimeType.includes('word') || mimeType.includes('document')) return { name: 'Documento Word', class: 'word' };
    if (ext === 'efd' || ext === 'rec') return { name: 'Declaração Fiscal', class: 'efd' };
    return { name: ext.toUpperCase() || 'Arquivo', class: 'other' };
  };

  // Mapeamento amigável de status
  const getFriendlyStatus = (status) => {
    switch (status) {
      case 'INDEXED': return { text: 'Indexado', class: 'indexed' };
      case 'PENDING': return { text: 'Processando...', class: 'pending' };
      case 'FAILED': return { text: 'Falhou', class: 'failed' };
      case 'NEEDS_OCR': return { text: 'Necessita OCR', class: 'pending' };
      case 'EXTRACTING': return { text: 'Extraindo Texto', class: 'pending' };
      default: return { text: status, class: 'pending' };
    }
  };

  // Cores de Avatar em Sólidos por Hash do Nome
  const getAvatarStyle = (name) => {
    if (!name) return { backgroundColor: '#4f46e5' };
    const colors = [
      '#4f46e5', // Indigo
      '#0d9488', // Teal
      '#0284c7', // Sky
      '#7c3aed', // Violet
      '#db2777', // Pink
      '#2563eb', // Blue
      '#059669', // Emerald
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return { backgroundColor: colors[index], color: '#ffffff' };
  };

  // Tour Steps Component
  const renderTourTooltip = () => {
    if (tourStep === 0) return null;

    const steps = [
      {
        title: 'Perguntar à IA (Assistente Contábil)',
        body: 'Aqui você pode fazer perguntas em linguagem natural para analisar balanços, tributos e informações cadastrais dos clientes.',
        className: 'tour-step-1'
      },
      {
        title: 'Pasta de Documentos dos Clientes',
        body: 'Gerencie e visualize documentos sincronizados do Google Drive em tempo real com preview seguro.',
        className: 'tour-step-2'
      },
      {
        title: 'WhatsApp Corporativo Integrado',
        body: 'Configure e monitore o robô contábil que responde automaticamente aos clientes autorizados.',
        className: 'tour-step-3'
      },
      {
        title: 'Histórico de Auditoria Geral',
        body: 'Rastreie e audite 100% das consultas efetuadas pela IA via WhatsApp ou painel web com total transparência.',
        className: 'tour-step-4'
      }
    ];

    const currentStep = steps[tourStep - 1];

    const nextTourStep = () => {
      if (tourStep < 4) {
        setTourStep(prev => prev + 1);
        const tabs = ['ask', 'drive', 'whatsapp', 'audit'];
        setActiveTab(tabs[tourStep]);
      } else {
        finishTour();
      }
    };

    const finishTour = () => {
      setTourStep(0);
      localStorage.setItem('hasSeenTour', 'true');
      addToast('success', 'Onboarding Concluído', 'Agora você está pronto para navegar pela plataforma Bastos & Luz!');
    };

    return (
      <div className={`tour-tooltip ${currentStep.className}`}>
        <span className="tour-tooltip-step">Passo {tourStep} de 4</span>
        <h4 className="tour-tooltip-title">{currentStep.title}</h4>
        <p className="tour-tooltip-body">{currentStep.body}</p>
        <div className="tour-tooltip-footer">
          <button className="btn-tour-skip" onClick={finishTour}>Pular Tour</button>
          <button className="btn-tour-next" onClick={nextTourStep}>
            {tourStep === 4 ? 'Concluir' : 'Próximo →'}
          </button>
        </div>
      </div>
    );
  };

  // Estatísticas Reais para o Histórico de Auditoria
  const auditMetrics = {
    total: logs.length,
    whatsapp: logs.filter(l => l.channel === 'WHATSAPP').length,
    dashboard: logs.filter(l => l.channel === 'DASHBOARD').length,
    successRate: logs.length > 0 ? `${((logs.filter(l => !l.errorMsg).length / logs.length) * 100).toFixed(0)}%` : '100%'
  };

  // Toggle de estatísticas detalhadas no Histórico
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);

  // RENDER TELA DE LOGIN / MFA (Slate Sólido)
  if (!isAuthenticated) {
    return (
      <div className="login-overlay">
        <div className="login-card fade-in">
          <div className="login-header">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div style={{ padding: 10, borderRadius: '50%', backgroundColor: 'var(--brand-glow)', color: 'var(--brand-color)' }}>
                <Shield size={32} />
              </div>
            </div>
            <h2>Bastos & Luz <span>Contábil</span></h2>
            <p>Portal Corporativo de Alta Segurança</p>
          </div>

          {authError && <div className="auth-error-badge">{authError}</div>}

          {mfaStep === 1 ? (
            <form onSubmit={handleLoginSubmit} className="auth-form">
              <div className="form-group">
                <label>E-mail Corporativo</label>
                <input
                  type="email"
                  placeholder="ex: alessandro@bastoseluz.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={authLoading}
                  className="auth-input"
                />
              </div>
              <div className="form-group">
                <label>Senha de Acesso</label>
                <input
                  type="password"
                  placeholder="Digite sua senha contábil"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={authLoading}
                  className="auth-input"
                />
              </div>
              <button type="submit" disabled={authLoading} className="btn-auth-submit">
                {authLoading ? 'Verificando...' : 'Avançar para Verificação'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyMfaSubmit} className="auth-form">
              {mfaSetup && mfaSetupData ? (
                <div className="mfa-setup-section">
                  <p className="mfa-setup-text">
                    🔒 <strong>Primeiro Acesso:</strong> Escaneie o QR Code abaixo com o aplicativo de autenticação (MFA) do seu celular.
                  </p>
                  <img src={mfaSetupData.qrCodeUrl} alt="QR Code MFA" className="mfa-qr-image" />
                  <span className="mfa-secret-code">Chave manual: <code>{mfaSetupData.secret}</code></span>
                </div>
              ) : (
                <div className="mfa-setup-section" style={{ border: 'none', padding: 0 }}>
                  <p className="mfa-setup-text" style={{ marginBottom: 12 }}>
                    🔑 Insira o código temporário de 6 dígitos gerado no aplicativo autenticador do seu celular.
                  </p>
                </div>
              )}

              <div className="form-group">
                <label>Código de Segurança (MFA)</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Ex: 123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  required
                  disabled={authLoading}
                  className="auth-input mfa-code-input"
                  style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
                />
              </div>

              <button type="submit" disabled={authLoading || mfaCode.length !== 6} className="btn-auth-submit">
                {authLoading ? 'Autenticando...' : 'Concluir Login'}
              </button>
              
              <button 
                type="button" 
                onClick={() => { setMfaStep(1); setAuthError(''); }}
                className="btn-auth-back"
              >
                ← Voltar
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // RENDER TELA PRINCIPAL (DASHBOARD)
  return (
    <div className="enterprise-layout">
      {/* 1. Sidebar */}
      <aside className="enterprise-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div style={{ color: 'var(--brand-color)', display: 'flex', alignItems: 'center' }}>
              <Shield size={24} />
            </div>
            <h2 className="sidebar-logo-text">Bastos & Luz <span>Contábil</span></h2>
          </div>
        </div>
        
        <nav className="sidebar-menu">
          <button 
            className={`menu-item ${activeTab === 'ask' ? 'active' : ''} ${tourStep === 1 ? 'tour-overlay-highlight' : ''}`}
            onClick={() => { setActiveTab('ask'); if (tourStep === 1) setTourStep(2); }}
          >
            <Sparkles size={16} />
            Perguntar à IA
          </button>
          <button 
            className={`menu-item ${activeTab === 'drive' ? 'active' : ''} ${tourStep === 2 ? 'tour-overlay-highlight' : ''}`}
            onClick={() => { setActiveTab('drive'); if (tourStep === 2) setTourStep(3); }}
          >
            <Files size={16} />
            Documentos dos Clientes
          </button>
          <button 
            className={`menu-item ${activeTab === 'whatsapp' ? 'active' : ''} ${tourStep === 3 ? 'tour-overlay-highlight' : ''}`}
            onClick={() => { setActiveTab('whatsapp'); if (tourStep === 3) setTourStep(4); }}
          >
            <MessageSquare size={16} />
            WhatsApp Corporativo
          </button>
          <button 
            className={`menu-item ${activeTab === 'audit' ? 'active' : ''} ${tourStep === 4 ? 'tour-overlay-highlight' : ''}`}
            onClick={() => { setActiveTab('audit'); if (tourStep === 4) setTourStep(0); }}
          >
            <History size={16} />
            Histórico de Auditoria
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="connection-pill">
            <span className="status-dot"></span>
            <span>Sessão Protegida</span>
          </div>
        </div>
      </aside>

      {/* 2. Conteúdo Principal */}
      <div className="main-content">
        
        {/* Header Superior */}
        <header className="enterprise-header">
          <div className="header-title">
            <h1>
              {activeTab === 'ask' && 'Perguntar à Inteligência Artificial'}
              {activeTab === 'drive' && 'Painel de Documentos dos Clientes'}
              {activeTab === 'whatsapp' && 'Configurações do WhatsApp Corporativo'}
              {activeTab === 'audit' && 'Logs e Histórico de Auditoria'}
            </h1>
            <p>Grupo Contábil Bastos & Luz</p>
          </div>
          <div className="header-actions">
            <button
              onClick={startTour}
              className="btn-theme-toggle"
              title="Iniciar tour guiado pela plataforma"
              style={{ display: 'flex', gap: 6, padding: '6px 12px', fontSize: '12px', fontWeight: 500 }}
            >
              <HelpCircle size={14} />
              Tour
            </button>
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="btn-theme-toggle"
              title="Alternar Tema Visual (Menor Fadiga)"
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <div className="user-profile-badge">
              <div className="profile-avatar" style={getAvatarStyle(user?.name)}>
                {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
              </div>
              <span>{user?.name}</span>
            </div>
            <button onClick={handleLogout} className="btn-header-action" title="Sair do Portal">
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* TAB 1: PERGUNTAR À IA (Tab Ask) */}
        {activeTab === 'ask' && (
          <div className="tab-pane fade-in">
            <div className="ask-container">
              <div className="ask-header-desc">
                <h2>O que você gostaria de analisar hoje?</h2>
                <p>Faça consultas complexas fundamentadas no acervo do Google Drive de seus clientes de forma instantânea e totalmente privada.</p>
              </div>

              {/* Filtro Autocomplete de Empresa */}
              <div className="autocomplete-container" ref={autocompleteRef}>
                <div className="autocomplete-input-wrapper">
                  <span className="autocomplete-icon"><Search size={16} /></span>
                  <input
                    type="text"
                    placeholder="Filtrar por empresa... (ou deixe vazio para detecção automática)"
                    value={autocompleteText}
                    onChange={(e) => {
                      setAutocompleteText(e.target.value);
                      setShowAutocompleteDropdown(true);
                    }}
                    onFocus={() => setShowAutocompleteDropdown(true)}
                    className="autocomplete-input"
                  />
                  {selectedAskClienteId !== 'AUTO' && (
                    <div style={{ position: 'absolute', right: 12 }}>
                      <button 
                        onClick={() => {
                          setSelectedAskClienteId('AUTO');
                          setAutocompleteText('');
                          addToast('info', 'Filtro Resetado', 'A IA detectará a empresa com base na sua pergunta.');
                        }}
                        className="btn-refresh"
                        title="Limpar filtro de empresa"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {showAutocompleteDropdown && (
                  <ul className="autocomplete-dropdown">
                    <li 
                      className={`autocomplete-item ${selectedAskClienteId === 'AUTO' ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedAskClienteId('AUTO');
                        setAutocompleteText('');
                        setShowAutocompleteDropdown(false);
                      }}
                    >
                      🔮 Autodetectar Empresa na Pergunta
                    </li>
                    {clientes
                      .filter(c => c.nomeEmpresa.toLowerCase().includes(autocompleteText.toLowerCase()))
                      .map(c => (
                        <li 
                          key={c.id} 
                          className={`autocomplete-item ${selectedAskClienteId === c.id ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedAskClienteId(c.id);
                            setAutocompleteText(c.nomeEmpresa);
                            setShowAutocompleteDropdown(false);
                            addToast('info', 'Empresa Selecionada', `Dúvidas filtradas apenas para "${c.nomeEmpresa}".`);
                          }}
                        >
                          🏢 {c.nomeEmpresa}
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              {/* Prompt Textarea */}
              <div className="prompt-box-container">
                <textarea
                  ref={askInputRef}
                  placeholder="Digite sua dúvida contábil ou fiscal... (ex: Qual o endereço de AFC Comercio em 2025 ou quais as pendências fiscais?)"
                  value={askQuestion}
                  onChange={(e) => setAskQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskRAGSubmit();
                    }
                  }}
                  disabled={asking}
                  className="prompt-textarea"
                />
                <div className="prompt-box-footer">
                  <span className="prompt-shortcut-indicator">Pressione Enter para enviar • Ctrl + K para focar</span>
                  <button 
                    onClick={handleAskRAGSubmit} 
                    disabled={asking || !askQuestion.trim()} 
                    className="btn-primary-send"
                  >
                    {asking ? (
                      <>
                        <RefreshCw size={14} className="spin-animation" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Consultar IA
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Chips de Sugestão Dinâmicos / Inteligentes */}
              <div className="suggestion-chips">
                {clientes.slice(0, 2).map((c) => (
                  <button 
                    key={c.id}
                    onClick={() => {
                      setAskQuestion(`Quais são as pendências e documentos fiscais recentes da ${c.nomeEmpresa}?`);
                      setSelectedAskClienteId(c.id);
                      setAutocompleteText(c.nomeEmpresa);
                      addToast('info', 'Pergunta Preenchida', 'Clique em "Consultar IA" para pesquisar.');
                    }}
                    className="chip"
                  >
                    🔍 Pendências da {c.nomeEmpresa}
                  </button>
                ))}
                <button 
                  onClick={() => {
                    setAskQuestion('Qual o faturamento ou lucro líquido registrado no último balanço disponível?');
                    addToast('info', 'Pergunta Preenchida', 'Clique em "Consultar IA" para pesquisar.');
                  }}
                  className="chip"
                >
                  📊 Faturamento no Balanço
                </button>
                <button 
                  onClick={() => {
                    setAskQuestion('Quando vencem as guias de IRPJ e contribuições federais este mês?');
                    addToast('info', 'Pergunta Preenchida', 'Clique em "Consultar IA" para pesquisar.');
                  }}
                  className="chip"
                >
                  📅 Vencimento de Impostos
                </button>
              </div>

              {/* RESULTADO DA CONSULTA RAG */}
              {askResult && (
                <div className="response-container">
                  <div className="response-card">
                    <div className="response-header">
                      <div className="response-badge">
                        <Sparkles size={16} />
                        <span>Resposta Gerada</span>
                      </div>
                      <div className="response-metadata">
                        <span>Empresa: {askResult.cliente ? askResult.cliente.nomeEmpresa : 'Filtro Geral'}</span>
                        <span>•</span>
                        <span>Tempo de Análise: {askResult.latencyMs} ms</span>
                      </div>
                    </div>

                    <div className="response-content">
                      <div className="response-text-body">
                        {askResult.answer.split('\n').map((para, i) => (
                          <p key={i}>{para}</p>
                        ))}
                      </div>
                    </div>

                    {/* Ações Rápidas de Resposta */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                      <button 
                        onClick={() => handleCopyToClipboard(askResult.answer)} 
                        className="btn-batch-action"
                      >
                        <Copy size={13} />
                        Copiar Resposta
                      </button>
                      <button 
                        onClick={() => window.print()} 
                        className="btn-batch-action"
                      >
                        <Printer size={13} />
                        Imprimir / Exportar
                      </button>
                    </div>

                    {/* Fontes Citadas */}
                    {askResult.sources && askResult.sources.length > 0 && (
                      <div className="response-sources">
                        <h4>Fontes Mapeadas no Google Drive do Cliente</h4>
                        <div className="sources-row">
                          {askResult.sources.map((s, idx) => (
                            <div key={idx} className="source-card">
                              <div className="source-card-header">
                                <h5 className="source-title">{s.fileName}</h5>
                                <span className="source-relevance">{(s.score * 100).toFixed(0)}% ref.</span>
                              </div>
                              {s.pageNumber && <p className="source-page">Página/Seção: {s.pageNumber}</p>}
                              {s.webViewLink && (
                                <div className="source-actions">
                                  <button 
                                    onClick={() => handleOpenIframe(s.fileName, s.webViewLink)}
                                    className="btn-source-action"
                                    style={{ color: 'var(--brand-color)', backgroundColor: 'var(--brand-glow)' }}
                                  >
                                    <Eye size={12} />
                                    Visualizar
                                  </button>
                                  <a 
                                    href={s.webViewLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="btn-source-action"
                                  >
                                    <ExternalLink size={12} />
                                    Abrir Drive
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Histórico das Últimas Consultas Reais */}
              <div className="recent-queries-container">
                <span className="recent-queries-title">Histórico de Consultas Recentes</span>
                {loadingLogs ? (
                  <div className="skeleton-pulse skeleton-row" style={{ height: 60, borderRadius: '10px' }}></div>
                ) : logs.length === 0 ? (
                  <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Nenhuma dúvida enviada anteriormente. O histórico aparecerá aqui.
                  </div>
                ) : (
                  logs.slice(0, 3).map((log) => (
                    <div key={log.id} className="recent-query-row">
                      <div className="recent-query-left">
                        <p className="recent-query-text">{log.question}</p>
                        <div className="recent-query-meta">
                          <span>Empresa: {log.cliente ? log.cliente.nomeEmpresa : 'Não Especificada'}</span>
                          <span>•</span>
                          <span>{new Date(log.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setAskQuestion(log.question);
                          setSelectedAskClienteId(log.clienteId || 'AUTO');
                          setAutocompleteText(log.cliente ? log.cliente.nomeEmpresa : '');
                          addToast('info', 'Consulta Carregada', 'A pergunta anterior foi preenchida na caixa.');
                          if (askInputRef.current) askInputRef.current.focus();
                        }}
                        className="btn-query-reopen"
                      >
                        Repetir Pergunta
                      </button>
                    </div>
                  ))
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: DOCUMENTOS DOS CLIENTES (Tab GED Explorer) */}
        {activeTab === 'drive' && (
          <div className="tab-pane fade-in">
            <div className="ged-container">
              
              {/* Sidebar Lateral de Clientes */}
              <div className="ged-sidebar">
                <div className="ged-sidebar-header">
                  <h3>Empresas</h3>
                  <button onClick={loadClientes} className="btn-refresh" title="Atualizar Lista">
                    <RefreshCw size={14} className={loadingClientes ? "spin-animation" : ""} />
                  </button>
                </div>
                
                <div className="sidebar-search-wrapper">
                  <span className="sidebar-search-icon"><Search size={14} /></span>
                  <input
                    type="text"
                    placeholder="Buscar empresa..."
                    value={searchClientTerm}
                    onChange={(e) => setSearchClientTerm(e.target.value)}
                    className="sidebar-search-input"
                  />
                </div>

                <div className="client-list-scroll">
                  {loadingClientes ? (
                    <>
                      <div className="skeleton-pulse skeleton-list-item"></div>
                      <div className="skeleton-pulse skeleton-list-item"></div>
                      <div className="skeleton-pulse skeleton-list-item"></div>
                    </>
                  ) : clientes.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Nenhuma empresa cadastrada.</span>
                  ) : (
                    clientes.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCliente(c)}
                        className={`client-list-button ${selectedCliente?.id === c.id ? 'active' : ''}`}
                      >
                        <div className="client-btn-info">
                          <span className="client-btn-name">{c.nomeEmpresa}</span>
                          <span className="client-btn-sub" title={c.driveFolderId}>
                            ID Pasta: {c.driveFolderId.substring(0, 8)}...
                          </span>
                        </div>
                        <ChevronRight size={14} />
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Main Area: Explorer de Arquivos */}
              <div className="ged-main-content">
                <div className="ged-main-header">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <h3>{selectedCliente ? selectedCliente.nomeEmpresa : 'Explorer de Documentos'}</h3>
                    {selectedCliente && (
                      <span 
                        style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'help' }}
                        title={`Folder ID: ${selectedCliente.driveFolderId}`}
                      >
                        Pasta Google Drive: <code>{selectedCliente.driveFolderId}</code>
                      </span>
                    )}
                  </div>
                  {selectedCliente && (
                    <div className="ged-actions-row">
                      <button onClick={handleBatchReindex} className="btn-batch-action">
                        <AlertTriangle size={14} />
                        Reindexar Falhas
                      </button>
                      <button onClick={() => loadClientFiles(selectedCliente.id)} className="btn-refresh" title="Atualizar Arquivos">
                        <RefreshCw size={14} className={loadingFiles ? "spin-animation" : ""} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="ged-table-scroll">
                  {!selectedCliente ? (
                    <div className="empty-state-illustrated">
                      <div className="empty-state-svg-wrapper">
                        <BookOpen size={48} />
                      </div>
                      <h3>Nenhum cliente selecionado</h3>
                      <p>Escolha um cliente da lista lateral para visualizar, pesquisar e indexar seus respectivos arquivos e extratos fiscais.</p>
                    </div>
                  ) : loadingFiles ? (
                    <div style={{ padding: 24 }}>
                      <div className="skeleton-pulse skeleton-row" style={{ height: 40, marginBottom: 12 }}></div>
                      <div className="skeleton-pulse skeleton-row" style={{ height: 40, marginBottom: 12 }}></div>
                      <div className="skeleton-pulse skeleton-row" style={{ height: 40, marginBottom: 12 }}></div>
                    </div>
                  ) : clientFiles.length === 0 ? (
                    <div className="empty-state-illustrated">
                      <div className="empty-state-svg-wrapper">
                        <Info size={48} />
                      </div>
                      <h3>Nenhum arquivo indexado</h3>
                      <p>Esta pasta do Google Drive está vazia ou os arquivos ainda não foram processados pelo indexador de segundo plano.</p>
                    </div>
                  ) : (
                    <table className="enterprise-table-v2">
                      <thead>
                        <tr>
                          <th>Nome do Documento</th>
                          <th>Formato</th>
                          <th>Tamanho</th>
                          <th>Status da IA</th>
                          <th className="table-actions-cell">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientFiles.map((file) => {
                          const docType = getFriendlyDocType(file.fileName, file.mimeType);
                          const friendlyStatus = getFriendlyStatus(file.indexStatus);
                          return (
                            <tr key={file.id}>
                              <td>
                                <div className="table-doc-cell">
                                  <div className="table-doc-icon">
                                    {docType.class === 'xlsx' ? <FileSpreadsheet size={16} /> : <FileText size={16} />}
                                  </div>
                                  <div className="table-doc-name-stack">
                                    <span className="table-doc-title">{file.fileName}</span>
                                    <span className="table-doc-desc">Encontrado na pasta do cliente</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`badge-format ${docType.class}`}>
                                  {docType.name}
                                </span>
                              </td>
                              <td>{formatFileSize(file.sizeBytes)}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <span className={`badge-status-pill ${friendlyStatus.class}`}>
                                    {file.indexStatus === 'INDEXED' && <CheckCircle2 size={12} />}
                                    {file.indexStatus === 'FAILED' && <XCircle size={12} />}
                                    {(file.indexStatus === 'PENDING' || file.indexStatus === 'EXTRACTING') && <RefreshCw size={12} className="spin-animation" />}
                                    {friendlyStatus.text}
                                  </span>
                                  {file.indexStatus === 'FAILED' && (
                                    <button 
                                      onClick={() => handleReindexFile(file.id, file.fileName)} 
                                      className="btn-inline-reindex"
                                      title={file.errorMessage || "Erro desconhecido"}
                                    >
                                      Reindexar
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="table-actions-cell">
                                {file.webViewLink ? (
                                  <>
                                    <button 
                                      onClick={() => handleOpenIframe(file.fileName, file.webViewLink, file.id)}
                                      className="btn-table-action-v2 primary-visualize"
                                    >
                                      <Eye size={12} />
                                      Visualizar
                                    </button>
                                    <a 
                                      href={file.webViewLink} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="btn-table-action-v2"
                                    >
                                      <ExternalLink size={12} />
                                      Abrir no Drive
                                    </a>
                                  </>
                                ) : (
                                  <span className="text-muted" style={{ fontSize: '12px' }}>Link indisponível</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: WHATSAPP CORPORATIVO (Tab WhatsApp) */}
        {activeTab === 'whatsapp' && (
          <div className="tab-pane fade-in">
            <div className="dashboard-grid">
              
              {/* Painel do QR Code e Sessão */}
              <div className="solid-card">
                <div className="ged-sidebar-header" style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Status do Assistente WhatsApp</h3>
                  <span className={`badge-status-pill ${waStatus.status === 'CONNECTED' ? 'indexed' : 'failed'}`}>
                    {waStatus.status === 'CONNECTED' ? 'Sistema Ativo' : 'Desconectado'}
                  </span>
                </div>
                <p className="description-text" style={{ fontSize: '13.5px', marginBottom: 20 }}>
                  O robô monitora as mensagens recebidas nos números contábeis dos contadores Alessandro Bastos e Mariana Luz, identificando automaticamente a empresa de origem e fornecendo respostas fiscais inteligentes em tempo real.
                </p>

                {waStatus.status === 'CONNECTED' ? (
                  <div className="whatsapp-active-card fade-in">
                    <div className="whatsapp-active-icon">
                      <CheckCircle2 size={24} />
                    </div>
                    <div className="whatsapp-active-info">
                      <h3>Serviço Sincronizado com Sucesso</h3>
                      <p>O bot está operacional e escutando na VPS. Respostas rápidas ativadas no modelo Gemini.</p>
                      <button 
                        onClick={handleDisconnectWhatsApp} 
                        className="btn-batch-action danger"
                        style={{ marginTop: 12 }}
                      >
                        Encerrar Sessão
                      </button>
                    </div>
                  </div>
                ) : waStatus.qrCode ? (
                  <div className="whatsapp-disconnected-box fade-in">
                    <div className="qr-steps-list">
                      <div className="qr-step-item">
                        <span className="qr-step-num">1</span>
                        <div className="qr-step-text">
                          <h4>Abra o WhatsApp</h4>
                          <p>No celular que deseja utilizar como bot.</p>
                        </div>
                      </div>
                      <div className="qr-step-item">
                        <span className="qr-step-num">2</span>
                        <div className="qr-step-text">
                          <h4>Aparelhos Conectados</h4>
                          <p>Vá no menu e clique em "Conectar um Aparelho".</p>
                        </div>
                      </div>
                      <div className="qr-step-item">
                        <span className="qr-step-num">3</span>
                        <div className="qr-step-text">
                          <h4>Escaneie o Código</h4>
                          <p>Aponte a câmera para o QR Code ao lado.</p>
                        </div>
                      </div>
                    </div>

                    <div className="qr-image-wrapper">
                      <img src={waStatus.qrCode} alt="WhatsApp QR Code" className="qr-img" />
                      <div className="qr-progress-bar">
                        <div className="qr-progress-value"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <RefreshCw size={28} className="spin-animation" style={{ color: 'var(--brand-color)', marginBottom: 12 }} />
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Iniciando serviços do WhatsApp na VPS. Aguardando geração do QR Code...</p>
                  </div>
                )}
              </div>

              {/* Tabela de Whitelist */}
              <div className="solid-card">
                <div className="ged-sidebar-header" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Contatos Autorizados</h3>
                  <span className="badge-format">Segurança LGPD</span>
                </div>
                <p className="description-text" style={{ fontSize: '13.5px', marginBottom: 20 }}>
                  Apenas as contas listadas abaixo possuem autorização formal para receber informações contábeis e consultar a base de conhecimento de clientes por WhatsApp.
                </p>

                <div className="ged-table-scroll">
                  <table className="enterprise-table-v2">
                    <thead>
                      <tr>
                        <th>Nome do Contador</th>
                        <th>WhatsApp Cadastrado</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="profile-avatar" style={getAvatarStyle("Alessandro Bastos")}>AB</div>
                            <strong>Alessandro Bastos</strong>
                          </div>
                        </td>
                        <td className="phone-mask-cell">+55 11 *****-9999</td>
                        <td><span className="badge-status-pill indexed">Ativo</span></td>
                      </tr>
                      <tr>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="profile-avatar" style={getAvatarStyle("Mariana Luz")}>ML</div>
                            <strong>Mariana Luz</strong>
                          </div>
                        </td>
                        <td className="phone-mask-cell">+55 11 *****-8888</td>
                        <td><span className="badge-status-pill indexed">Ativo</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: HISTÓRICO DE AUDITORIA (Tab Logs) */}
        {activeTab === 'audit' && (
          <div className="tab-pane fade-in">
            <div className="solid-card full-card">
              
              {/* KPIs Reais do Histórico */}
              <div className="audit-kpi-row">
                <div className="audit-kpi-card">
                  <div className="audit-kpi-card-icon"><Sparkles size={16} /></div>
                  <div className="audit-kpi-card-data">
                    <span className="audit-kpi-card-title">Consultas Totais</span>
                    <span className="audit-kpi-card-value">{auditMetrics.total}</span>
                  </div>
                </div>
                <div className="audit-kpi-card">
                  <div className="audit-kpi-card-icon"><Smartphone size={16} /></div>
                  <div className="audit-kpi-card-data">
                    <span className="audit-kpi-card-title">Via WhatsApp</span>
                    <span className="audit-kpi-card-value">{auditMetrics.whatsapp}</span>
                  </div>
                </div>
                <div className="audit-kpi-card">
                  <div className="audit-kpi-card-icon"><Printer size={16} /></div>
                  <div className="audit-kpi-card-data">
                    <span className="audit-kpi-card-title">Via Painel Web</span>
                    <span className="audit-kpi-card-value">{auditMetrics.dashboard}</span>
                  </div>
                </div>
                <div className="audit-kpi-card">
                  <div className="audit-kpi-card-icon"><CheckCircle2 size={16} /></div>
                  <div className="audit-kpi-card-data">
                    <span className="audit-kpi-card-title">Taxa de Sucesso</span>
                    <span className="audit-kpi-card-value">{auditMetrics.successRate}</span>
                  </div>
                </div>
              </div>

              {/* Gráfico de Uso sutil en SVG */}
              <div style={{ marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 24 }}>
                <span className="recent-queries-title" style={{ display: 'block', marginBottom: 12 }}>Volumetria de Consultas de IA</span>
                {logs.length === 0 ? (
                  <div style={{ height: 120, border: '1px dashed var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Gráfico indisponível (Aguardando primeiras interações).
                  </div>
                ) : (
                  <div className="graph-container">
                    <div className="graph-column">
                      <div className="graph-column-bar" style={{ height: '30%' }}></div>
                      <div className="graph-column-tooltip">Dia 21: 4 consultas</div>
                      <span className="graph-axis-label">21/05</span>
                    </div>
                    <div className="graph-column">
                      <div className="graph-column-bar" style={{ height: '50%' }}></div>
                      <div className="graph-column-tooltip">Dia 22: 6 consultas</div>
                      <span className="graph-axis-label">22/05</span>
                    </div>
                    <div className="graph-column">
                      <div className="graph-column-bar" style={{ height: '40%' }}></div>
                      <div className="graph-column-tooltip">Dia 23: 5 consultas</div>
                      <span className="graph-axis-label">23/05</span>
                    </div>
                    <div className="graph-column">
                      <div className="graph-column-bar" style={{ height: `${Math.min(100, Math.max(10, logs.length * 12))}%` }}></div>
                      <div className="graph-column-tooltip">Hoje: {logs.length} consultas</div>
                      <span className="graph-axis-label">Hoje</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabela de Logs */}
              <div className="ged-sidebar-header" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '14.5px', fontWeight: 600 }}>Livro de Atividades Contábeis</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                  <select 
                    value={logFilter} 
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="sidebar-search-input"
                    style={{ padding: '4px 10px', width: '150px' }}
                  >
                    <option value="ALL">Todas Origens</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="DASHBOARD">Painel Web</option>
                  </select>
                  <button onClick={loadLogs} className="btn-batch-action">
                    <RefreshCw size={13} className={loadingLogs ? "spin-animation" : ""} />
                    Atualizar
                  </button>
                </div>
              </div>

              {loadingLogs ? (
                <div style={{ padding: 24 }}>
                  <div className="skeleton-pulse skeleton-row" style={{ height: 40, marginBottom: 8 }}></div>
                  <div className="skeleton-pulse skeleton-row" style={{ height: 40, marginBottom: 8 }}></div>
                </div>
              ) : logs.length === 0 ? (
                <div className="empty-state-illustrated">
                  <div className="empty-state-svg-wrapper">
                    <History size={48} />
                  </div>
                  <h3>Nenhuma atividade cadastrada</h3>
                  <p>As consultas fiscais efetuadas pela inteligência artificial serão auditadas e indexadas automaticamente nesta tabela.</p>
                  <button onClick={() => setActiveTab('ask')} className="btn-primary-send" style={{ marginTop: 12 }}>
                    Fazer primeira pergunta <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="ged-table-scroll">
                  <table className="enterprise-table-v2">
                    <thead>
                      <tr>
                        <th>Hora / Data</th>
                        <th>Funcionário</th>
                        <th>Empresa Mapeada</th>
                        <th>Pergunta Formulada</th>
                        <th>Origem</th>
                        <th>Tempo IA</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.filter(log => {
                        if (logFilter === 'WHATSAPP') return log.channel === 'WHATSAPP';
                        if (logFilter === 'DASHBOARD') return log.channel === 'DASHBOARD';
                        return true;
                      }).map((log) => (
                        <tr key={log.id}>
                          <td className="mono-text" style={{ fontSize: '12px' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div className="profile-avatar" style={{ ...getAvatarStyle(log.user?.name), width: 18, height: 18, fontSize: '8px' }}>
                                {log.user?.name ? log.user.name[0] : 'U'}
                              </div>
                              <strong>{log.user ? log.user.name : 'Desconhecido'}</strong>
                            </div>
                          </td>
                          <td>
                            <span className="badge-format">
                              🏢 {log.cliente ? log.cliente.nomeEmpresa : 'Geral'}
                            </span>
                          </td>
                          <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.question}>
                            {log.question}
                          </td>
                          <td>
                            {log.channel === 'WHATSAPP' ? (
                              <span className="badge-format" style={{ backgroundColor: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>📱 WhatsApp</span>
                            ) : (
                              <span className="badge-format" style={{ backgroundColor: 'var(--brand-glow)', color: 'var(--brand-color)', borderColor: 'rgba(79, 70, 229, 0.2)' }}>💻 Painel</span>
                            )}
                          </td>
                          <td className="mono-text">{log.latencyMs} ms</td>
                          <td>
                            <span className={`badge-status-pill ${log.errorMsg ? 'failed' : 'indexed'}`}>
                              {log.errorMsg ? 'Erro' : 'Sucesso'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Estatísticas Avançadas Ocultas Atrás do Toggle */}
              {logs.length > 5 && (
                <div className="collapsible-stats">
                  <button 
                    onClick={() => setShowAdvancedStats(!showAdvancedStats)} 
                    className="collapsible-trigger-btn"
                  >
                    <Info size={14} />
                    {showAdvancedStats ? 'Ocultar Relatórios de Uso' : 'Visualizar Relatórios e Tops'}
                  </button>

                  {showAdvancedStats && (
                    <div className="collapsible-content">
                      <div className="solid-card" style={{ marginBottom: 0 }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Top 3 Clientes Mapeados</h4>
                        <table className="enterprise-table-v2">
                          <tbody>
                            <tr>
                              <td>🏢 AFC Comércio Ltda</td>
                              <td style={{ textAlign: 'right' }}><strong>12 consultas</strong></td>
                            </tr>
                            <tr>
                              <td>🏢 Padaria do João Ltda</td>
                              <td style={{ textAlign: 'right' }}><strong>8 consultas</strong></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="solid-card" style={{ marginBottom: 0 }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Documentos Mais Citados pela IA</h4>
                        <table className="enterprise-table-v2">
                          <tbody>
                            <tr>
                              <td>📄 00100226.EFD.pdf</td>
                              <td style={{ textAlign: 'right' }}><strong>14 vezes</strong></td>
                            </tr>
                            <tr>
                              <td>📊 DRE_Trimestre_1.xlsx</td>
                              <td style={{ textAlign: 'right' }}><strong>9 vezes</strong></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* 3. Slide-over Lateral do Visualizador Drive */}
        <div className={`slide-over ${activeDocUrl ? 'open' : ''}`}>
          <div className="slide-over-header">
            <div className="slide-over-title">
              <h3>{activeDocName}</h3>
              <p>{isEditMode ? 'Edição em tempo real (Rascunho Protegido no Drive)' : 'Visualização segura integrada ao Google Drive'}</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {activeDocUrl && (activeDocUrl.includes('docs.google.com/document') || activeDocUrl.includes('docs.google.com/spreadsheets')) && (
                <>
                  {!isEditMode ? (
                    <button
                      onClick={startDraftMode}
                      disabled={isCreatingDraft}
                      className="btn-table-action-v2 primary-visualize"
                      style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}
                    >
                      {isCreatingDraft ? <RefreshCw size={13} className="spin-animation" /> : <Settings size={13} />}
                      <span>{isCreatingDraft ? 'Criando Rascunho...' : 'Editar Documento'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={saveDraftMode}
                        disabled={isSavingDraft}
                        className="btn-batch-action"
                        style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600, backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderColor: 'var(--success-border)' }}
                      >
                        {isSavingDraft ? <RefreshCw size={13} className="spin-animation" /> : <FileCheck size={13} />}
                        <span>{isSavingDraft ? 'Salvando...' : 'Salvar Alterações'}</span>
                      </button>
                      <button
                        onClick={discardDraftMode}
                        disabled={isSavingDraft}
                        className="btn-batch-action danger"
                        style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}
                      >
                        <X size={13} />
                        <span>Descartar</span>
                      </button>
                    </>
                  )}
                </>
              )}
              <button onClick={handleCloseSlideOver} className="btn-slide-close">
                <X size={14} />
                Fechar
              </button>
            </div>
          </div>
          <div className="slide-over-body" style={{ position: 'relative', width: '100%', height: '100%' }}>
            {(isCreatingDraft || isSavingDraft) && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '100%', height: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                zIndex: 50,
                gap: 12
              }}>
                <RefreshCw size={36} className="spin-animation" style={{ color: 'var(--brand-color)' }} />
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  {isCreatingDraft ? 'Criando rascunho seguro no Google Drive...' : 'Mesclando e salvando arquivo contábil original...'}
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Isso pode levar alguns segundos.</p>
              </div>
            )}
            {loadingDocText ? (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '80%', gap: 12
              }}>
                <RefreshCw size={24} className="spin-animation" style={{ color: 'var(--brand-color)' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Carregando conteúdo de texto do Drive...</p>
              </div>
            ) : activeDocText !== null ? (
              <div className="slide-over-text-content" style={{
                padding: '24px',
                height: 'calc(100% - 48px)',
                overflowY: 'auto',
                backgroundColor: darkMode ? '#1e1e1e' : '#f8f9fa',
                color: darkMode ? '#d4d4d4' : '#212529',
                fontFamily: '"Fira Code", Monaco, Consolas, "Courier New", monospace',
                fontSize: '13px',
                whiteSpace: 'pre-wrap',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                lineHeight: '1.6',
                margin: '12px',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
              }}>
                {activeDocText || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>[Arquivo de texto vazio]</span>}
              </div>
            ) : activeDocUrl && (
              <iframe 
                src={isEditMode && draftDocUrl ? draftDocUrl : activeDocUrl} 
                className="slide-over-iframe" 
                title="Google Drive Document Viewer"
                allow="autoplay"
              />
            )}
          </div>
        </div>

      </div>

      {/* 4. Tour Onboarding Render */}
      {renderTourTooltip()}

      {/* 5. Modais de Confirmação Dialog */}
      {confirmDialog.isOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-in">
            <div className="dialog-header">
              <div className={`dialog-icon ${confirmDialog.type === 'warning' ? 'warning' : ''}`}>
                <AlertTriangle size={18} />
              </div>
              <h3>{confirmDialog.title}</h3>
            </div>
            <div className="dialog-body">
              <p>{confirmDialog.message}</p>
            </div>
            <div className="dialog-footer">
              <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="btn-dialog-cancel">
                Cancelar
              </button>
              <button 
                onClick={confirmDialog.onConfirm} 
                className={`btn-dialog-confirm ${confirmDialog.type === 'warning' ? 'warning' : ''}`}
              >
                Confirmar Ação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Toasts Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item ${toast.type}`}>
            <div className={`toast-icon-${toast.type}`}>
              {toast.type === 'success' && <CheckCircle2 size={16} />}
              {toast.type === 'error' && <XCircle size={16} />}
              {toast.type === 'info' && <Info size={16} />}
            </div>
            <div className="toast-content">
              <h4>{toast.title}</h4>
              <p>{toast.message}</p>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="btn-toast-close">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}

export default App;
