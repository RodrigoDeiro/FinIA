// =============================================================================
// FinIA — Categorização por palavras-chave
// =============================================================================
//
// A base de merchants só conhece MARCAS (iFood, Uber, Netflix…). Termos
// genéricos ("mercado", "posto", "farmacia") não casavam e caíam em "Outros".
// Esta camada mapeia palavras comuns → slug de categoria do sistema.
//
// Precedência: candidato MAIS LONGO vence (ex: "mercado livre" → compras,
// não "mercado" → alimentacao). Match por palavra inteira.
//
// =============================================================================

const KEYWORDS: Record<string, string[]> = {
  alimentacao: [
    'mercado', 'supermercado', 'mercadinho', 'quitanda', 'sacolao', 'hortifruti',
    'feira', 'padaria', 'padoca', 'acougue', 'ifood', 'rappi', 'restaurante',
    'lanche', 'lanchonete', 'almoco', 'jantar', 'janta', 'cafe', 'pizza', 'pizzaria',
    'hamburguer', 'hamburgueria', 'churrasco', 'sorvete', 'bar', 'boteco', 'comida',
    'delivery', 'marmita',
  ],
  transporte: [
    'uber', 'taxi', 'onibus', 'metro', 'trem', 'passagem', 'gasolina', 'combustivel',
    'posto', 'etanol', 'alcool', 'estacionamento', 'pedagio', 'brt', 'blablacar',
    'corrida', 'moto taxi', 'bilhete unico', 'recarga bilhete',
  ],
  moradia: [
    'aluguel', 'condominio', 'iptu', 'faxina', 'diarista', 'reforma', 'mobilia',
    'luz', 'energia', 'agua', 'gas',
  ],
  saude: [
    'farmacia', 'drogaria', 'remedio', 'medico', 'consulta', 'dentista', 'exame',
    'hospital', 'psicologo', 'terapia', 'academia', 'plano de saude', 'vacina',
  ],
  educacao: [
    'escola', 'faculdade', 'curso', 'livro', 'apostila', 'mensalidade', 'material escolar',
    'aula', 'udemy',
  ],
  lazer: [
    'cinema', 'show', 'ingresso', 'balada', 'festa', 'viagem', 'hotel', 'passeio',
    'parque', 'jogo', 'boliche',
  ],
  assinaturas: [
    'netflix', 'spotify', 'disney', 'hbo', 'prime', 'youtube premium', 'assinatura',
    'internet', 'telefone', 'celular', 'claro', 'vivo', 'tim', 'plano',
  ],
  compras: [
    'roupa', 'tenis', 'sapato', 'calcado', 'loja', 'shopping', 'amazon', 'shopee',
    'aliexpress', 'magazine', 'presente', 'perfume', 'cosmetico', 'mercado livre',
  ],
  investimentos: [
    'acao', 'tesouro', 'cdb', 'bitcoin', 'cripto', 'investimento', 'corretora',
  ],
  impostos: [
    'imposto', 'ipva', 'multa', 'darf', 'inss', 'taxa',
  ],
  receitas: [
    'salario', 'freelance', 'freela', 'recebi', 'deposito', 'venda', 'bonus',
    'rendimento', 'pagamento recebido', 'pix recebido',
  ],
}

// Lista achatada { keyword, slug } ordenada do mais longo para o mais curto.
const FLAT: { kw: string; slug: string }[] = Object.entries(KEYWORDS)
  .flatMap(([slug, kws]) => kws.map((kw) => ({ kw, slug })))
  .sort((a, b) => b.kw.length - a.kw.length)

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Resolve o slug de categoria a partir do texto, ou null se nada casar. */
export function resolveCategorySlug(text: string): string | null {
  const haystack = normalize(text)
  if (!haystack) return null
  for (const { kw, slug } of FLAT) {
    if (new RegExp(`\\b${escapeRegex(kw)}\\b`).test(haystack)) return slug
  }
  return null
}
