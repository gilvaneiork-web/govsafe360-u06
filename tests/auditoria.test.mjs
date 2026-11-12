// Testes de revisão humana, auditoria e exportações (Marco 4). Executar: npm run test:policy
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/politica.js';
import '../js/cenarios.js';
import '../js/auditoria.js';

const A = globalThis.GovsafeAuditoria;
const C = globalThis.GovsafeCenarios;
const { DECISAO } = globalThis.GovsafePolitica;
const AGORA = '2026-11-12T15:30:00.000Z';
const JUST = 'Revisado em aula com dados fictícios.';

function armazenamentoFalso(inicial = {}) {
  const mapa = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k)
  };
}

// ---------- Revisão ----------

test('cenário Não autorizado NUNCA pode ser aprovado (CA07, aceite M4)', () => {
  const base = C.exemplosClassificados();
  for (const id of ['C06', 'C07', 'C08']) {
    const r = A.revisar(base, { cenarioId: id, acao: 'aprovado', justificativa: JUST }, AGORA);
    assert.equal(r.ok, false, id);
    assert.match(r.erros.acao, /não pode ser aprovado/);
    assert.equal(r.cenarios, base, 'lista original devolvida sem alteração');
  }
});

test('cenário Não autorizado pode ser rejeitado, e a decisão continua a mesma', () => {
  const r = A.revisar(C.exemplosClassificados(), { cenarioId: 'C07', acao: 'rejeitado', justificativa: JUST }, AGORA);
  assert.ok(r.ok);
  assert.equal(r.cenario.decisao, DECISAO.NAO_AUTORIZADO);
  assert.deepEqual(r.cenario.revisao, { acao: 'rejeitado', justificativa: JUST, dataHora: AGORA });
});

test('aprovar Condicionado ou Permitido é aceito e NÃO muda a decisão do motor', () => {
  const base = C.exemplosClassificados();
  for (const [id, decisao] of [['C03', DECISAO.CONDICIONADO], ['C01', DECISAO.PERMITIDO]]) {
    const r = A.revisar(base, { cenarioId: id, acao: 'aprovado', justificativa: JUST }, AGORA);
    assert.ok(r.ok, id);
    assert.equal(r.cenario.decisao, decisao);
    assert.match(r.resumo, new RegExp(`^${id} aprovado \\(simulado\\)\\. Decisão do motor: ${decisao}`));
  }
  assert.equal(base[2].revisao, undefined, 'lista original intacta');
});

test('justificativa obrigatória: vazia, curta, longa ou com segredo é recusada (R04)', () => {
  const base = C.exemplosClassificados();
  const casos = ['', '   ', 'curta', 'x'.repeat(301), 'Aprovado, a senha é 123.', 'Contato fulano@exemplo.gov.br'];
  for (const justificativa of casos) {
    const r = A.revisar(base, { cenarioId: 'C03', acao: 'rejeitado', justificativa }, AGORA);
    assert.equal(r.ok, false, JSON.stringify(justificativa));
    assert.ok(r.erros.justificativa);
  }
});

test('ação inválida e cenário inexistente são recusados', () => {
  const base = C.exemplosClassificados();
  assert.ok(A.revisar(base, { cenarioId: 'C03', acao: 'permitido', justificativa: JUST }, AGORA).erros.acao);
  assert.ok(A.revisar(base, { cenarioId: 'C99', acao: 'aprovado', justificativa: JUST }, AGORA).erros.cenarioId);
  assert.ok(A.revisar(base, undefined, AGORA).erros.cenarioId);
});

test('revisão persiste após F5; aprovação adulterada em Não autorizado é descartada ao carregar', () => {
  const s = armazenamentoFalso();
  const r = A.revisar(C.carregar(s).cenarios, { cenarioId: 'C03', acao: 'aprovado', justificativa: JUST }, AGORA);
  C.salvar(s, r.cenarios);
  assert.equal(C.carregar(s).cenarios[2].revisao.acao, 'aprovado');

  const gravado = JSON.parse(s.getItem(C.CHAVE));
  gravado[6].revisao = { acao: 'aprovado', justificativa: JUST, dataHora: AGORA }; // C07 forjado
  gravado[0].revisao = { acao: 'aprovado' };                                       // revisão incompleta
  s.setItem(C.CHAVE, JSON.stringify(gravado));
  const { cenarios, aviso } = C.carregar(s);
  assert.equal(cenarios.length, 8, 'os cenários ficam; só a revisão sai');
  assert.equal(cenarios[6].revisao, undefined);
  assert.equal(cenarios[6].decisao, DECISAO.NAO_AUTORIZADO);
  assert.equal(cenarios[0].revisao, undefined);
  assert.equal(cenarios[2].revisao.acao, 'aprovado');
  assert.match(aviso, /2 revisão/);
});

test('primeira carga sinaliza "semeado" (para registrar o evento inicial)', () => {
  const s = armazenamentoFalso();
  assert.equal(C.carregar(s).semeado, true);
  assert.equal(C.carregar(s).semeado, undefined);
});

// ---------- Auditoria ----------

test('registrarEvento: IDs sequenciais, data ISO, tipo validado, lista original intacta (R05)', () => {
  const e1 = A.registrarEvento([], { tipo: 'cadastro', cenarioId: 'C09', resumo: 'C09 cadastrado.' }, AGORA);
  const e2 = A.registrarEvento(e1, { tipo: 'revisao', cenarioId: 'C09', resumo: 'C09 rejeitado.' }, AGORA);
  assert.equal(e1.length, 1);
  assert.deepEqual(e2.map((e) => e.id), ['E0001', 'E0002']);
  assert.equal(e2[1].dataHora, AGORA);
  assert.throws(() => A.registrarEvento([], { tipo: 'apagar', resumo: 'x' }, AGORA), /inválido/);
});

test('auditoria não guarda segredos e corta resumos longos', () => {
  const [e] = A.registrarEvento([], { tipo: 'revisao', resumo: 'token=abc' }, AGORA);
  assert.match(e.resumo, /removido/);
  const [longo] = A.registrarEvento([], { tipo: 'revisao', resumo: 'a'.repeat(1000) }, AGORA);
  assert.equal(longo.resumo.length, 400);
});

test('auditoria mantém só os 500 eventos mais recentes', () => {
  let eventos = [];
  for (let i = 0; i < 505; i += 1) eventos = A.registrarEvento(eventos, { tipo: 'cadastro', resumo: `evento ${i}` }, AGORA);
  assert.equal(eventos.length, 500);
  assert.equal(eventos.at(-1).resumo, 'evento 504');
});

test('salvar/carregar auditoria; vazia, corrompida ou com lixo não quebra', () => {
  const s = armazenamentoFalso();
  assert.deepEqual(A.carregarAuditoria(s), { eventos: [], aviso: null });
  const eventos = A.registrarEvento([], { tipo: 'restauracao', resumo: 'Exemplos carregados.' }, AGORA);
  A.salvarAuditoria(s, eventos);
  assert.equal(A.carregarAuditoria(s).eventos[0].resumo, 'Exemplos carregados.');

  s.setItem(A.CHAVE, '{quebrado');
  assert.match(A.carregarAuditoria(s).aviso, /corrompida/);
  s.setItem(A.CHAVE, JSON.stringify([...eventos, { id: 'X', tipo: 'hack' }]));
  const r = A.carregarAuditoria(s);
  assert.equal(r.eventos.length, 1);
  assert.match(r.aviso, /1 evento/);
  assert.equal(A.carregarAuditoria(null).eventos.length, 0);
  assert.ok(A.limparAuditoria(s));
  assert.equal(s.getItem(A.CHAVE), null);
});

// ---------- Exportações ----------

test('CSV: BOM, cabeçalho com ";" e uma linha por cenário (R06, CA08)', () => {
  const csv = A.gerarCSV(C.exemplosClassificados());
  assert.ok(csv.startsWith('﻿'));
  const linhas = csv.slice(1).trimEnd().split('\r\n');
  assert.equal(linhas.length, 9);
  assert.equal(linhas[0], A.COLUNAS_CSV.join(';'));
  assert.ok(linhas[7].startsWith('C07;Uso de credencial fictícia;'));
  assert.ok(linhas[7].includes(';Não autorizado;1;'));
  assert.ok(linhas[7].endsWith(';pendente;;'));
});

test('CSV inclui a revisão quando existe', () => {
  const r = A.revisar(C.exemplosClassificados(), { cenarioId: 'C03', acao: 'aprovado', justificativa: JUST }, AGORA);
  const linha = A.gerarCSV(r.cenarios).split('\r\n')[3];
  assert.ok(linha.endsWith(`;aprovado;${JUST};${AGORA}`));
});

test('CSV: escapa ";", aspas e quebra de linha', () => {
  assert.equal(A.celulaCSV('a;b'), '"a;b"');
  assert.equal(A.celulaCSV('diz "oi"'), '"diz ""oi"""');
  assert.equal(A.celulaCSV('linha1\nlinha2'), '"linha1\nlinha2"');
  assert.equal(A.celulaCSV(null), '');
  assert.equal(A.celulaCSV(5), '5');
});

test('CSV: neutraliza injeção de fórmula', () => {
  assert.equal(A.celulaCSV('=1+1'), "'=1+1");
  assert.equal(A.celulaCSV('@SOMA(A1)'), "'@SOMA(A1)");
  assert.equal(A.celulaCSV('+55'), "'+55");
  assert.equal(A.celulaCSV('-2'), "'-2");
  assert.equal(A.celulaCSV('=A1;B1'), `"'=A1;B1"`);
  assert.equal(A.celulaCSV('texto normal'), 'texto normal');
});

test('JSON da auditoria: válido, com aviso, total e eventos em ordem (CA08)', () => {
  let eventos = A.registrarEvento([], { tipo: 'cadastro', cenarioId: 'C09', resumo: 'C09 cadastrado.' }, AGORA);
  eventos = A.registrarEvento(eventos, { tipo: 'exportacao', resumo: 'JSON exportado.' }, AGORA);
  const doc = JSON.parse(A.gerarJSON(eventos, AGORA));
  assert.match(doc.aviso, /fictícios/);
  assert.equal(doc.versao, 1);
  assert.equal(doc.geradoEm, AGORA);
  assert.equal(doc.total, 2);
  assert.deepEqual(doc.eventos.map((e) => e.id), ['E0001', 'E0002']);
});

test('nome de arquivo usa data local', () => {
  assert.equal(A.nomeArquivo('matriz', 'csv', new Date(2026, 10, 12, 23, 59)), 'govsafe360-matriz-2026-11-12.csv');
});
