/* ============================================================
   Universidad Politécnica de Francisco I. Madero
   Proyecto: ERP de Venta de Motos
   Archivo:  app.js  —  Utilidades globales y cliente REST
   ============================================================ */

const API_BASE = 'http://localhost:8081/api';

/* ── Permisos por rol ────────────────────────────────────── */
const Permisos = {
    MODULOS: {
        dashboard:  ['Administrador', 'Vendedor', 'Contador', 'Almacenista'],
        ventas:     ['Administrador', 'Vendedor'],
        clientes:   ['Administrador', 'Vendedor'],
        finanzas:   ['Administrador', 'Contador'],
        inventario: ['Administrador', 'Almacenista'],
        empleados:  ['Administrador'],
        proveedores:  ['Administrador']
    },

    rol() {
        return Sesion.obtener()?.rol ?? null;
    },

    puedeAcceder(modulo) {
        const rol = this.rol();
        if (!rol) return false;
        const permitidos = this.MODULOS[modulo];
        return permitidos ? permitidos.includes(rol) : false;
    },

    requerirModulo(modulo) {
        if (!this.puedeAcceder(modulo)) {
            mostrarAlerta('No tienes permiso para acceder a este módulo.', 'error');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
            return false;
        }
        return true;
    },

    aplicarSidebar() {
        document.querySelectorAll('.sidebar nav a[href]').forEach(a => {
            const href = a.getAttribute('href');
            if (!href || href === 'dashboard.html') return;
            const modulo = href.replace('.html', '');
            const li = a.closest('li');
            if (li && !this.puedeAcceder(modulo)) li.style.display = 'none';
        });
    },

    aplicarDashboard() {
        const mapa = {
            'ventas.html':     '.mod-ventas',
            'clientes.html':   '.mod-clientes',
            'finanzas.html':   '.mod-finanzas',
            'inventario.html': '.mod-inventario',
            'empleados.html':  '.mod-empleados',
            'proveedores.html':  '.mod-provedor'
        };
        Object.entries(mapa).forEach(([href, sel]) => {
            const modulo = href.replace('.html', '');
            const el = document.querySelector(sel);
            if (el && !this.puedeAcceder(modulo)) el.style.display = 'none';
        });

        const stats = {
            'stat-ventas':    'ventas',
            'stat-clientes':  'clientes',
            'stat-motos':     'inventario',
            'stat-empleados': 'empleados',
            'stat-ingresos':  'finanzas',
            'stat-proveedores':  'provedor'
        };
        Object.entries(stats).forEach(([id, modulo]) => {
            const card = document.getElementById(id)?.closest('.stat-card');
            if (card && !this.puedeAcceder(modulo)) card.style.display = 'none';
        });
    }
};

/* ── Llamadas REST ───────────────────────────────────────── */
const Api = {
    _headers() {
        const h = { 'Content-Type': 'application/json' };
        const u = Sesion.obtener();
        if (u?.token) h['Authorization'] = `Bearer ${u.token}`;
        return h;
    },

    _manejar401(res) {
        if (res.status === 401) {
            console.warn('⚠️ Token inválido o expirado');
            Sesion.cerrar();
        }
    },

    async get(ruta) {
        const res = await fetch(`${API_BASE}${ruta}`, { headers: this._headers() });
        this._manejar401(res);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`${ruta} (${res.status}): ${text || 'Error desconocido'}`);
        }
        return res.json();
    },

    async post(ruta, datos) {
        const res = await fetch(`${API_BASE}${ruta}`, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(datos)
        });
        const text = await res.text();
        this._manejar401(res);
        if (!res.ok) throw new Error(text || `POST ${ruta} → ${res.status}`);
        return text;
    },

    async postJson(ruta, datos) {
        const res = await fetch(`${API_BASE}${ruta}`, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(datos)
        });
        this._manejar401(res);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `POST ${ruta} → ${res.status}`);
        }
        return res.json();
    },

    async put(ruta, datos) {
        const res = await fetch(`${API_BASE}${ruta}`, {
            method: 'PUT',
            headers: this._headers(),
            body: JSON.stringify(datos)
        });
        const text = await res.text();
        this._manejar401(res);
        if (!res.ok) throw new Error(text || `PUT ${ruta} → ${res.status}`);
        return text;
    },

    async delete(ruta) {
        const res = await fetch(`${API_BASE}${ruta}`, { headers: this._headers(), method: 'DELETE' });
        this._manejar401(res);
        if (!res.ok) throw new Error(`DELETE ${ruta} → ${res.status}`);
        return res.text();
    }
};

/* ── Sesión ──────────────────────────────────────────────── */
const Sesion = {
    guardar(empleado) {
        localStorage.setItem('erp_usuario', JSON.stringify(empleado));
    },
    obtener() {
        const d = localStorage.getItem('erp_usuario');
        return d ? JSON.parse(d) : null;
    },
    async cerrar() {
        const u = this.obtener();
        if (u?.token) {
            try {
                await fetch(`${API_BASE}/empleados/empleado/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${u.token}` }
                });
            } catch (_) { /* ignorar error de red al cerrar */ }
        }
        localStorage.removeItem('erp_usuario');
        window.location.href = 'index.html';
    },
    requerida() {
        const u = this.obtener();
        if (!u || !u.token) { window.location.href = 'index.html'; return null; }
        return u;
    }
};

/* ── Generador de Folios Local ─────────────────────────── */
const FolioLocal = {
    /**
     * Genera un folio único combinando timestamp y números aleatorios
     * Formato: {PREFIJO}-{AÑO}-{HHMMSS}{RANDOM}
     * Ejemplo: VTA-2026-143021587
     * @param {string} prefijo - Prefijo del folio (ej: 'VTA', 'COT')
     * @returns {string} Folio generado localmente
     */
    generar(prefijo = 'VTA') {
        const ahora = new Date();
        const anio = ahora.getFullYear();
        
        // Obtener hora, minuto, segundo con ceros a la izquierda
        const horas = String(ahora.getHours()).padStart(2, '0');
        const minutos = String(ahora.getMinutes()).padStart(2, '0');
        const segundos = String(ahora.getSeconds()).padStart(2, '0');
        const timestamp = horas + minutos + segundos;
        
        // Generar 3 números aleatorios
        const aleatorio = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        return `${prefijo}-${anio}-${timestamp}${aleatorio}`;
    },

    /**
     * Genera un folio de venta
     * @returns {string} Folio de venta (VTA-{año}-{timestamp+random})
     */
    generarVenta() {
        return this.generar('VTA');
    },

    /**
     * Genera un folio de cotización
     * @returns {string} Folio de cotización (COT-{año}-{timestamp+random})
     */
    generarCotizacion() {
        return this.generar('COT');
    }
};

/* ── Notificaciones ──────────────────────────────────────── */
function mostrarAlerta(mensaje, tipo = 'exito', contenedorId = 'alerta-container') {
    const c = document.getElementById(contenedorId);
    if (!c) return;
    const iconos = { exito: '✅', error: '❌', info: 'ℹ️', advertencia: '⚠️' };
    c.innerHTML = `<div class="alerta alerta-${tipo}">${iconos[tipo] || ''} ${mensaje}</div>`;
    setTimeout(() => c.innerHTML = '', 4000);
}

const UMBRAL_STOCK_BAJO = 8;

const NotificacionesInventario = {
    datos: null,
    _intervalo: null,

    puedeVer() {
        const rol = Permisos.rol();
        return ['Administrador', 'Almacenista', 'Vendedor'].includes(rol);
    },

    _crearCampana() {
        const topbar = document.querySelector('.topbar-usuario');
        if (!topbar || document.getElementById('notif-campana')) return;

        const main = document.querySelector('.main-content');
        if (main && !document.getElementById('notif-stock-banner')) {
            const banner = document.createElement('div');
            banner.id = 'notif-stock-banner';
            banner.style.display = 'none';
            main.insertBefore(banner, main.firstChild);
        }

        const wrap = document.createElement('div');
        wrap.className = 'notif-campana-wrap';
        wrap.innerHTML = `
          <button type="button" class="notif-campana" id="notif-campana" title="Alertas de inventario" aria-label="Alertas de inventario">
            🔔
            <span class="notif-badge" id="notif-badge" style="display:none">0</span>
          </button>
          <div class="notif-panel" id="notif-panel">
            <div class="notif-panel-header">
              <strong>⚠️ Stock bajo</strong>
              <small>Menos de ${UMBRAL_STOCK_BAJO} unidades</small>
            </div>
            <ul class="notif-lista" id="notif-lista"></ul>
            <a href="inventario.html" class="notif-panel-link">Ver inventario →</a>
          </div>`;
        topbar.insertBefore(wrap, topbar.firstChild);

        document.getElementById('notif-campana').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('notif-panel')?.classList.toggle('activo');
        });
        document.addEventListener('click', () => {
            document.getElementById('notif-panel')?.classList.remove('activo');
        });
    },

    _renderizar() {
        const badge = document.getElementById('notif-badge');
        const lista = document.getElementById('notif-lista');
        const banner = document.getElementById('notif-stock-banner');
        const total = this.datos?.total ?? 0;
        const productos = this.datos?.productos ?? [];

        if (badge) {
            badge.textContent = total;
            badge.style.display = total > 0 ? 'inline-flex' : 'none';
        }

        if (lista) {
            if (!productos.length) {
                lista.innerHTML = '<li class="notif-vacio">✅ Sin productos con stock bajo.</li>';
            } else {
                lista.innerHTML = productos.map(p => `
                  <li class="notif-item">
                    <span class="notif-item-tipo">${p.tipo_producto === 'moto' ? '🏍️' : '🪖'}</span>
                    <div>
                      <strong>${p.nombre}</strong>
                      <small>Stock: ${p.stock} uds.</small>
                    </div>
                  </li>`).join('');
            }
        }

        if (banner) {
            if (total > 0) {
                banner.style.display = 'block';
                banner.innerHTML = `
                  <div class="alerta alerta-advertencia">
                    ⚠️ <strong>${total} producto${total !== 1 ? 's' : ''}</strong> con stock inferior a ${UMBRAL_STOCK_BAJO} unidades.
                    <a href="inventario.html" style="margin-left:8px;font-weight:600">Revisar inventario</a>
                  </div>`;
            } else {
                banner.style.display = 'none';
                banner.innerHTML = '';
            }
        }
    },

    _mostrarToastInicial() {
        const total = this.datos?.total ?? 0;
        if (total <= 0) return;
        if (sessionStorage.getItem('erp_alerta_stock_vista')) return;
        sessionStorage.setItem('erp_alerta_stock_vista', '1');
        mostrarAlerta(
            `${total} producto${total !== 1 ? 's' : ''} con stock inferior a ${UMBRAL_STOCK_BAJO} unidades.`,
            'advertencia'
        );
    },

    async cargar(mostrarToast = false) {
        if (!this.puedeVer() || !Sesion.obtener()?.token) return null;
        try {
            this.datos = await Api.get('/inventario/notificacion/stock-bajo');
            this._renderizar();
            if (mostrarToast) this._mostrarToastInicial();
            return this.datos;
        } catch (_) {
            return null;
        }
    },

    init() {
        if (!Sesion.obtener()?.token || window.location.pathname.endsWith('index.html')) return;
        if (!this.puedeVer()) return;

        this._crearCampana();
        this.cargar(true);

        if (this._intervalo) clearInterval(this._intervalo);
        this._intervalo = setInterval(() => this.cargar(false), 5 * 60 * 1000);
    },

    renderPanelDashboard(contenedorId) {
        const el = document.getElementById(contenedorId);
        if (!el || !this.datos) return;

        const productos = this.datos.productos ?? [];
        if (!productos.length) {
            el.innerHTML = '<p style="color:var(--gris-texto);padding:8px 0">✅ Todos los productos activos tienen stock suficiente.</p>';
            return;
        }

        el.innerHTML = `
          <div class="tabla-contenedor">
            <table class="tabla">
              <thead>
                <tr><th>Tipo</th><th>Producto</th><th>Stock</th></tr>
              </thead>
              <tbody>
                ${productos.map(p => `
                  <tr>
                    <td>${p.tipo_producto === 'moto' ? '🏍️ Moto' : '🪖 Accesorio'}</td>
                    <td><strong>${p.nombre}</strong></td>
                    <td class="stock-bajo">${p.stock}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`;
    }
};

/* ── Modal helpers ───────────────────────────────────────── */
function abrirModal(id) {
    document.getElementById(id)?.classList.add('activo');
}

function cerrarModal(id) {
    document.getElementById(id)?.classList.remove('activo');
}

/* ── Formateo ────────────────────────────────────────────── */
function formatearMoneda(n) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);
}

function formatearFecha(f) {
    if (!f) return '—';
    if (Array.isArray(f)) {
        const [y, m, d] = f;
        const fecha = new Date(y, m - 1, d);
        return fecha.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
    }
    const d = new Date(f);
    return isNaN(d) ? String(f) : d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}

/* ── Tabla helpers ───────────────────────────────────────── */
function filtrarTabla(inputId, tablaId) {
    const val = document.getElementById(inputId)?.value.toLowerCase() ?? '';
    const filas = document.querySelectorAll(`#${tablaId} tbody tr`);
    filas.forEach(f => {
        f.style.display = f.textContent.toLowerCase().includes(val) ? '' : 'none';
    });
}

/* ── Cargar usuario en topbar ────────────────────────────── */
function cargarTopbarUsuario() {
    const u = Sesion.obtener();
    if (!u) return;
    const el = document.getElementById('topbar-nombre');
    const av = document.getElementById('topbar-avatar');
    const rol = document.getElementById('topbar-rol');
    if (el) el.textContent = u.nombre ?? 'Usuario';
    if (av) av.textContent = (u.nombre ?? 'U')[0].toUpperCase();
    if (rol) rol.textContent = u.rol ?? '';
    Permisos.aplicarSidebar();
    NotificacionesInventario.init();
}

/* ── Diagnóstico de Conexión ─────────────────────────── */
window.diagnosticar = async function() {
    console.log('%c🔍 DIAGNÓSTICO DE CONEXIÓN', 'color:blue;font-weight:bold;font-size:14px');
    console.log(`API BASE: ${API_BASE}`);
    
    const usuario = Sesion.obtener();
    console.log('Datos de Sesión:', usuario);
    
    if (!usuario) {
        console.error('❌ NO HAY SESIÓN. Por favor inicia sesión primero.');
        return;
    }
    
    if (!usuario.token) {
        console.error('❌ NO HAY TOKEN en la sesión.');
        return;
    }
    
    console.log('✅ Token presente:', usuario.token.substring(0, 20) + '...');
    console.log('Header que se enviará:', Api._headers());
    
    const endpoints = [
        { url: '/inventario/moto/obtener', desc: 'Motos' },
        { url: '/inventario/accesorio/obtener', desc: 'Accesorios' },
        { url: '/inventario/marca/obtener', desc: 'Marcas' },
        { url: '/inventario/categoria/obtener', desc: 'Categorías' }
    ];
    
    for (const ep of endpoints) {
        try {
            const res = await fetch(`${API_BASE}${ep.url}`, { headers: Api._headers() });
            if (res.status === 401) {
                console.error(`❌ ${ep.desc} - ERROR 401: Token inválido o expirado`);
            } else if (!res.ok) {
                const text = await res.text();
                console.error(`❌ ${ep.desc} - ERROR ${res.status}: ${text}`);
            } else {
                const data = await res.json();
                console.log(`✅ ${ep.desc}: ${Array.isArray(data) ? data.length + ' items' : 'OK'}`);
            }
        } catch(e) {
            console.error(`❌ ${ep.desc}: ${e.message}`);
        }
    }
};

document.addEventListener('DOMContentLoaded', cargarTopbarUsuario);
