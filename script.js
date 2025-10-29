/**
 * Impresión Lumen - Aplicación Web
 * JavaScript principal optimizado y modular
 */

// Configuración global
const CONFIG = {
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxk0WSkH7lFuV9rz5H9BJ-28HkRaMTeHchzTVkfJMYahaG0xxakjtG2fPkE21Lcq9ZIow/exec',
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    ACCEPTED_FILE_TYPES: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.ppt,.pptx,.xls,.xlsx',
    CACHE_DURATION: 30 * 60 * 1000, // 30 minutos
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000 // 1 segundo
};

// Estado global de la aplicación
const AppState = {
    currentView: 'view-home',
    cart: [],
    currentProduct: null,
    currentCategory: null,
    editingItemId: null,
    currentConfiguration: null,
    isCalculatingPrice: false,
    pdfDoc: null,
    pdfCurrentPage: 1,
    isProcessingOrder: false
};

// Configuración por defecto para productos
const DEFAULT_CONFIG = {
    id: null,
    file: null,
    fileName: 'Ningún archivo subido',
    fileId: null,
    cantidad: 1,
    pageCount: 1,
    pagePrice: 0.00,
    color: 'color',
    paper: 'bond',
    size: 'carta',
    sides: 'una cara',
    rango: '',
    subtotal: 0.00,
    total: 0.00
};

// Utilidades
const Utils = {
    // Mostrar notificación
    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform translate-x-full`;
        
        const colors = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            warning: 'bg-yellow-500 text-black',
            info: 'bg-blue-500 text-white'
        };
        
        notification.className += ` ${colors[type] || colors.info}`;
        notification.innerHTML = `
            <div class="flex items-center">
                <span class="flex-1">${message}</span>
                <button class="ml-2 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animar entrada
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Auto-remover
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.add('translate-x-full');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }
    },

    // Formatear precio
    formatPrice(price) {
        return `$ ${parseFloat(price || 0).toFixed(2)}`;
    },

    // Validar email
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // Validar teléfono (10 dígitos)
    validatePhone(phone) {
        const re = /^\d{10}$/;
        return re.test(phone.replace(/\D/g, ''));
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Retry con exponential backoff
    async retry(fn, attempts = CONFIG.RETRY_ATTEMPTS) {
        try {
            return await fn();
        } catch (error) {
            if (attempts <= 1) throw error;
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (CONFIG.RETRY_ATTEMPTS - attempts + 1)));
            return this.retry(fn, attempts - 1);
        }
    },

    // Generar ID único
    generateId() {
        return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
};

// Navegación
const Navigation = {
    init() {
        this.setupAppLinks();
        this.setupCartButton();
    },

    navigateTo(viewId) {
        console.log(`Navegando a: ${viewId}`);
        
        // Ocultar todas las vistas
        document.querySelectorAll('.app-view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Mostrar vista target
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
            AppState.currentView = viewId;
            window.scrollTo(0, 0);
            
            // Ejecutar callbacks específicos de vista
            this.onViewChange(viewId);
        } else {
            console.error(`Vista no encontrada: ${viewId}`);
            this.navigateTo('view-home');
        }
    },

    loadViewData(targetView, element) {
        switch (targetView) {
            case 'view-product-detail':
                AppState.currentProduct = {
                    id: element.dataset.productId,
                    title: element.dataset.productTitle || 'Producto'
                };
                this.updateProductDetail();
                break;
                
            case 'view-category':
                AppState.currentCategory = element.dataset.categoryId || 'general';
                const categoryTitle = element.dataset.categoryTitle || element.textContent.trim() || 'Categoría';
                this.updateCategoryView(categoryTitle);
                break;
                
            case 'view-config':
                if (AppState.currentView === 'view-product-detail' && !AppState.editingItemId) {
                    Configuration.reset();
                }
                break;
                
            case 'view-checkout':
                Checkout.render();
                break;
        }
    },

    updateProductDetail() {
        const titleElement = document.getElementById('product-title');
        const descriptionElement = document.getElementById('product-description');
        
        if (titleElement && AppState.currentProduct) {
            titleElement.textContent = AppState.currentProduct.title;
        }
        
        if (descriptionElement) {
            const descriptions = {
                'prod-bn-carta': 'Impresión en blanco y negro de alta calidad en papel bond tamaño carta. Ideal para documentos, reportes y material de oficina.',
                'prod-color-laser': 'Impresión a color con tecnología láser para resultados profesionales. Perfecta para presentaciones, folletos y material promocional.',
                'prod-planos-bn': 'Impresión de planos técnicos y arquitectónicos en formato grande. Calidad profesional para proyectos de ingeniería y arquitectura.',
                'prod-ploteo-bond': 'Ploteo a color en papel bond para pósters, banners y material publicitario de gran formato.',
                'prod-pvc': 'Impresión en tarjetas PVC de alta durabilidad. Ideal para credenciales, tarjetas de membresía y identificaciones.',
                'prod-copia-bn': 'Servicio de copiado en blanco y negro con excelente relación calidad-precio.'
            };
            
            descriptionElement.textContent = descriptions[AppState.currentProduct?.id] || 'Servicio de impresión profesional con entrega rápida y calidad garantizada.';
        }
    },

    updateCategoryView(title) {
        const titleElement = document.getElementById('category-title');
        const containerElement = document.getElementById('category-items-container');
        
        if (titleElement) {
            titleElement.textContent = title;
        }
        
        if (containerElement) {
            // Aquí podrías cargar productos específicos de la categoría
            // Por ahora mostramos productos de ejemplo
            containerElement.innerHTML = this.getCategoryItems(AppState.currentCategory);
        }
    },

    getCategoryItems(categoryId) {
        const items = {
            'impresion_bn': [
                { id: 'prod-bn-carta', title: 'Impresión B/N Carta', description: 'Documentos estándar, papel bond.', price: 'Desde $1.30' },
                { id: 'prod-bn-oficio', title: 'Impresión B/N Oficio', description: 'Formato oficio, papel bond.', price: 'Desde $1.50' }
            ],
            'impresion_color': [
                { id: 'prod-color-laser', title: 'Impresión Color Láser', description: 'Alta calidad en papel láser.', price: 'Desde $15.00' },
                { id: 'prod-color-inkjet', title: 'Impresión Color Inkjet', description: 'Calidad fotográfica.', price: 'Desde $12.00' }
            ],
            'planos': [
                { id: 'prod-planos-bn', title: 'Impresión Planos B/N', description: 'Planos técnicos y arquitectónicos.', price: 'Desde $0.50' }
            ]
        };
        
        const categoryItems = items[categoryId] || items['impresion_bn'];
        
        return categoryItems.map(item => `
            <a class="app-link block bg-white rounded-lg shadow-md p-4 md:p-6 hover:shadow-lg transition-shadow category-link" 
               data-product-id="${item.id}" 
               data-product-title="${item.title}" 
               data-target-view="view-product-detail" href="#">
                <h2 class="text-lg md:text-xl font-semibold text-blue-700">${item.title}</h2>
                <p class="text-sm text-gray-600 mt-2">${item.description}</p>
                <p class="text-blue-600 font-semibold mt-2 text-sm">${item.price}</p>
            </a>
        `).join('') + `
            <div class="bg-gray-100 rounded-lg p-6 text-center text-gray-500 flex items-center justify-center min-h-[150px]">
                <span>Más opciones próximamente...</span>
            </div>
        `;
    },

    onViewChange(viewId) {
        // Callbacks específicos por vista
        switch (viewId) {
            case 'view-config':
                Configuration.init();
                break;
            case 'view-checkout':
                Checkout.updateTermsValidation();
                break;
        }
    },

    setupAppLinks() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.app-link');
            if (link) {
                e.preventDefault();
                const targetView = link.dataset.targetView;
                if (targetView) {
                    this.loadViewData(targetView, link);
                    this.navigateTo(targetView);
                }
            }
        });
    },

    setupCartButton() {
        const cartButton = document.getElementById('cart-button');
        if (cartButton) {
            cartButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (AppState.cart.length === 0) {
                    Utils.showNotification('El carrito está vacío', 'warning');
                    return;
                }
                Checkout.render();
                this.navigateTo('view-checkout');
            });
        }
    }
};

// Configuración de productos
const Configuration = {
    init() {
        this.setupStepNavigation();
        this.setupFileHandling();
        this.setupFormInputs();
        this.setupPDFViewer();
        this.setupAddToCart();
        
        // Inicializar configuración
        AppState.currentConfiguration = { ...DEFAULT_CONFIG };
        this.updateSummary();
    },

    reset() {
        console.log("Reseteando configuración...");
        AppState.currentConfiguration = { ...DEFAULT_CONFIG };
        
        // Resetear formulario
        const form = document.querySelector('#step-panel-3');
        if (form) {
            form.querySelectorAll('input, select').forEach(input => {
                if (input.type === 'number') {
                    input.value = 1;
                } else if (input.tagName === 'SELECT') {
                    input.selectedIndex = 0;
                } else {
                    input.value = '';
                }
            });
        }
        
        // Resetear zona de archivos
        this.resetDropZone();
        
        // Resetear visor
        this.resetViewer();
        
        // Actualizar resumen
        this.updateSummary();
        
        // Navegar al primer paso
        this.navigateToStep(1);
    },

    navigateToStep(step) {
        console.log(`Navegando al paso: ${step}`);
        
        // Ocultar todos los paneles
        document.querySelectorAll('.step-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Resetear navegación
        document.querySelectorAll('.step-nav-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.classList.add('disabled');
        });
        
        // Activar panel actual
        const currentPanel = document.getElementById(`step-panel-${step}`);
        if (currentPanel) {
            currentPanel.classList.add('active');
        }
        
        // Activar botón de navegación actual
        const currentBtn = document.getElementById(`step-nav-${step}`);
        if (currentBtn) {
            currentBtn.classList.add('active');
            currentBtn.classList.remove('disabled');
        }
        
        // Habilitar pasos anteriores
        for (let i = 1; i < step; i++) {
            const prevBtn = document.getElementById(`step-nav-${i}`);
            if (prevBtn) {
                prevBtn.classList.remove('disabled');
            }
        }
    },

    setupStepNavigation() {
        document.querySelectorAll('.step-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const step = parseInt(e.currentTarget.id.split('-')[2]);
                if (!e.currentTarget.classList.contains('disabled')) {
                    this.navigateToStep(step);
                }
            });
        });
        
        // Botón "Siguiente" en visor
        const visorNextBtn = document.getElementById('visor-next-btn');
        if (visorNextBtn) {
            visorNextBtn.addEventListener('click', () => {
                this.navigateToStep(3);
            });
        }
    },

    setupFileHandling() {
        const fileInput = document.getElementById('file-input');
        const dropZone = document.getElementById('drop-zone');
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files[0]);
            });
        }
        
        if (dropZone) {
            // Drag and drop
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!dropZone.classList.contains('uploading')) {
                    dropZone.classList.add('drag-over');
                }
            });
            
            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                if (!dropZone.classList.contains('uploading')) {
                    this.handleFileSelect(e.dataTransfer.files[0]);
                }
            });
        }
    },

    async handleFileSelect(file) {
        if (!file) return;
        
        console.log(`Archivo seleccionado: ${file.name}`);
        
        // Validar tamaño
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            Utils.showNotification(`El archivo es demasiado grande. Máximo ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`, 'error');
            return;
        }
        
        // Mostrar estado de carga
        this.showUploadingState(file.name);
        
        try {
            // Actualizar configuración
            AppState.currentConfiguration.file = file;
            AppState.currentConfiguration.fileName = file.name;
            
            // Subir archivo
            const result = await this.uploadFile(file);
            AppState.currentConfiguration.fileId = result.fileId;
            
            // Procesar visor
            await this.processFileViewer(file);
            
            Utils.showNotification('Archivo subido exitosamente', 'success');
            
        } catch (error) {
            console.error('Error al procesar archivo:', error);
            Utils.showNotification(`Error al subir archivo: ${error.message}`, 'error');
            this.resetDropZone();
        }
    },

    showUploadingState(fileName) {
        const dropZone = document.getElementById('drop-zone');
        const prompt = document.getElementById('drop-zone-prompt');
        const loading = document.getElementById('drop-zone-loading');
        const statusText = document.getElementById('loading-status-text');
        const fileNameElement = document.getElementById('loading-file-name');
        
        if (dropZone) dropZone.classList.add('uploading');
        if (prompt) prompt.classList.add('hidden');
        if (loading) loading.classList.remove('hidden');
        if (statusText) statusText.textContent = 'Subiendo...';
        if (fileNameElement) fileNameElement.textContent = fileName;
    },

    resetDropZone() {
        const dropZone = document.getElementById('drop-zone');
        const prompt = document.getElementById('drop-zone-prompt');
        const loading = document.getElementById('drop-zone-loading');
        const errorMsg = document.getElementById('file-error-msg');
        
        if (dropZone) dropZone.classList.remove('uploading', 'drag-over');
        if (prompt) prompt.classList.remove('hidden');
        if (loading) loading.classList.add('hidden');
        if (errorMsg) errorMsg.classList.add('hidden');
    },

    async uploadFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const base64Data = e.target.result.split(',')[1];
                    
                    const payload = {
                        action: 'uploadFile',
                        fileBase64: base64Data,
                        fileType: file.type,
                        fileName: file.name
                    };
                    
                    const response = await Utils.retry(async () => {
                        const res = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                            method: 'POST',
                            mode: 'cors',
                            cache: 'no-cache',
                            headers: {
                                'Content-Type': 'text/plain;charset=utf-8'
                            },
                            body: JSON.stringify(payload)
                        });
                        
                        if (!res.ok) {
                            throw new Error(`HTTP error! status: ${res.status}`);
                        }
                        
                        const text = await res.text();
                        if (!text) {
                            throw new Error('Respuesta vacía del servidor');
                        }
                        
                        return JSON.parse(text);
                    });
                    
                    if (response.status !== 'success') {
                        throw new Error(response.message || 'Error al subir archivo');
                    }
                    
                    resolve(response);
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Error al leer el archivo'));
            };
            
            reader.readAsDataURL(file);
        });
    },

    async processFileViewer(file) {
        console.log(`Procesando visor para: ${file.name}`);
        
        const statusText = document.getElementById('visor-status-text');
        if (statusText) {
            statusText.textContent = `"${file.name}" cargado correctamente.`;
        }
        
        // Resetear visor
        this.resetViewer();
        
        if (file.type === 'application/pdf') {
            await this.loadPDFViewer(file);
        } else if (file.type.startsWith('image/')) {
            this.loadImageViewer(file);
        } else {
            this.showGenericViewer(file);
        }
        
        // Navegar al paso 2
        this.navigateToStep(2);
        this.resetDropZone();
    },

    resetViewer() {
        const iframe = document.getElementById('file-visor-iframe');
        const pdfViewer = document.getElementById('pdf-viewer');
        const placeholder = document.getElementById('visor-placeholder');
        
        if (iframe) {
            iframe.classList.add('hidden');
            iframe.src = '';
        }
        if (pdfViewer) pdfViewer.classList.add('hidden');
        if (placeholder) placeholder.classList.add('hidden');
        
        AppState.pdfDoc = null;
        AppState.pdfCurrentPage = 1;
    },

    loadImageViewer(file) {
        const iframe = document.getElementById('file-visor-iframe');
        if (iframe) {
            const reader = new FileReader();
            reader.onload = (e) => {
                iframe.src = e.target.result;
                iframe.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
        
        AppState.currentConfiguration.pageCount = 1;
        this.showPageCountInput(1, true);
        this.calculatePrice();
    },

    async loadPDFViewer(file) {
        const pdfViewer = document.getElementById('pdf-viewer');
        const pageCountElement = document.getElementById('config-pages');
        const pagesWrapper = document.getElementById('config-pages-wrapper');
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            AppState.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            const pageCount = AppState.pdfDoc.numPages;
            AppState.currentConfiguration.pageCount = pageCount;
            
            if (pageCountElement) {
                pageCountElement.value = pageCount;
                pageCountElement.disabled = true;
            }
            
            this.showPageCountInput(pageCount, true);
            
            if (pdfViewer) pdfViewer.classList.remove('hidden');
            
            await this.renderPDFPage(1);
            this.calculatePrice();
            
        } catch (error) {
            console.error('Error al cargar PDF:', error);
            this.showGenericViewer(file);
        }
    },

    async renderPDFPage(pageNum) {
        if (!AppState.pdfDoc) return;
        
        const canvas = document.getElementById('pdf-canvas');
        const pageNumElement = document.getElementById('pdf-page-num');
        const prevBtn = document.getElementById('pdf-prev');
        const nextBtn = document.getElementById('pdf-next');
        
        if (!canvas) return;
        
        try {
            const page = await AppState.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            const context = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            AppState.pdfCurrentPage = pageNum;
            
            if (pageNumElement) pageNumElement.textContent = pageNum;
            if (prevBtn) prevBtn.disabled = (pageNum <= 1);
            if (nextBtn) nextBtn.disabled = (pageNum >= AppState.pdfDoc.numPages);
            
        } catch (error) {
            console.error(`Error al renderizar página ${pageNum}:`, error);
        }
    },

    showGenericViewer(file) {
        const placeholder = document.getElementById('visor-placeholder');
        if (placeholder) {
            placeholder.textContent = `"${file.name}" - Sin vista previa disponible`;
            placeholder.classList.remove('hidden');
        }
        
        AppState.currentConfiguration.pageCount = 1;
        this.showPageCountInput(1, false);
        this.calculatePrice();
    },

    showPageCountInput(count, disabled) {
        const pagesWrapper = document.getElementById('config-pages-wrapper');
        const pagesInput = document.getElementById('config-pages');
        const pagesHelp = document.getElementById('config-pages-help');
        
        if (pagesWrapper) pagesWrapper.classList.remove('hidden');
        if (pagesInput) {
            pagesInput.value = count;
            pagesInput.disabled = disabled;
        }
        if (pagesHelp) {
            pagesHelp.textContent = disabled ? 'Páginas detectadas automáticamente.' : 'Confirma el número total de páginas.';
        }
    },

    setupPDFViewer() {
        const prevBtn = document.getElementById('pdf-prev');
        const nextBtn = document.getElementById('pdf-next');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (AppState.pdfCurrentPage > 1) {
                    this.renderPDFPage(AppState.pdfCurrentPage - 1);
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (AppState.pdfDoc && AppState.pdfCurrentPage < AppState.pdfDoc.numPages) {
                    this.renderPDFPage(AppState.pdfCurrentPage + 1);
                }
            });
        }
    },

    setupFormInputs() {
        const inputs = document.querySelectorAll('#step-panel-3 .form-group input, #step-panel-3 .form-group select');
        
        inputs.forEach(input => {
            const debouncedHandler = Utils.debounce(() => {
                this.handleInputChange(input);
            }, 300);
            
            input.addEventListener('change', debouncedHandler);
            input.addEventListener('input', debouncedHandler);
        });
    },

    handleInputChange(input) {
        const key = input.id.split('-')[1];
        let value = input.value;
        
        if (input.type === 'number') {
            let num = parseInt(value, 10);
            if (isNaN(num) || num < 1) num = 1;
            input.value = num;
            value = num;
        } else if (key === 'rango') {
            value = value.replace(/[^0-9,-\s]/g, '');
            input.value = value;
        }
        
        if (AppState.currentConfiguration) {
            if (key === 'pages') {
                AppState.currentConfiguration.pageCount = value;
            } else if (AppState.currentConfiguration.hasOwnProperty(key)) {
                AppState.currentConfiguration[key] = value;
            }
            
            console.log(`Configuración actualizada [${key}]:`, value);
            this.calculatePrice();
        }
    },

    async calculatePrice() {
        if (AppState.isCalculatingPrice) return;
        
        AppState.isCalculatingPrice = true;
        console.log("Calculando precio...");
        
        // Mostrar estado de cálculo
        const elements = {
            finalTotal: document.getElementById('summary-final-total'),
            pagePrice: document.getElementById('summary-page-price'),
            subtotal: document.getElementById('summary-subtotal')
        };
        
        Object.values(elements).forEach(el => {
            if (el) el.textContent = "Calculando...";
        });
        
        try {
            const config = AppState.currentConfiguration;
            const options = {
                color: config.color,
                paper: config.paper,
                size: config.size,
                sides: config.sides,
                pageCount: config.pageCount,
                cantidad: config.cantidad,
                rango: config.rango
            };
            
            const payload = {
                action: 'getPrice',
                options: options
            };
            
            const response = await Utils.retry(async () => {
                const res = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8'
                    },
                    body: JSON.stringify(payload)
                });
                
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                
                const text = await res.text();
                if (!text) {
                    throw new Error('Respuesta vacía del servidor');
                }
                
                return JSON.parse(text);
            });
            
            if (response.status !== 'success') {
                throw new Error(response.message || 'Error al calcular precio');
            }
            
            console.log("Precio calculado:", response);
            
            config.total = response.total;
            config.pagePrice = response.pagePrice;
            
        } catch (error) {
            console.error("Error al calcular precio:", error);
            Utils.showNotification('Error al calcular precio. Intenta nuevamente.', 'error');
            
            // Mostrar error en elementos
            Object.values(elements).forEach(el => {
                if (el) el.textContent = "Error";
            });
        } finally {
            AppState.isCalculatingPrice = false;
            this.updateSummary();
        }
    },

    updateSummary() {
        const config = AppState.currentConfiguration;
        if (!config) return;
        
        const elements = {
            fileName: document.getElementById('summary-file-name'),
            cantidad: document.getElementById('summary-cantidad'),
            pagePrice: document.getElementById('summary-page-price'),
            color: document.getElementById('summary-color'),
            paper: document.getElementById('summary-paper'),
            size: document.getElementById('summary-size'),
            sides: document.getElementById('summary-sides'),
            pagesToPrint: document.getElementById('summary-pages-to-print'),
            subtotal: document.getElementById('summary-subtotal'),
            finalTotal: document.getElementById('summary-final-total'),
            addButton: document.getElementById('add-to-cart-btn')
        };
        
        // Actualizar elementos
        if (elements.fileName) {
            elements.fileName.textContent = config.fileName || 'Ningún archivo subido';
            elements.fileName.title = config.fileName || '';
        }
        
        if (elements.cantidad) elements.cantidad.textContent = config.cantidad || 0;
        if (elements.pagePrice) elements.pagePrice.textContent = Utils.formatPrice(config.pagePrice);
        
        // Obtener texto de opciones
        if (elements.color) {
            const colorOption = document.querySelector(`#config-color option[value="${config.color}"]`);
            elements.color.textContent = colorOption ? colorOption.textContent : config.color;
        }
        
        if (elements.paper) {
            const paperOption = document.querySelector(`#config-paper option[value="${config.paper}"]`);
            elements.paper.textContent = paperOption ? paperOption.textContent : config.paper;
        }
        
        if (elements.size) {
            const sizeOption = document.querySelector(`#config-size option[value="${config.size}"]`);
            elements.size.textContent = sizeOption ? sizeOption.textContent : config.size;
        }
        
        if (elements.sides) {
            const sidesOption = document.querySelector(`#config-sides option[value="${config.sides}"]`);
            elements.sides.textContent = sidesOption ? sidesOption.textContent : config.sides;
        }
        
        if (elements.pagesToPrint) {
            elements.pagesToPrint.textContent = config.rango ? config.rango : `Todo (${config.pageCount})`;
        }
        
        // Calcular subtotal por copia
        const subtotalPerCopy = config.total / config.cantidad;
        if (elements.subtotal) {
            elements.subtotal.textContent = Utils.formatPrice(isNaN(subtotalPerCopy) ? 0 : subtotalPerCopy);
        }
        
        if (elements.finalTotal) {
            elements.finalTotal.textContent = Utils.formatPrice(config.total);
        }
        
        // Habilitar/deshabilitar botón
        if (elements.addButton) {
            const canAdd = (config.fileId || AppState.editingItemId) && config.cantidad > 0;
            elements.addButton.disabled = !canAdd;
        }
    },

    setupAddToCart() {
        const addButton = document.getElementById('add-to-cart-btn');
        if (addButton) {
            addButton.addEventListener('click', () => {
                if (addButton.disabled) return;
                
                if (AppState.editingItemId) {
                    this.updateCartItem();
                } else {
                    this.addToCart();
                }
            });
        }
    },

    addToCart() {
        const config = AppState.currentConfiguration;
        const itemId = Utils.generateId();
        
        const cartItem = {
            ...config,
            id: itemId
        };
        
        AppState.cart.push(cartItem);
        
        // Actualizar contador del carrito
        Cart.updateCounter();
        
        // Mostrar modal de confirmación
        Modals.show('add-to-cart-modal');
        
        // Resetear configuración
        this.reset();
        
        Utils.showNotification('Producto añadido al carrito', 'success');
    },

    updateCartItem() {
        const itemIndex = AppState.cart.findIndex(item => item.id === AppState.editingItemId);
        if (itemIndex !== -1) {
            const originalItem = AppState.cart[itemIndex];
            AppState.cart[itemIndex] = {
                ...AppState.currentConfiguration,
                id: originalItem.id,
                fileId: AppState.currentConfiguration.fileId || originalItem.fileId,
                fileName: AppState.currentConfiguration.fileName || originalItem.fileName
            };
        }
        
        AppState.editingItemId = null;
        this.reset();
        
        Checkout.render();
        Navigation.navigateTo('view-checkout');
        
        Utils.showNotification('Producto actualizado', 'success');
    }
};

// Carrito de compras
const Cart = {
    updateCounter() {
        const countElement = document.getElementById('cart-count');
        if (countElement) {
            countElement.textContent = AppState.cart.length;
            if (AppState.cart.length > 0) {
                countElement.classList.remove('hidden');
            } else {
                countElement.classList.add('hidden');
            }
        }
    },

    removeItem(itemId) {
        console.log("Eliminando item:", itemId);
        AppState.cart = AppState.cart.filter(item => item.id !== itemId);
        this.updateCounter();
        
        if (AppState.cart.length === 0) {
            Navigation.navigateTo('view-home');
            Utils.showNotification('Carrito vacío', 'info');
        } else {
            Checkout.render();
        }
    },

    editItem(itemId) {
        console.log("Editando item:", itemId);
        const item = AppState.cart.find(item => item.id === itemId);
        if (!item) {
            console.error("Item no encontrado:", itemId);
            return;
        }
        
        // Cargar configuración para edición
        AppState.editingItemId = itemId;
        AppState.currentConfiguration = { ...item, file: null };
        
        // Actualizar formulario
        const formFields = {
            'cantidad': 'config-cantidad',
            'color': 'config-color',
            'paper': 'config-paper',
            'size': 'config-size',
            'sides': 'config-sides',
            'rango': 'config-rango',
            'pageCount': 'config-pages'
        };
        
        for (const [key, elementId] of Object.entries(formFields)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.value = key === 'pageCount' ? item.pageCount : (item[key] || '');
            }
        }
        
        Configuration.updateSummary();
        
        // Actualizar botón y navegación
        const addButton = document.getElementById('add-to-cart-btn');
        if (addButton) addButton.textContent = 'Actualizar';
        
        const backLink = document.getElementById('back-to-detail-link');
        if (backLink) {
            backLink.dataset.targetView = 'view-checkout';
            backLink.innerHTML = '← Volver al Carrito';
        }
        
        Navigation.navigateTo('view-config');
        Configuration.navigateToStep(3);
        
        Utils.showNotification('Editando producto', 'info');
    }
};

// Checkout
const Checkout = {
    render() {
        const container = document.getElementById('checkout-items-container');
        const subtotalElement = document.getElementById('checkout-subtotal');
        const totalElement = document.getElementById('checkout-total');
        
        if (!container || !subtotalElement || !totalElement) return;
        
        container.innerHTML = '';
        let subtotal = 0;
        
        if (AppState.cart.length === 0) {
            container.innerHTML = '<p class="text-sm md:text-base text-gray-600">El carrito está vacío.</p>';
            subtotalElement.textContent = Utils.formatPrice(0);
            totalElement.textContent = Utils.formatPrice(0);
            this.updateSubmitButton(false);
            return;
        }
        
        AppState.cart.forEach(item => {
            subtotal += item.total || 0;
            
            const colorText = document.querySelector(`#config-color option[value="${item.color}"]`)?.textContent || item.color;
            const paperText = document.querySelector(`#config-paper option[value="${item.paper}"]`)?.textContent || item.paper;
            const sizeText = document.querySelector(`#config-size option[value="${item.size}"]`)?.textContent || item.size;
            const sidesText = document.querySelector(`#config-sides option[value="${item.sides}"]`)?.textContent || item.sides;
            
            const itemHTML = `
                <div class="bg-white rounded-lg shadow-sm border p-3 md:p-4 flex justify-between items-start gap-3 md:gap-4">
                    <div class="flex-grow overflow-hidden">
                        <h3 class="font-semibold text-base md:text-lg truncate" title="${item.fileName}">${item.fileName}</h3>
                        <p class="text-xs md:text-sm text-gray-600 mt-1">
                            ${item.cantidad} copias • ${item.pageCount} págs<br class="sm:hidden">
                            ${colorText} • ${paperText} • ${sizeText} • ${sidesText}
                            ${item.rango ? `• Rango: ${item.rango}` : ''}
                        </p>
                        <p class="text-base md:text-lg font-bold text-blue-700 mt-2">${Utils.formatPrice(item.total)}</p>
                    </div>
                    <div class="flex-shrink-0 flex flex-col items-end gap-1 md:gap-2">
                        <button class="remove-cart-item-btn text-red-500 hover:text-red-700 text-xs md:text-sm transition-colors" 
                                data-item-id="${item.id}">
                            Eliminar
                        </button>
                        <button class="edit-cart-item-btn text-blue-500 hover:text-blue-700 text-xs md:text-sm transition-colors" 
                                data-item-id="${item.id}">
                            Editar
                        </button>
                    </div>
                </div>
            `;
            
            container.insertAdjacentHTML('beforeend', itemHTML);
        });
        
        subtotalElement.textContent = Utils.formatPrice(subtotal);
        totalElement.textContent = Utils.formatPrice(subtotal);
        
        this.setupItemActions();
        this.updateTermsValidation();
    },

    setupItemActions() {
        const container = document.getElementById('checkout-items-container');
        if (!container) return;
        
        // Eliminar items
        container.querySelectorAll('.remove-cart-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.currentTarget.dataset.itemId;
                Cart.removeItem(itemId);
            });
        });
        
        // Editar items
        container.querySelectorAll('.edit-cart-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.currentTarget.dataset.itemId;
                Cart.editItem(itemId);
            });
        });
    },

    updateTermsValidation() {
        const termsCheckbox = document.getElementById('terms-checkbox');
        const submitButton = document.getElementById('submit-order-btn');
        
        if (termsCheckbox && submitButton) {
            const updateSubmitState = () => {
                const formValid = this.validateForm();
                const termsAccepted = termsCheckbox.checked;
                const cartNotEmpty = AppState.cart.length > 0;
                
                submitButton.disabled = !(formValid && termsAccepted && cartNotEmpty);
            };
            
            termsCheckbox.addEventListener('change', updateSubmitState);
            
            // Validar formulario en tiempo real
            const form = document.getElementById('checkout-form');
            if (form) {
                form.addEventListener('input', updateSubmitState);
                form.addEventListener('change', updateSubmitState);
            }
            
            updateSubmitState();
        }
    },

    validateForm() {
        const requiredFields = [
            'checkout-nombre',
            'checkout-email',
            'checkout-telefono',
            'checkout-sucursal'
        ];
        
        return requiredFields.every(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field) return false;
            
            const value = field.value.trim();
            if (!value) return false;
            
            // Validaciones específicas
            if (fieldId === 'checkout-email') {
                return Utils.validateEmail(value);
            }
            
            if (fieldId === 'checkout-telefono') {
                return Utils.validatePhone(value);
            }
            
            return true;
        });
    },

    updateSubmitButton(enabled) {
        const submitButton = document.getElementById('submit-order-btn');
        if (submitButton) {
            submitButton.disabled = !enabled;
        }
    },

    async submitOrder() {
        if (AppState.isProcessingOrder) return;
        
        const form = document.getElementById('checkout-form');
        const errorMsg = document.getElementById('checkout-error-msg');
        const submitButton = document.getElementById('submit-order-btn');
        const processingIndicator = document.getElementById('processing-indicator');
        
        if (!form || !this.validateForm()) {
            Utils.showNotification('Por favor completa todos los campos correctamente', 'error');
            return;
        }
        
        AppState.isProcessingOrder = true;
        
        // Mostrar estado de procesamiento
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Procesando...';
        }
        if (processingIndicator) processingIndicator.classList.remove('hidden');
        if (errorMsg) errorMsg.classList.add('hidden');
        
        try {
            const clientData = {
                nombre: document.getElementById('checkout-nombre').value.trim(),
                email: document.getElementById('checkout-email').value.trim(),
                telefono: document.getElementById('checkout-telefono').value.trim(),
                sucursal: document.getElementById('checkout-sucursal').value,
                metodoEntrega: document.getElementById('checkout-metodo').value,
                total: parseFloat(document.getElementById('checkout-total').textContent.replace('$', '').replace(',', ''))
            };
            
            const items = AppState.cart.map(item => ({
                id: item.id,
                fileName: item.fileName,
                fileId: item.fileId,
                cantidad: item.cantidad,
                pageCount: item.pageCount,
                color: item.color,
                paper: item.paper,
                size: item.size,
                sides: item.sides,
                rango: item.rango,
                total: item.total
            }));
            
            const payload = {
                action: 'submitOrder',
                cliente: clientData,
                items: items
            };
            
            console.log("Enviando pedido:", payload);
            
            const response = await Utils.retry(async () => {
                const res = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8'
                    },
                    body: JSON.stringify(payload)
                });
                
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                
                const text = await res.text();
                if (!text) {
                    throw new Error('Respuesta vacía del servidor');
                }
                
                return JSON.parse(text);
            });
            
            if (response.status === 'success' && response.folio) {
                // Actualizar número de folio
                const folioElement = document.getElementById('folio-number');
                if (folioElement) folioElement.textContent = response.folio;
                
                // Limpiar carrito
                AppState.cart = [];
                Cart.updateCounter();
                
                // Resetear formulario
                form.reset();
                
                // Navegar a página de agradecimiento
                Navigation.navigateTo('view-thanks');
                
                Utils.showNotification('¡Pedido procesado exitosamente! Revisa tu correo electrónico.', 'success', 8000);
                
            } else {
                throw new Error(response.message || 'Error del servidor');
            }
            
        } catch (error) {
            console.error("Error al enviar pedido:", error);
            
            if (errorMsg) {
                errorMsg.textContent = `Error: ${error.message}`;
                errorMsg.classList.remove('hidden');
            }
            
            Utils.showNotification(`Error al procesar pedido: ${error.message}`, 'error');
            
        } finally {
            AppState.isProcessingOrder = false;
            
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Procesar Pedido';
            }
            if (processingIndicator) processingIndicator.classList.add('hidden');
        }
    }
};

// Modales
const Modals = {
    init() {
        this.setupPriceModal();
        this.setupAddToCartModal();
    },

    show(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    },

    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    },

    setupPriceModal() {
        const showBtn = document.getElementById('show-price-modal-btn');
        const closeBtn = document.getElementById('close-price-modal-btn');
        const modal = document.getElementById('price-modal');
        
        if (showBtn) {
            showBtn.addEventListener('click', () => this.show('price-modal'));
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide('price-modal'));
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hide('price-modal');
                }
            });
        }
    },

    setupAddToCartModal() {
        const goToCartBtn = document.getElementById('modal-go-to-cart-btn');
        const addAnotherBtn = document.getElementById('modal-add-another-btn');
        const modal = document.getElementById('add-to-cart-modal');
        
        if (goToCartBtn) {
            goToCartBtn.addEventListener('click', () => {
                this.hide('add-to-cart-modal');
                Checkout.render();
                Navigation.navigateTo('view-checkout');
            });
        }
        
        if (addAnotherBtn) {
            addAnotherBtn.addEventListener('click', () => {
                this.hide('add-to-cart-modal');
                Navigation.navigateTo('view-home');
            });
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hide('add-to-cart-modal');
                }
            });
        }
    }
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    console.log("Inicializando Impresión Lumen...");
    
    try {
        // Inicializar módulos
        Navigation.init();
        Modals.init();
        
        // Configurar evento de envío de pedido
        const submitButton = document.getElementById('submit-order-btn');
        if (submitButton) {
            submitButton.addEventListener('click', (e) => {
                e.preventDefault();
                Checkout.submitOrder();
            });
        }
        
        // Navegar a vista inicial
        Navigation.navigateTo('view-home');
        
        console.log("Aplicación inicializada correctamente");
        Utils.showNotification('¡Bienvenido a Impresión Lumen!', 'success', 3000);
        
    } catch (error) {
        console.error("Error al inicializar aplicación:", error);
        Utils.showNotification('Error al cargar la aplicación. Recarga la página.', 'error');
    }
});

// Manejo de errores globales
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
    Utils.showNotification('Ha ocurrido un error inesperado', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Promesa rechazada:', event.reason);
    Utils.showNotification('Error de conexión. Verifica tu internet.', 'error');
});
