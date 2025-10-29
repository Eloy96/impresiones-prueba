// --- CONFIGURACIÓN ---
// *** 1. REEMPLAZA ESTO CON LA URL DE TU DESPLIEGUE DE GOOGLE APPS SCRIPT ***
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxk0WSkH7lFuV9rz5H9BJ-28HkRaMTeHchzTVkfJMYahaG0xxakjtG2fPkE21Lcq9ZIow/exec'; 

// *** 2. REEMPLAZA ESTO CON TU CLAVE PÚBLICA DE CONEKTA ***
const CONEKTA_PUBLIC_KEY = 'key_XXXXXXXXXXXXXXXX'; 
const CONEKTA_CHECKOUT_URL = 'https://pay.conekta.com/checkout/start'; 

// --- ESTADO GLOBAL ---
let cart = [];
const VIEW_FLOW = ['home', 'product-config', 'cart', 'client-info', 'payment', 'confirmation'];
let currentView = 'home';

// --- LÓGICA DEL HOME (Carrusel y Título) ---
let currentSlide = 0;
let slideInterval;
const SLIDE_DURATION = 5000; // 5 segundos

/**
 * Función para dividir la palabra "Lumen" en spans para aplicar colores CSS.
 */
function initializeLumenTitle() {
    const lumenSpan = document.querySelector('.colorful-lumen');
    if (lumenSpan && lumenSpan.textContent === 'Lumen') {
        const word = lumenSpan.textContent;
        lumenSpan.innerHTML = ''; // Limpiar contenido
        for (let i = 0; i < word.length; i++) {
            const span = document.createElement('span');
            span.textContent = word[i];
            lumenSpan.appendChild(span);
        }
    }
}

/**
 * Mueve el carrusel al slide index especificado.
 * @param {number} index - El índice del slide (0-basado).
 */
function showSlide(index) {
    const carousel = document.getElementById('product-carousel');
    if (!carousel) return;

    const totalSlides = carousel.children.length;
    
    // Asegura que el índice esté dentro del rango
    if (index >= totalSlides) {
        currentSlide = 0;
    } else if (index < 0) {
        currentSlide = totalSlides - 1;
    } else {
        currentSlide = index;
    }
    
    // Calcula el desplazamiento horizontal para mostrar el slide actual
    const offset = -currentSlide * 100;
    carousel.style.transform = `translateX(${offset}%)`;
}

/**
 * Inicia el temporizador de transición automática.
 */
function startCarouselAutoPlay() {
    // Limpia el intervalo anterior para evitar múltiples ejecuciones
    clearInterval(slideInterval); 
    
    slideInterval = setInterval(() => {
        showSlide(currentSlide + 1);
    }, SLIDE_DURATION);
}

/**
 * Detiene y reinicia el temporizador (usado al hacer clic en las flechas).
 * @param {number} direction - 1 para siguiente, -1 para anterior.
 */
function moveSlide(direction) {
    showSlide(currentSlide + direction);
    // Reinicia el temporizador al mover manualmente
    startCarouselAutoPlay(); 
}

// Event Listeners del carrusel (Se agregan al inicializar el Home)
function setupCarouselListeners() {
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', (e) => { e.stopPropagation(); moveSlide(-1); }); // Detiene la propagación para no activar el navigate del item
        nextBtn.addEventListener('click', (e) => { e.stopPropagation(); moveSlide(1); }); // Detiene la propagación para no activar el navigate del item
        
        // Inicializa el autoplay
        startCarouselAutoPlay();
    }
}


// --- FUNCIONES DE UTILIDAD (DOM Y NAVEGACIÓN PROGRESIVA) ---

/**
 * Función central de navegación.
 */
function navigate(viewId) {
    // 1. Ocultar todas las vistas
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });

    // 2. Mostrar la vista solicitada
    const targetView = document.getElementById(viewId + '-view');
    if (targetView) {
        targetView.classList.remove('hidden');
        currentView = viewId;
    }
    
    // 3. Acciones específicas al navegar
    if (viewId === 'client-info') {
        const total = cart.reduce((sum, item) => sum + item.total, 0).toFixed(2);
        document.getElementById('final-total-checkout').textContent = total;
        toggleDeliveryOptions(document.getElementById('delivery-method').value);
    }
    
    // Si navegamos al home, aseguramos que el carrusel esté activo
    if (viewId === 'home') {
        setupCarouselListeners();
        showSlide(0);
        initializeLumenTitle(); // Asegurar que el título esté estilizado
    }

    // 4. Actualizar el contador del carrito
    document.getElementById('cart-count').textContent = cart.length; 
}

/**
 * Guarda el estado del carrito en LocalStorage.
 */
function saveCart() {
    localStorage.setItem('printCart', JSON.stringify(cart));
    document.getElementById('cart-count').textContent = cart.length;
}

/**
 * Carga el estado del carrito desde LocalStorage al iniciar.
 */
function loadCart() {
    const savedCart = localStorage.getItem('printCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
    renderCart(); 
}

/**
 * Muestra u oculta las opciones de sucursal o domicilio.
 * @param {string} method - 'tienda' o 'domicilio'.
 */
function toggleDeliveryOptions(method) {
    const sucursalDiv = document.getElementById('sucursal-options');
    const domicilioDiv = document.getElementById('domicilio-options');
    const sucursalSelect = document.getElementById('client-sucursal');
    const addressTextarea = document.getElementById('client-address');

    if (method === 'tienda') {
        sucursalDiv.classList.remove('hidden');
        domicilioDiv.classList.add('hidden');
        sucursalSelect.setAttribute('required', 'required');
        addressTextarea.removeAttribute('required');
    } else { // domicilio
        sucursalDiv.classList.add('hidden');
        domicilioDiv.classList.remove('hidden');
        sucursalSelect.removeAttribute('required');
        addressTextarea.setAttribute('required', 'required');
    }
}


// --- CONEXIÓN CON GOOGLE APPS SCRIPT ---

/**
 * Función genérica para enviar datos al Apps Script.
 */
async function callAppsScript(payload) {
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
        console.error("ERROR: La URL del Apps Script no está configurada.");
        // Nota: No usamos alert() aquí para no interrumpir el flujo.
        return { status: 'error', message: 'Configuración de URL faltante.' };
    }
    try {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.innerHTML = '<div class="spinner"></div><p>Comunicando con el servidor...</p>';
        document.body.appendChild(loadingOverlay);

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain' }, 
            body: JSON.stringify(payload)
        });

        document.body.removeChild(loadingOverlay); 

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const text = await response.text();
        const data = JSON.parse(text);

        if (data.status === 'error') {
            throw new Error(data.message);
        }

        return data;

    } catch (error) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) document.body.removeChild(overlay);
        
        console.error("Error en la comunicación con Apps Script:", error);
        alert(`Ocurrió un error en el servidor: ${error.message}`); 
        return { status: 'error', message: error.message };
    }
}

// --- LÓGICA DE SUBIDA DE ARCHIVO Y PRECIO ---

document.getElementById('document-file').addEventListener('change', handleFileChange);
document.getElementById('product-form').addEventListener('change', handleProductConfigChange);
document.getElementById('cantidad').addEventListener('input', handleProductConfigChange);


async function handleFileChange(event) {
    const file = event.target.files[0];
    const statusEl = document.getElementById('upload-status');
    const fileIdEl = document.getElementById('file-id');
    const fileNameEl = document.getElementById('file-name');

    if (!file) {
        statusEl.textContent = 'Haz clic para seleccionar tu archivo';
        statusEl.className = '';
        return;
    }

    statusEl.textContent = 'Subiendo archivo...';
    statusEl.className = 'loading';
    fileIdEl.value = ''; 

    // Convertir a Base64
    const base64File = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });

    const payload = {
        action: 'uploadFile',
        fileBase64: base64File,
        fileType: file.type,
        fileName: file.name
    };

    const result = await callAppsScript(payload);

    if (result.status === 'success') {
        statusEl.textContent = `Archivo subido: ${result.fileName}`;
        statusEl.className = 'success';
        fileIdEl.value = result.fileId;
        fileNameEl.value = result.fileName;
        
        // Asunción: Asignar un número de páginas para el cálculo de precio
        document.getElementById('page-count').value = 10; 
        
        handleProductConfigChange();
    } else {
        statusEl.textContent = `Error al subir: ${result.message}`;
        statusEl.className = 'error';
    }
}

async function handleProductConfigChange() {
    const pagePriceEl = document.getElementById('page-price');
    const subtotalEl = document.getElementById('item-subtotal');
    const fileId = document.getElementById('file-id').value;

    if (!fileId) {
        pagePriceEl.textContent = '0.00';
        subtotalEl.textContent = '0.00';
        return;
    }

    const options = {
        color: document.getElementById('color').value,
        paper: document.getElementById('paper').value,
        size: document.getElementById('size').value,
        sides: document.getElementById('sides').value,
        pageCount: parseInt(document.getElementById('page-count').value, 10),
        cantidad: parseInt(document.getElementById('cantidad').value, 10)
    };
    
    if (isNaN(options.cantidad) || options.cantidad <= 0 || isNaN(options.pageCount) || options.pageCount <= 0) {
        pagePriceEl.textContent = '0.00';
        subtotalEl.textContent = '0.00';
        return;
    }

    const payload = { action: 'getPrice', options: options };
    const result = await callAppsScript(payload);

    if (result.status === 'success') {
        pagePriceEl.textContent = parseFloat(result.pagePrice).toFixed(2);
        subtotalEl.textContent = parseFloat(result.total).toFixed(2);
    } else {
        pagePriceEl.textContent = 'Error';
        subtotalEl.textContent = 'Error';
        console.error("Error al obtener precio:", result.message);
    }
}

// --- LÓGICA DEL CARRITO ---

function addItemToCart() {
    const fileId = document.getElementById('file-id').value;
    const fileName = document.getElementById('file-name').value;
    const subtotalText = document.getElementById('item-subtotal').textContent;
    const subtotal = parseFloat(subtotalText);

    if (!fileId || subtotal <= 0 || subtotalText === 'Error') {
        alert("Por favor, sube un archivo y verifica la configuración. El precio debe ser un número válido mayor a cero.");
        return;
    }

    const item = {
        color: document.getElementById('color').value,
        paper: document.getElementById('paper').value,
        size: document.getElementById('size').value,
        sides: document.getElementById('sides').value,
        pageCount: parseInt(document.getElementById('page-count').value, 10),
        cantidad: parseInt(document.getElementById('cantidad').value, 10),
        comentarios: document.getElementById('comentarios').value,
        fileId: fileId,
        fileName: fileName,
        total: subtotal,
    };
    
    cart.push(item);
    saveCart();
    renderCart();
    navigate('cart');
    
    // Resetear configuración
    document.getElementById('product-form').reset();
    document.getElementById('document-file').value = ''; 
    document.getElementById('file-id').value = '';
    document.getElementById('file-name').value = '';
    document.getElementById('upload-status').textContent = 'Haz clic para seleccionar tu archivo';
    document.getElementById('upload-status').className = '';
    document.getElementById('item-subtotal').textContent = '0.00';
    document.getElementById('page-price').textContent = '0.00';
}

function removeItemFromCart(index) {
    // Usamos confirm() ya que es una acción destructiva para el usuario.
    if (confirm(`¿Estás seguro de eliminar el ítem ${cart[index].fileName} del carrito?`)) { 
        cart.splice(index, 1);
        saveCart();
        renderCart();
    }
}

function renderCart() {
    const listEl = document.getElementById('cart-items-list');
    const totalEl = document.getElementById('cart-total');
    let total = 0;
    
    listEl.innerHTML = ''; 
    
    if (cart.length === 0) {
        listEl.innerHTML = '<p class="empty-cart">Tu carrito está vacío.</p>';
        document.getElementById('pre-checkout-btn').disabled = true;
        totalEl.textContent = '0.00';
        return;
    }
    
    cart.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        
        itemEl.innerHTML = `
            <div class="cart-item-details">
                <strong>${item.fileName}</strong> 
                (${item.cantidad} copias | ${item.color} - ${item.paper} - ${item.size})
                <br>
                Subtotal: $${item.total.toFixed(2)}
            </div>
            <button class="remove-btn" onclick="removeItemFromCart(${index})">🗑️</button>
        `;
        listEl.appendChild(itemEl);
        
        total += item.total;
    });

    totalEl.textContent = total.toFixed(2);
    const privacyChecked = document.getElementById('privacy-check').checked;
    document.getElementById('pre-checkout-btn').disabled = !privacyChecked || cart.length === 0;
}

document.getElementById('privacy-check').addEventListener('change', () => {
    const privacyChecked = document.getElementById('privacy-check').checked;
    document.getElementById('pre-checkout-btn').disabled = !privacyChecked || cart.length === 0;
});

document.getElementById('pre-checkout-btn').addEventListener('click', () => {
    if (cart.length === 0) {
        alert("El carrito está vacío.");
        return;
    }
    if (!document.getElementById('privacy-check').checked) {
        alert("Debes aceptar los Avisos de Privacidad y Términos y Condiciones.");
        return;
    }
    navigate('client-info');
});

// Event listener para el formulario de datos de cliente
document.getElementById('client-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handlePayment();
});


// --- PROCESO DE PAGO Y ENVÍO DE ORDEN ---

async function handlePayment() {
    
    const clientForm = document.getElementById('client-form');
    // Forzar validación de HTML5 (campos 'required')
    if (!clientForm.checkValidity()) {
        clientForm.reportValidity();
        return;
    }

    document.getElementById('proceed-to-payment-btn').disabled = true;
    document.getElementById('proceed-to-payment-btn').textContent = 'Validando y enviando pedido...';

    const metodoEntrega = document.getElementById('delivery-method').value;
    const clienteData = {
        nombre: document.getElementById('client-name').value, 
        email: document.getElementById('client-email').value,
        telefono: document.getElementById('client-phone').value,
        metodoEntrega: metodoEntrega,
        sucursal: metodoEntrega === 'tienda' ? document.getElementById('client-sucursal').value : '',
        direccion: metodoEntrega === 'domicilio' ? document.getElementById('client-address').value : '', 
    };

    const totalPedido = cart.reduce((sum, item) => sum + item.total, 0);

    const payload = { 
        action: 'submitOrder',
        cliente: { ...clienteData, total: totalPedido }, 
        items: cart
    };

    const result = await callAppsScript(payload);

    if (result.status === 'success') {
        const folio = result.folio;
        
        // Preparar la URL de Conekta (usando centavos)
        const totalConekta = (totalPedido * 100).toFixed(0); 

        const conektaUrl = `${CONEKTA_CHECKOUT_URL}?amount=${totalConekta}&description=Pedido ${folio}&reference=${folio}&currency=MXN&public_key=${CONEKTA_PUBLIC_KEY}`;

        document.getElementById('payment-total').textContent = totalPedido.toFixed(2);
        document.getElementById('conekta-link').href = conektaUrl;
        navigate('payment');
        
        // NOTA: En un entorno real, aquí se abriría la ventana de Conekta o se redirigiría.
        // Después de la redirección, simulamos el éxito del pago.
        
        // Simulación de pago exitoso (lo que haría tu WebHook en un entorno real)
        setTimeout(() => {
            handlePaymentSuccess(folio);
        }, 3000); 

    } else {
        alert(`Error al procesar el pedido: ${result.message}. Por favor, inténtalo de nuevo.`);
        document.getElementById('proceed-to-payment-btn').disabled = false;
        document.getElementById('proceed-to-payment-btn').textContent = 'Finalizar y Pagar con Conekta';
    }
}

function handlePaymentSuccess(folio) {
    // 1. Limpiar Carrito
    cart = [];
    saveCart();

    // 2. Mostrar confirmación
    document.getElementById('order-folio').textContent = folio;
    navigate('confirmation');

    // Aquí se asume que el Apps Script ya envió el correo al cliente.
}

// --- INICIALIZACIÓN ---
window.onload = () => {
    loadCart();
    navigate('home');
    // Inicializa la división del título y el carrusel al cargar la página
    initializeLumenTitle();
    setupCarouselListeners(); 
    showSlide(0);
};
