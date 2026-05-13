<script lang="ts">
    import {onMount} from 'svelte';

    let nombreMazo = $state('');
    let cartas = $state<any[]>([]);
    let cargando = $state(false);
    let cartaDetalle = $state<any | null>(null);

    function obtenerImagenUrl(carta:any){
        if(carta.image_uris?.png){
            return carta.image_uris.png;
        }
        if(carta.card_faces?.[0]?.image_uris?.png){ //si tiene cara, devuelve la primera cara, y si existe en png, si no, devuelve undefined, por eso el ?
            return carta.card_faces[0].image_uris.png;
            return ''; 
        } //falta por entender mejor lo de ? 
    }

    onMount(async () => { //nombre metodo onMount porque espera a que todo este cargado y de ahi se ejecuta la funcion
    const nombresCartas: string[] = JSON.parse(localStorage.getItem('mazoAVer') || '[]');
    nombreMazo = localStorage.getItem('nombreMazo') || 'Mi Mazo';

    if (nombresCartas.length === 0) return;

    cargando = true;
    const resultados = await Promise.all( //lanza todos los fetches a la vez en paralelo y espera a que todos terminen.
        nombresCartas.map((nombre) => //.map transforma cada nombre en una promesa de fetch. El resultado es un array de promesas.
            fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(nombre)}`) //encodeURIComponent — convierte el nombre a formato URL seguro. Por ejemplo "Lightning Bolt" → "Lightning%20Bolt".
                .then((r) => r.json())
                .catch(() => null)
        )
    );
    cartas = resultados.filter(Boolean); //elimina los null del array resultante.
    cargando = false;
});
</script>

<!--HTML-->
<h1>Nombre del Mazo: {nombreMazo}</h1>

{#if cargando}
    <p>Cargando...</p>
{:else}
    {#each cartas as carta}
        {@const imgUrl = obtenerImagenUrl(carta)}
        <div>
            {#if imgUrl}<img src={imgUrl} alt={carta.name} style="width: 200px;" />{/if}
            <p>Nombre: {carta.name}</p>
            <p>Coste de maná: {carta.mana_cost}</p>
            <p>Inline: {carta.type_line}</p>
            <p>Oráculo: {carta.oracle_text}</p>
        </div>
    {/each}
{/if}