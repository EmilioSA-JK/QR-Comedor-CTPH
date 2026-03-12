import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { Toaster, toast } from 'sonner';
import {
  Users, QrCode, FileText, Settings, LogOut, Plus, Trash2, Edit2, Search,
  Camera, X, Download, Calendar, Home, UserCheck, AlertCircle,
  CheckCircle, Loader2, Menu, Lock, ArrowLeft
} from 'lucide-react';
import './App.css';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// API Helper
const api = {
  async fetch(endpoint, options = {}) {
    const token = localStorage.getItem('ctph_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    
    if (response.status === 401) {
      localStorage.removeItem('ctph_token');
      throw new Error('Sesión expirada');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error de conexión' }));
      throw new Error(error.detail || 'Error en la solicitud');
    }

    if (response.headers.get('content-type')?.includes('application/pdf')) {
      return response.blob();
    }

    return response.json();
  },

  get: (endpoint) => api.fetch(endpoint),
  post: (endpoint, data) => api.fetch(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data) => api.fetch(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint) => api.fetch(endpoint, { method: 'DELETE' }),
};

// API sin autenticación para el escáner
const publicApi = {
  async post(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error de conexión' }));
      throw new Error(error.detail || 'Error en la solicitud');
    }

    return response.json();
  }
};

// ==================== SCANNER PRINCIPAL (SIN LOGIN) ====================
function MainScanner({ onAdminAccess }) {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const html5QrCodeRef = useRef(null);

  const startScanner = useCallback(async () => {
    try {
      const html5QrCode = new Html5Qrcode("qr-reader-main");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 300, height: 300 } },
        async (decodedText) => {
          html5QrCode.pause();
          
          try {
            const response = await publicApi.post('/api/registros', { cedula: decodedText });
            setLastScan({
              success: true,
              data: response.registro
            });
            setScanHistory(prev => [response.registro, ...prev.slice(0, 9)]);
            toast.success(`✓ ${response.registro.nombre_completo}`);
          } catch (error) {
            setLastScan({
              success: false,
              error: error.message,
              cedula: decodedText
            });
            toast.error(error.message);
          }
          
          setTimeout(() => {
            if (html5QrCodeRef.current) {
              html5QrCodeRef.current.resume();
            }
          }, 2000);
        },
        () => {}
      );

      setScanning(true);
    } catch (error) {
      toast.error('Error al iniciar la cámara: ' + error.message);
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="main-scanner-container" data-testid="main-scanner">
      <header className="scanner-header">
        <div className="scanner-logo">
          <QrCode size={36} />
          <div>
            <h1>SystemQr</h1>
            <span>CTPH - Control de Asistencia</span>
          </div>
        </div>
        <button className="btn btn-admin" onClick={onAdminAccess} data-testid="admin-access-btn">
          <Lock size={18} /> Administración
        </button>
      </header>

      <main className="scanner-main">
        <div className="scanner-area">
          <div className="scanner-viewport-main">
            <div id="qr-reader-main" className={scanning ? 'active' : ''}></div>
            
            {!scanning && (
              <div className="scanner-placeholder-main">
                <Camera size={80} />
                <p>Cámara no iniciada</p>
              </div>
            )}
          </div>

          <div className="scanner-controls-main">
            {!scanning ? (
              <button className="btn btn-accent btn-large" onClick={startScanner} data-testid="start-scanner-btn">
                <Camera size={24} /> Iniciar Cámara
              </button>
            ) : (
              <button className="btn btn-secondary btn-large" onClick={stopScanner} data-testid="stop-scanner-btn">
                <X size={24} /> Detener Cámara
              </button>
            )}
          </div>

          {lastScan && (
            <div className={`scan-result-main ${lastScan.success ? 'success' : 'error'}`} data-testid="last-scan-result">
              {lastScan.success ? (
                <>
                  <CheckCircle size={48} />
                  <div className="scan-result-info">
                    <h2>Asistencia Registrada</h2>
                    <p className="student-name">{lastScan.data.nombre_completo}</p>
                    <p className="student-details">
                      {lastScan.data.especialidad} | {lastScan.data.grado}° {lastScan.data.seccion}
                    </p>
                    <p className="scan-time">{lastScan.data.hora}</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle size={48} />
                  <div className="scan-result-info">
                    <h2>Error</h2>
                    <p>{lastScan.error}</p>
                    <p className="font-mono">Cédula: {lastScan.cedula}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="scan-history-panel">
          <h3>Últimos Registros</h3>
          {scanHistory.length === 0 ? (
            <p className="no-history">No hay registros aún</p>
          ) : (
            <ul className="history-list-main">
              {scanHistory.map((reg, idx) => (
                <li key={idx} className="history-item-main">
                  <span className="history-name">{reg.nombre_completo}</span>
                  <span className="history-time">{reg.hora}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
    </div>
  );
}

// ==================== LOGIN PARA ADMINISTRACIÓN ====================
function AdminLogin({ onLogin, onBack }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post('/api/auth/login', { usuario, password });
      localStorage.setItem('ctph_token', data.token);
      localStorage.setItem('ctph_user', JSON.stringify({ usuario: data.usuario, nombre: data.nombre }));
      onLogin(data);
      toast.success('¡Bienvenido!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container" data-testid="admin-login">
      <button className="btn-back" onClick={onBack} data-testid="back-to-scanner">
        <ArrowLeft size={20} /> Volver al Escáner
      </button>
      
      <div className="admin-login-card">
        <div className="login-logo">
          <Lock size={48} />
        </div>
        <h2>Acceso Administrativo</h2>
        <p>Ingresa tus credenciales de administrador</p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="usuario">Usuario</label>
            <input
              id="usuario"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              data-testid="login-usuario-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="login-password-input"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading} data-testid="login-submit-btn">
            {loading ? <Loader2 className="spin" size={20} /> : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==================== PANEL ADMINISTRATIVO ====================
function AdminPanel({ user, onLogout }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'estudiantes', icon: Users, label: 'Estudiantes' },
    { id: 'registros', icon: UserCheck, label: 'Registros' },
    { id: 'reportes', icon: FileText, label: 'Reportes' },
    { id: 'admin', icon: Settings, label: 'Administradores' },
  ];

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'estudiantes': return <Estudiantes />;
      case 'registros': return <Registros />;
      case 'reportes': return <Reportes />;
      case 'admin': return <AdminManagement />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="admin-panel" data-testid="admin-panel">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
            <Menu size={24} />
          </button>
          {!collapsed && (
            <div className="sidebar-logo">
              <QrCode size={28} />
              <span>CTPH</span>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => setActiveView(item.id)}
              data-testid={`nav-${item.id}`}
              title={item.label}
            >
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && (
            <div className="user-info">
              <span className="user-name">{user?.nombre}</span>
              <span className="user-role">Administrador</span>
            </div>
          )}
          <button className="sidebar-item" onClick={onLogout} data-testid="back-to-scanner-btn" title="Volver al Escáner">
            <ArrowLeft size={20} />
            {!collapsed && <span>Volver al Escáner</span>}
          </button>
        </div>
      </aside>

      <main className="main-content">
        {renderView()}
      </main>
    </div>
  );
}

// ==================== DASHBOARD ====================
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [registrosHoy, setRegistrosHoy] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, registrosData] = await Promise.all([
        api.get('/api/stats'),
        api.get('/api/registros/hoy')
      ]);
      setStats(statsData);
      setRegistrosHoy(registrosData.registros || []);
    } catch (error) {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-container"><Loader2 className="spin" size={40} /></div>;
  }

  return (
    <div className="dashboard" data-testid="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Resumen del sistema de asistencia</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon students"><Users size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.total_estudiantes || 0}</span>
            <span className="stat-label">Total Estudiantes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon today"><UserCheck size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.registros_hoy || 0}</span>
            <span className="stat-label">Registros Hoy</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon electro"><Settings size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.por_especialidad?.['Electromecánica'] || 0}</span>
            <span className="stat-label">Electromecánica</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon redes"><QrCode size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.por_especialidad?.['Redes'] || 0}</span>
            <span className="stat-label">Redes</span>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Últimos Registros de Hoy</h2>
        {registrosHoy.length === 0 ? (
          <div className="empty-state">
            <UserCheck size={48} />
            <p>No hay registros de asistencia hoy</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cédula</th>
                  <th>Nombre</th>
                  <th>Especialidad</th>
                  <th>Grado</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {registrosHoy.slice(0, 10).map((reg, idx) => (
                  <tr key={idx}>
                    <td className="font-mono">{reg.cedula}</td>
                    <td>{reg.nombre_completo}</td>
                    <td><span className={`badge ${reg.especialidad === 'Electromecánica' ? 'badge-electro' : 'badge-redes'}`}>{reg.especialidad}</span></td>
                    <td>{reg.grado}° - {reg.seccion}</td>
                    <td>{reg.hora}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== ESTUDIANTES ====================
function Estudiantes() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedEstudiante, setSelectedEstudiante] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [filters, setFilters] = useState({ especialidad: '', grado: '', buscar: '' });
  const [formData, setFormData] = useState({
    cedula: '', nombre: '', apellido1: '', apellido2: '',
    especialidad: 'Electromecánica', grado: '10', seccion: ''
  });

  useEffect(() => {
    loadEstudiantes();
  }, [filters.especialidad, filters.grado]);

  const loadEstudiantes = async () => {
    setLoading(true);
    try {
      let query = '/api/estudiantes?';
      if (filters.especialidad) query += `especialidad=${filters.especialidad}&`;
      if (filters.grado) query += `grado=${filters.grado}&`;
      if (filters.buscar) query += `buscar=${filters.buscar}&`;
      
      const data = await api.get(query);
      setEstudiantes(data);
    } catch (error) {
      toast.error('Error al cargar estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => loadEstudiantes();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedEstudiante) {
        await api.put(`/api/estudiantes/${selectedEstudiante.cedula}`, formData);
        toast.success('Estudiante actualizado');
      } else {
        await api.post('/api/estudiantes', formData);
        toast.success('Estudiante creado');
      }
      setShowModal(false);
      resetForm();
      loadEstudiantes();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (cedula) => {
    if (!window.confirm('¿Está seguro de eliminar este estudiante?')) return;
    try {
      await api.delete(`/api/estudiantes/${cedula}`);
      toast.success('Estudiante eliminado');
      loadEstudiantes();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleShowQR = async (estudiante) => {
    try {
      const data = await api.get(`/api/qr/${estudiante.cedula}`);
      setQrData(data);
      setShowQRModal(true);
    } catch (error) {
      toast.error('Error al generar QR');
    }
  };

  const handleEdit = (estudiante) => {
    setSelectedEstudiante(estudiante);
    setFormData({ ...estudiante });
    setShowModal(true);
  };

  const resetForm = () => {
    setSelectedEstudiante(null);
    setFormData({
      cedula: '', nombre: '', apellido1: '', apellido2: '',
      especialidad: 'Electromecánica', grado: '10', seccion: ''
    });
  };

  const downloadQR = () => {
    if (!qrData) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${qrData.qr_base64}`;
    link.download = `QR_${qrData.estudiante.cedula}.png`;
    link.click();
  };

  return (
    <div className="estudiantes" data-testid="estudiantes-view">
      <div className="page-header">
        <div>
          <h1>Gestión de Estudiantes</h1>
          <p>Administra los estudiantes del sistema</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }} data-testid="add-student-btn">
          <Plus size={18} /> Agregar Estudiante
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por cédula o nombre..."
            value={filters.buscar}
            onChange={(e) => setFilters({ ...filters, buscar: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <select value={filters.especialidad} onChange={(e) => setFilters({ ...filters, especialidad: e.target.value })}>
          <option value="">Todas las especialidades</option>
          <option value="Electromecánica">Electromecánica</option>
          <option value="Redes">Redes</option>
        </select>
        <select value={filters.grado} onChange={(e) => setFilters({ ...filters, grado: e.target.value })}>
          <option value="">Todos los grados</option>
          <option value="10">10°</option>
          <option value="11">11°</option>
          <option value="12">12°</option>
        </select>
        <button className="btn btn-secondary" onClick={handleSearch}>Buscar</button>
      </div>

      {loading ? (
        <div className="loading-container"><Loader2 className="spin" size={40} /></div>
      ) : estudiantes.length === 0 ? (
        <div className="empty-state">
          <Users size={64} />
          <h3>No hay estudiantes</h3>
          <p>Agrega estudiantes para comenzar</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Nombre Completo</th>
                <th>Especialidad</th>
                <th>Grado</th>
                <th>Sección</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((est) => (
                <tr key={est.cedula}>
                  <td className="font-mono">{est.cedula}</td>
                  <td>{est.nombre} {est.apellido1} {est.apellido2}</td>
                  <td><span className={`badge ${est.especialidad === 'Electromecánica' ? 'badge-electro' : 'badge-redes'}`}>{est.especialidad}</span></td>
                  <td>{est.grado}°</td>
                  <td>{est.seccion}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleShowQR(est)} title="Ver QR"><QrCode size={18} /></button>
                      <button className="btn-icon" onClick={() => handleEdit(est)} title="Editar"><Edit2 size={18} /></button>
                      <button className="btn-icon danger" onClick={() => handleDelete(est.cedula)} title="Eliminar"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEstudiante ? 'Editar Estudiante' : 'Agregar Estudiante'}</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Cédula *</label>
                  <input type="text" value={formData.cedula} onChange={(e) => setFormData({ ...formData, cedula: e.target.value })} required disabled={!!selectedEstudiante} />
                </div>
                <div className="form-group">
                  <label>Nombre *</label>
                  <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Primer Apellido *</label>
                  <input type="text" value={formData.apellido1} onChange={(e) => setFormData({ ...formData, apellido1: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Segundo Apellido *</label>
                  <input type="text" value={formData.apellido2} onChange={(e) => setFormData({ ...formData, apellido2: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Especialidad *</label>
                  <select value={formData.especialidad} onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })} required>
                    <option value="Electromecánica">Electromecánica</option>
                    <option value="Redes">Redes</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Grado *</label>
                  <select value={formData.grado} onChange={(e) => setFormData({ ...formData, grado: e.target.value })} required>
                    <option value="10">10°</option>
                    <option value="11">11°</option>
                    <option value="12">12°</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Sección *</label>
                  <input type="text" value={formData.seccion} onChange={(e) => setFormData({ ...formData, seccion: e.target.value })} required placeholder="A, B, C..." />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{selectedEstudiante ? 'Actualizar' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQRModal && qrData && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Código QR</h2>
              <button className="btn-close" onClick={() => setShowQRModal(false)}><X size={20} /></button>
            </div>
            <div className="qr-content">
              <div className="qr-image">
                <img src={`data:image/png;base64,${qrData.qr_base64}`} alt="QR Code" />
              </div>
              <div className="qr-info">
                <p><strong>Cédula:</strong> <span className="font-mono">{qrData.estudiante.cedula}</span></p>
                <p><strong>Nombre:</strong> {qrData.estudiante.nombre} {qrData.estudiante.apellido1} {qrData.estudiante.apellido2}</p>
                <p><strong>Especialidad:</strong> {qrData.estudiante.especialidad}</p>
                <p><strong>Grado:</strong> {qrData.estudiante.grado}° - {qrData.estudiante.seccion}</p>
              </div>
              <button className="btn btn-primary btn-full" onClick={downloadQR}>
                <Download size={18} /> Descargar QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== REGISTROS ====================
function Registros() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    cedula: ''
  });

  useEffect(() => {
    loadRegistros();
  }, []);

  const loadRegistros = async () => {
    setLoading(true);
    try {
      let query = '/api/registros?';
      if (filters.fecha_inicio) query += `fecha_inicio=${filters.fecha_inicio}&`;
      if (filters.fecha_fin) query += `fecha_fin=${filters.fecha_fin}&`;
      if (filters.cedula) query += `cedula=${filters.cedula}&`;
      
      const data = await api.get(query);
      setRegistros(data);
    } catch (error) {
      toast.error('Error al cargar registros');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registros" data-testid="registros-view">
      <div className="page-header">
        <h1>Historial de Registros</h1>
        <p>Consulta los registros de asistencia</p>
      </div>

      <div className="filters-bar">
        <div className="form-group">
          <label>Fecha Inicio</label>
          <input type="date" value={filters.fecha_inicio} onChange={(e) => setFilters({ ...filters, fecha_inicio: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Fecha Fin</label>
          <input type="date" value={filters.fecha_fin} onChange={(e) => setFilters({ ...filters, fecha_fin: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Cédula</label>
          <input type="text" placeholder="Filtrar por cédula" value={filters.cedula} onChange={(e) => setFilters({ ...filters, cedula: e.target.value })} />
        </div>
        <button className="btn btn-primary" onClick={loadRegistros}><Search size={18} /> Buscar</button>
      </div>

      {loading ? (
        <div className="loading-container"><Loader2 className="spin" size={40} /></div>
      ) : registros.length === 0 ? (
        <div className="empty-state">
          <UserCheck size={64} />
          <h3>No hay registros</h3>
          <p>No se encontraron registros en el rango seleccionado</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Nombre Completo</th>
                <th>Especialidad</th>
                <th>Grado</th>
                <th>Sección</th>
                <th>Fecha</th>
                <th>Hora</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((reg, idx) => (
                <tr key={idx}>
                  <td className="font-mono">{reg.cedula}</td>
                  <td>{reg.nombre_completo}</td>
                  <td><span className={`badge ${reg.especialidad === 'Electromecánica' ? 'badge-electro' : 'badge-redes'}`}>{reg.especialidad}</span></td>
                  <td>{reg.grado}°</td>
                  <td>{reg.seccion}</td>
                  <td>{reg.fecha}</td>
                  <td>{reg.hora}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">Total: {registros.length} registros</div>
        </div>
      )}
    </div>
  );
}

// ==================== REPORTES ====================
function Reportes() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(false);

  const generarPDF = async () => {
    if (!fechaInicio || !fechaFin) {
      toast.error('Selecciona un rango de fechas');
      return;
    }
    setLoading(true);
    try {
      const blob = await api.post('/api/reportes/pdf', { fecha_inicio: fechaInicio, fecha_fin: fechaFin });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_asistencia_${fechaInicio}_${fechaFin}.pdf`;
      link.click();
      toast.success('Reporte generado');
    } catch (error) {
      toast.error('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const setQuickRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setFechaInicio(start.toISOString().split('T')[0]);
    setFechaFin(end.toISOString().split('T')[0]);
  };

  return (
    <div className="reportes" data-testid="reportes-view">
      <div className="page-header">
        <h1>Generación de Reportes</h1>
        <p>Genera informes PDF de asistencia</p>
      </div>

      <div className="reportes-container">
        <div className="reportes-card">
          <FileText size={48} />
          <h2>Reporte de Asistencia</h2>
          <p>Selecciona el rango de fechas</p>

          <div className="quick-ranges">
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickRange(0)}>Hoy</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickRange(7)}>Última Semana</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickRange(30)}>Último Mes</button>
          </div>

          <div className="date-range-inputs">
            <div className="form-group">
              <label><Calendar size={16} /> Fecha Inicio</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="form-group">
              <label><Calendar size={16} /> Fecha Fin</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </div>

          <button className="btn btn-primary btn-large btn-full" onClick={generarPDF} disabled={loading || !fechaInicio || !fechaFin}>
            {loading ? <><Loader2 className="spin" size={20} /> Generando...</> : <><Download size={20} /> Generar PDF</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== ADMINISTRADORES ====================
function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ usuario: '', password: '', nombre: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      const data = await api.get('/api/administradores');
      setAdmins(data);
    } catch (error) {
      toast.error('Error al cargar administradores');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/auth/register', formData);
      toast.success('Administrador registrado');
      setShowModal(false);
      setFormData({ usuario: '', password: '', nombre: '' });
      loadAdmins();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (usuario) => {
    if (!window.confirm(`¿Eliminar administrador "${usuario}"?`)) return;
    try {
      await api.delete(`/api/administradores/${usuario}`);
      toast.success('Administrador eliminado');
      loadAdmins();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="admin-management" data-testid="admin-view">
      <div className="page-header">
        <div>
          <h1>Administradores</h1>
          <p>Gestión de usuarios administradores</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nuevo Administrador
        </button>
      </div>

      {loading ? (
        <div className="loading-container"><Loader2 className="spin" size={40} /></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre</th>
                <th>Fecha Creación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.usuario}>
                  <td className="font-mono">{admin.usuario}</td>
                  <td>{admin.nombre}</td>
                  <td>{admin.creado ? new Date(admin.creado).toLocaleDateString('es-CR') : 'N/A'}</td>
                  <td>
                    <button className="btn-icon danger" onClick={() => handleDelete(admin.usuario)} title="Eliminar">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nuevo Administrador</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Nombre Completo *</label>
                <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Usuario *</label>
                <input type="text" value={formData.usuario} onChange={(e) => setFormData({ ...formData, usuario: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Contraseña *</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== APP PRINCIPAL ====================
function App() {
  const [view, setView] = useState('scanner'); // 'scanner', 'login', 'admin'
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('ctph_token');
    const savedUser = localStorage.getItem('ctph_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleAdminAccess = () => {
    const token = localStorage.getItem('ctph_token');
    if (token && user) {
      setView('admin');
    } else {
      setView('login');
    }
  };

  const handleLogin = (data) => {
    setUser({ usuario: data.usuario, nombre: data.nombre });
    setView('admin');
  };

  const handleBackToScanner = () => {
    setView('scanner');
  };

  const handleLogout = () => {
    localStorage.removeItem('ctph_token');
    localStorage.removeItem('ctph_user');
    setUser(null);
    setView('scanner');
    toast.success('Sesión cerrada');
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      {view === 'scanner' && (
        <MainScanner onAdminAccess={handleAdminAccess} />
      )}
      {view === 'login' && (
        <AdminLogin onLogin={handleLogin} onBack={handleBackToScanner} />
      )}
      {view === 'admin' && (
        <AdminPanel user={user} onLogout={handleBackToScanner} />
      )}
    </>
  );
}

export default App;
