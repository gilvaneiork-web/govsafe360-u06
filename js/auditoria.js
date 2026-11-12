// GOVSAFE 360 · Marco 4 — revisão humana simulada, auditoria local e exportações.
// Funções PURAS: sem DOM; armazenamento e data/hora ("agora") chegam como parâmetro.
// Carregar depois de js/politica.js e js/cenarios.js.
// Limite declarado: auditoria LOCAL e NÃO imutável (qualquer pessoa com acesso ao
// navegador pode apagá-la). Não tem valor institucional.

(function (global) {
  'use strict';

  const CHAVE = 'govsafe360:v1:auditoria';
  const MAX_EVENTOS = 500;
  const MAX_RESUMO = 400;
  const MAX_JUSTIFICATIVA_RESUMO = 120;
  const TIPOS = Object.freeze(['cadastro', 'revisao', 'restauracao', 'exportacao']);
  const ROTULO_REVISAO = Object.freeze({ aprovado: 'Aprovado (simulado)', rejeitado: 'Rejeitado (simulado)', pendente: 'Pendente' });

  function cenarios() {
    if (!global.GovsafeCenarios) throw new Error('js/cenarios.js precisa ser carregado antes de js/auditoria.js');
    return global.GovsafeCenarios;
  }

  function iso(agora) {
    const d = agora instanceof Date ? agora : new Date(agora);
    if (Number.isNaN(d.getTime())) throw new Error('Data/hora inválida.');
    return d.toISOString();
  }

  function cortar(texto, max) {
    return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
  }

  // ---------- Revisão humana simulada (R04, CA07) ----------

  // Devolve {ok, erros, cenarios (nova lista), cenario, resumo}. Não altera a lista recebida.
  // A decisão do motor é recalculada e permanece a mesma: revisão não reclassifica.
  function revisar(lista, { cenarioId, acao, justificativa } = {}, agora = new Date()) {
    const alvo = lista.find((c) => c.id === cenarioId);
    if (!alvo) return { ok: false, erros: { cenarioId: 'Selecione um cenário existente.' }, cenarios: lista, cenario: null, resumo: null };

    const revisao = { acao, justificativa: typeof justificativa === 'string' ? justificativa.trim() : '', dataHora: iso(agora) };
    const erros = cenarios().validarRevisao(revisao, alvo.decisao);
    if (Object.keys(erros).length > 0) return { ok: false, erros, cenarios: lista, cenario: null, resumo: null };

    const revisado = cenarios().classificarRegistro({ ...alvo, revisao });
    const resumo = `${alvo.id} ${acao === 'aprovado' ? 'aprovado' : 'rejeitado'} (simulado). ` +
      `Decisão do motor: ${revisado.decisao}. Justificativa: ${cortar(revisao.justificativa, MAX_JUSTIFICATIVA_RESUMO)}`;
    return { ok: true, erros: {}, cenarios: lista.map((c) => (c.id === alvo.id ? revisado : c)), cenario: revisado, resumo };
  }

  // ---------- Auditoria local (R05) ----------

  function eventoValido(e) {
    return e && typeof e === 'object' &&
      typeof e.id === 'string' && /^E\d+$/.test(e.id) &&
      typeof e.dataHora === 'string' && !Number.isNaN(Date.parse(e.dataHora)) &&
      TIPOS.includes(e.tipo) &&
      (e.cenarioId === null || (typeof e.cenarioId === 'string' && /^C\d+$/.test(e.cenarioId))) &&
      typeof e.resumo === 'string' && e.resumo.length <= MAX_RESUMO;
  }

  function proximoIdEvento(eventos) {
    const maior = eventos.reduce((m, e) => Math.max(m, Number(e.id.slice(1)) || 0), 0);
    return `E${String(maior + 1).padStart(4, '0')}`;
  }

  // Devolve nova lista com o evento acrescentado (mantém só os MAX_EVENTOS mais recentes).
  function registrarEvento(eventos, { tipo, cenarioId = null, resumo }, agora = new Date()) {
    if (!TIPOS.includes(tipo)) throw new Error(`Tipo de evento inválido: ${tipo}`);
    let texto = cortar(String(resumo ?? '').trim(), MAX_RESUMO);
    if (cenarios().detectarSegredo(texto)) texto = '[resumo removido: parecia conter dado sensível]';
    const evento = Object.freeze({ id: proximoIdEvento(eventos), dataHora: iso(agora), tipo, cenarioId, resumo: texto });
    return [...eventos, evento].slice(-MAX_EVENTOS);
  }

  // Devolve {eventos, aviso}. Nunca lança erro.
  function carregarAuditoria(armazenamento) {
    let bruto = null;
    try { bruto = armazenamento ? armazenamento.getItem(CHAVE) : null; } catch { return { eventos: [], aviso: null }; }
    if (bruto === null) return { eventos: [], aviso: null };
    let lista;
    try { lista = JSON.parse(bruto); } catch { lista = null; }
    if (!Array.isArray(lista)) return { eventos: [], aviso: 'Auditoria local corrompida: o histórico foi reiniciado.' };
    const validos = lista.filter(eventoValido).map((e) => Object.freeze({ ...e })).slice(-MAX_EVENTOS);
    const descartados = lista.length - lista.filter(eventoValido).length;
    return { eventos: validos, aviso: descartados > 0 ? `${descartados} evento(s) de auditoria inválido(s) foram ignorados.` : null };
  }

  function salvarAuditoria(armazenamento, eventos) {
    if (!armazenamento) return { ok: false, aviso: 'Armazenamento local indisponível: a auditoria não será salva.' };
    try {
      armazenamento.setItem(CHAVE, JSON.stringify(eventos.slice(-MAX_EVENTOS)));
      return { ok: true, aviso: null };
    } catch {
      return { ok: false, aviso: 'Não foi possível salvar a auditoria local.' };
    }
  }

  function limparAuditoria(armazenamento) {
    try { armazenamento?.removeItem(CHAVE); return true; } catch { return false; }
  }

  // ---------- Exportações (R06, CA08) ----------

  const COLUNAS_CSV = Object.freeze(['id', 'titulo', 'finalidade', 'dados', 'ambiente', 'autonomia',
    'decisao', 'regra', 'motivo', 'revisao', 'justificativa_revisao', 'data_revisao']);

  // Escapa uma célula CSV e neutraliza injeção de fórmula (=, +, -, @, Tab, CR no início).
  function celulaCSV(valor) {
    let s = String(valor ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[;"\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  // CSV com BOM UTF-8 e separador ";" (padrão do Excel em pt-BR). Exporta a base inteira.
  function gerarCSV(lista) {
    const linhas = [COLUNAS_CSV.join(';')];
    for (const c of lista) {
      const r = c.revisao;
      linhas.push([c.id, c.titulo, c.finalidade, c.dados, c.ambiente, c.autonomia, c.decisao, c.regra, c.motivo,
        r ? r.acao : 'pendente', r ? r.justificativa : '', r ? r.dataHora : ''].map(celulaCSV).join(';'));
    }
    return `﻿${linhas.join('\r\n')}\r\n`;
  }

  function gerarJSON(eventos, agora = new Date()) {
    return JSON.stringify({
      sistema: 'GOVSAFE 360 · laboratório didático',
      aviso: 'Dados fictícios. Auditoria local, não imutável e sem valor institucional.',
      versao: 1,
      geradoEm: iso(agora),
      total: eventos.length,
      eventos
    }, null, 2);
  }

  // Nome com a data LOCAL (evita trocar de dia pelo fuso UTC à noite).
  function nomeArquivo(prefixo, extensao, agora = new Date()) {
    const d = agora instanceof Date ? agora : new Date(agora);
    const data = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    return `govsafe360-${prefixo}-${data}.${extensao}`;
  }

  global.GovsafeAuditoria = Object.freeze({
    CHAVE, MAX_EVENTOS, TIPOS, ROTULO_REVISAO, COLUNAS_CSV,
    revisar, registrarEvento, carregarAuditoria, salvarAuditoria, limparAuditoria,
    celulaCSV, gerarCSV, gerarJSON, nomeArquivo
  });
})(globalThis);
