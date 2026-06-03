export function load({ params }) {
	return { nombre: decodeURIComponent(params.nombre) };
}
