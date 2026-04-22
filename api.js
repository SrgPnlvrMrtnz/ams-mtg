let puntero = 0;
let favoritos = JSON.parse(localStorage.getItem('mtg_favs')) || [];
let mazos = JSON.parse(localStorage.getItem('mtg_mazos')) || {};
let colorSeleccionado = "";

// --- LISTA DE FRASES MÁGICAS ---
const frasesMagicas = [
    "Invocando hechizos del grimorio...",
    "Canalizando maná de las tierras lejanas...",
    "Consultando el Oráculo de Scryfall...",
    "Invocando criaturas del Multiverso...",
    "Tejiendo los hilos del Éter...",
    "Despertando el poder de los Planeswalkers...",
    "Buscando reliquias en las ruinas de Dominaria...",
    "Preparando tu próxima victoria...",
    "Leyendo los pergaminos antiguos...",
    "Extrayendo energía de las líneas místicas...",
    "Explorando los planos de existencia..."
];

function obtenerFraseAleatoria() {
    return frasesMagicas[Math.floor(Math.random() * frasesMagicas.length)];
}

window.onload = () => {
    actualizarVistaFavoritos();
    actualizarSelectorMazos();
    configurarFiltrosColor();
};

// --- FILTROS DE COLOR ---
function configurarFiltrosColor() {
    document.querySelectorAll('.mana-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.mana-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            colorSeleccionado = btn.dataset.color;
            puntero = 0;
            rellenarPaginaCartas(0);
        };
    });

    document.getElementById("clearFilters").onclick = () => {
        document.querySelectorAll('.mana-btn').forEach(b => b.classList.remove('active'));
        colorSeleccionado = "";
        puntero = 0;
        rellenarPaginaCartas(0);
    };
}

// --- FUNCIONES API ---
async function buscarCarta(texto, p) {
    let query = texto || "";
    if (colorSeleccionado) query += ` c:${colorSeleccionado}`;
    if (!query) query = "is:spells";

    let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&page=${p + 1}`;
    let respuesta = await fetch(url);
    return await respuesta.json();
}

function mostrarMensaje(msg, cargando = false) {
    const loader = document.getElementById("loader");
    const statusTxt = document.getElementById("status-msg");
    if (msg === "" && !cargando) {
        loader.classList.add("hidden");
    } else {
        loader.classList.remove("hidden");
        statusTxt.innerText = msg;
    }
}

// --- FAVORITOS ---
function actualizarVistaFavoritos() {
    const listaUI = document.getElementById("listaFavoritos");
    listaUI.innerHTML = "";
    localStorage.setItem('mtg_favs', JSON.stringify(favoritos));
    favoritos.forEach((nombre, i) => {
        let li = document.createElement("li");
        li.innerHTML = `<span>${nombre}</span><button class="btn-eliminar-item" onclick="eliminarFav(${i})">X</button>`;
        listaUI.appendChild(li);
    });
}
function eliminarFav(i) { favoritos.splice(i, 1); actualizarVistaFavoritos(); }

// --- GESTIÓN DE MAZOS ---
document.getElementById("crearMazo").onclick = () => {
    let nombre = document.getElementById("nuevoMazoNombre").value.trim();
    if (nombre && !mazos[nombre]) {
        mazos[nombre] = [];
        document.getElementById("nuevoMazoNombre").value = "";
        actualizarSelectorMazos();
        localStorage.setItem('mtg_mazos', JSON.stringify(mazos));
    }
};

function actualizarSelectorMazos() {
    let select = document.getElementById("selectorMazos");
    select.innerHTML = '<option value="">-- Seleccionar Mazo --</option>';
    Object.keys(mazos).forEach(m => {
        let opt = document.createElement("option");
        opt.value = m; opt.innerText = m;
        select.appendChild(opt);
    });
}

function actualizarVistaMazo() {
    let mazoSeleccionado = document.getElementById("selectorMazos").value;
    let lista = document.getElementById("listaCartasMazo");
    lista.innerHTML = "";
    if (mazoSeleccionado && mazos[mazoSeleccionado]) {
        mazos[mazoSeleccionado].forEach((carta, i) => {
            let li = document.createElement("li");
            li.innerHTML = `<span>${carta}</span><button class="btn-eliminar-item" onclick="quitarDelMazo(${i})">X</button>`;
            lista.appendChild(li);
        });
    }
}
document.getElementById("selectorMazos").onchange = actualizarVistaMazo;

function quitarDelMazo(i) {
    let m = document.getElementById("selectorMazos").value;
    mazos[m].splice(i, 1);
    localStorage.setItem('mtg_mazos', JSON.stringify(mazos));
    actualizarVistaMazo();
}

// --- RENDERIZADO ---
function rellenarPaginaCartas(p) {
    let contenedor = document.getElementById("contenedor");
    let texto = document.getElementById("texto").value;

    contenedor.innerHTML = "";
    // AQUÍ USAMOS LA FRASE ALEATORIA
    mostrarMensaje(obtenerFraseAleatoria(), true);

    buscarCarta(texto, p).then(cartas => {
        mostrarMensaje("");
        if (!cartas.data || cartas.data.length === 0) return mostrarMensaje("El hechizo ha fallado: No hay cartas.");

        cartas.data.forEach((carta) => {
            let cardWrapper = document.createElement("div");
            cardWrapper.className = "card-wrapper";
            
            let img = document.createElement("img");
            img.src = carta.image_uris ? carta.image_uris.png : (carta.card_faces ? carta.card_faces[0].image_uris.png : "");
            
            let btnFav = document.createElement("button");
            btnFav.className = "btn-fav-card"; btnFav.innerText = "⭐";
            btnFav.onclick = () => { if(!favoritos.includes(carta.name)){ favoritos.push(carta.name); actualizarVistaFavoritos(); }};

            let btnDeck = document.createElement("button");
            btnDeck.className = "btn-deck-card"; btnDeck.innerText = "➕";
            btnDeck.onclick = () => {
                let m = document.getElementById("selectorMazos").value;
                if (!m) return alert("Selecciona un mazo primero.");
                mazos[m].push(carta.name);
                localStorage.setItem('mtg_mazos', JSON.stringify(mazos));
                actualizarVistaMazo();
            };

            cardWrapper.append(img, btnFav, btnDeck);
            contenedor.appendChild(cardWrapper);
        });
    }).catch(() => mostrarMensaje("Interferencia en el plano astral (Error de red)."));
}

document.getElementById("buscardCarta").onclick = () => { puntero = 0; document.getElementById("numPagina").innerText = 1; rellenarPaginaCartas(0); };
document.getElementById("siguiente").onclick = () => { puntero++; document.getElementById("numPagina").innerText = puntero+1; rellenarPaginaCartas(puntero); };
document.getElementById("anterior").onclick = () => { if(puntero > 0){ puntero--; document.getElementById("numPagina").innerText = puntero+1; rellenarPaginaCartas(puntero); }};

document.getElementById("generarCarta").onclick = () => {
    mostrarMensaje("Buscando una anomalía temporal...", true);
    fetch("https://api.scryfall.com/cards/random").then(r => r.json()).then(carta => {
        document.getElementById("contenedor").innerHTML = "";
        mostrarMensaje("");
        let cardWrapper = document.createElement("div");
        cardWrapper.className = "card-wrapper";
        let img = document.createElement("img");
        img.src = carta.image_uris.png;
        cardWrapper.appendChild(img);
        document.getElementById("contenedor").appendChild(cardWrapper);
    });
};