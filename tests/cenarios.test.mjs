// Testes do módulo de cenários (Marco 3). Executar: npm run test:policy
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/politica.js';
import '../js/cenarios.js';

const C = globalThis.GovsafeCenarios;
const { DECISAO } = globalThis.GovsafePolitica;

// Armazenamento falso com a mesma interface do localStorage.
function armazenamentoFalso(inicial = {}) {
  const mapa = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    bruto: (k) => mapa.get(k)
  };
}

const valido = {
  titulo: 'Rascunho de relatório sintético', finalidade: 'Treinar a equipe',
  dados: 'publico', ambiente: 'desenvolvimento', autonomia: 'proposta', justificativa: 'Dados inventados para aula.'
};

test('armazenamento vazio: grava e devolve os 8 exemplos (R09)', () => {
  const s = armazenamentoFalso();
  const { cenarios, aviso } = C.carregar(s);
  assert.equal(cenarios.length, 8);
  assert.equal(aviso, null);
  assert.equal(JSON.parse(s.bruto(C.CHAVE)).length, 8);
});

test('os 8 exemplos passam na própria validação', () => {
  for (const e of C.EXEMPLOS) assert.ok(C.validar(e).ok, e.id);
});

test('JSON corrompido ou não-lista: restaura exemplos e avisa', () => {
  for (const lixo of ['{quebrado', '{"a":1}', '42']) {
    const s = armazenamentoFalso({ [C.CHAVE]: lixo });
    const { cenarios, aviso } = C.carregar(s);
    assert.equal(cenarios.length, 8, lixo);
    assert.match(aviso, /corrompidos/);
  }
});

test('armazenamento indisponível ou que lança erro: não quebra e avisa', () => {
  assert.match(C.carregar(null).aviso, /indisponível/);
  const quebrado = { getItem() { throw new Error('bloqueado'); } };
  assert.equal(C.carregar(quebrado).cenarios.length, 8);
  assert.equal(C.salvar({ setItem() { throw new Error('cheio'); } }, []).ok, false);
});

test('salvar e carregar: persiste o cenário novo (CA06, simula F5)', () => {
  const s = armazenamentoFalso();
  const r = C.adicionar(C.carregar(s).cenarios, valido);
  assert.ok(r.ok);
  assert.equal(r.novo.id, 'C09');
  assert.equal(r.novo.decisao, DECISAO.PERMITIDO);
  C.salvar(s, r.cenarios);
  const depois = C.carregar(s).cenarios;
  assert.equal(depois.length, 9);
  assert.equal(depois[8].titulo, valido.titulo);
});

test('decisão nunca é gravada; decisão adulterada no armazenamento é recalculada', () => {
  const s = armazenamentoFalso();
  C.salvar(s, C.carregar(s).cenarios);
  assert.ok(!s.bruto(C.CHAVE).includes('decisao'));
  const adulterado = [{ ...C.EXEMPLOS[6], decisao: 'Permitido', motivo: 'forjado' }]; // C07 credencial
  s.setItem(C.CHAVE, JSON.stringify(adulterado));
  const [c07] = C.carregar(s).cenarios;
  assert.equal(c07.decisao, DECISAO.NAO_AUTORIZADO);
  assert.match(c07.motivo, /^Regra 1:/);
});

test('registros inválidos ou duplicados no armazenamento são ignorados com aviso', () => {
  const s = armazenamentoFalso({ [C.CHAVE]: JSON.stringify([
    C.EXEMPLOS[0], C.EXEMPLOS[0], { ...C.EXEMPLOS[1], dados: 'secreto' }, { ...C.EXEMPLOS[2], id: '<script>' }
  ]) });
  const { cenarios, aviso } = C.carregar(s);
  assert.equal(cenarios.length, 1);
  assert.match(aviso, /3 registro/);
});

test('base vazia salva ("[]") é respeitada: não recria exemplos', () => {
  const s = armazenamentoFalso({ [C.CHAVE]: '[]' });
  assert.equal(C.carregar(s).cenarios.length, 0);
});

test('validação: obrigatórios, taxonomia e limite de tamanho', () => {
  const v = C.validar({});
  assert.equal(v.ok, false);
  assert.deepEqual(Object.keys(v.erros).sort(), ['ambiente', 'autonomia', 'dados', 'finalidade', 'justificativa', 'titulo']);
  assert.match(C.validar({ ...valido, titulo: '   ' }).erros.titulo, /obrigatório/);
  assert.match(C.validar({ ...valido, ambiente: 'PRODUCAO' }).erros.ambiente, /válida/);
  assert.match(C.validar({ ...valido, titulo: 'x'.repeat(81) }).erros.titulo, /80/);
  assert.equal(C.validar({ ...valido, titulo: '  com espaços  ' }).valor.titulo, 'com espaços');
});

test('validação: recusa texto com aparência de CPF, e-mail, senha ou token', () => {
  const casos = ['CPF 123.456.789-09', '12345678909', 'fulano@exemplo.gov.br', 'a senha é 1234', 'token do sistema', 'api_key xyz'];
  for (const texto of casos) {
    assert.equal(C.validar({ ...valido, justificativa: texto }).ok, false, texto);
  }
  assert.equal(C.validar({ ...valido, justificativa: 'Sentença sobre tokenização fictícia' }).ok, true);
});

test('adicionar não altera a lista original e gera IDs sequenciais', () => {
  const base = C.exemplosClassificados();
  const r = C.adicionar(base, valido);
  assert.equal(base.length, 8);
  assert.equal(C.adicionar(r.cenarios, valido).novo.id, 'C10');
  assert.equal(C.proximoId([]), 'C01');
  assert.equal(C.adicionar(base, {}).ok, false);
});

test('cadastro de credencial é sempre Não autorizado (CA02)', () => {
  const r = C.adicionar([], { ...valido, dados: 'credencial' });
  assert.equal(r.novo.decisao, DECISAO.NAO_AUTORIZADO);
});

test('filtro por texto ignora maiúsculas e acentos; filtro por decisão combina', () => {
  const base = C.exemplosClassificados();
  assert.deepEqual(C.filtrar(base, { texto: 'PRODUCAO' }).map((c) => c.id), ['C05', 'C06']);
  assert.deepEqual(C.filtrar(base, { texto: 'c07' }).map((c) => c.id), ['C07']);
  assert.equal(C.filtrar(base, { decisao: DECISAO.NAO_AUTORIZADO }).length, 3);
  assert.deepEqual(C.filtrar(base, { texto: 'produção', decisao: DECISAO.CONDICIONADO }).map((c) => c.id), ['C05']);
  assert.equal(C.filtrar(base, {}).length, 8);
});

test('busca sem resultado devolve lista vazia (estado vazio)', () => {
  assert.deepEqual(C.filtrar(C.exemplosClassificados(), { texto: 'xyz' }), []);
});

test('limpar remove a chave e não quebra sem armazenamento', () => {
  const s = armazenamentoFalso();
  C.carregar(s);
  assert.ok(C.limpar(s));
  assert.equal(s.getItem(C.CHAVE), null);
  assert.equal(C.limpar(null), true);
});
