export const brl = (v) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');

export const CATEGORIAS = ['Prato do dia', 'Grelhados', 'Porções', 'Bebidas', 'Sobremesas'];

export function gerarCodigo() {
  return '#' + String(Math.floor(Math.random() * 9000) + 1000);
}
