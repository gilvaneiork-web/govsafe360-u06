// GOVSAFE 360 · Marco 3 — cenários: exemplos, validação, filtro e persistência.
// Funções PURAS: não tocam no DOM; o armazenamento é recebido como parâmetro
// (localStorage no navegador, objeto falso nos testes Node).
// A decisão NUNCA é gravada nem lida do armazenamento: é sempre recalculada
// por GovsafePolitica.classificar (js/politica.js deve ser carregado antes).

(function (global) {
  'use strict';

  const CHAVE = 'govsafe360:v1:cenarios';
  const LIMITES = Object.freeze({ titulo: 80, finalidade: 160, justificativa: 300 });
  const CAMPOS_TEXTO = Object.freeze(['titulo', 'finalidade', 'justificativa']);
  const CAMPOS_TAXONOMIA = Object.freeze(['dados', 'ambiente', 'autonomia']);
  const CAMPOS_GRAVADOS = Object.freeze(['id', ...CAMPOS_TEXTO, ...CAMPOS_TAXONOMIA]);

  // Oito cenários sintéticos pré-carregados (R09). Somente dados fictícios.
  const EXEMPLOS = Object.freeze([
    { id: 'C01', titulo: 'Resumo de norma pública fictícia', finalidade: 'Apoiar estudo interno da equipe',
      dados: 'publico', ambiente: 'desenvolvimento', autonomia: 'leitura', justificativa: 'Material público sem dados sensíveis.' },
    { id: 'C02', titulo: 'Proposta de texto de FAQ', finalidade: 'Sugerir redação para página de ajuda',
      dados: 'publico', ambiente: 'desenvolvimento', autonomia: 'proposta', justificativa: 'Texto será revisado antes de publicar.' },
    { id: 'C03', titulo: 'Análise de planilha interna sintética', finalidade: 'Identificar padrões em dados de teste',
      dados: 'interno', ambiente: 'desenvolvimento', autonomia: 'leitura', justificativa: 'Planilha gerada só para o laboratório.' },
    { id: 'C04', titulo: 'Leitura de página web externa', finalidade: 'Coletar referências para relatório',
      dados: 'externo', ambiente: 'homologacao', autonomia: 'leitura', justificativa: 'Conteúdo externo tratado apenas como dado.' },
    { id: 'C05', titulo: 'Consulta a painel em produção', finalidade: 'Conferir indicador público',
      dados: 'publico', ambiente: 'producao', autonomia: 'leitura', justificativa: 'Somente leitura, sem alteração.' },
    { id: 'C06', titulo: 'Edição de cadastro em produção', finalidade: 'Corrigir campo de registro',
      dados: 'interno', ambiente: 'producao', autonomia: 'edicao', justificativa: 'Exemplo de caso que deve ser barrado.' },
    { id: 'C07', titulo: 'Uso de credencial fictícia', finalidade: 'Acessar sistema para automação',
      dados: 'credencial', ambiente: 'desenvolvimento', autonomia: 'execucao', justificativa: 'Exemplo de caso que deve ser barrado.' },
    { id: 'C08', titulo: 'Exclusão em massa de registros', finalidade: 'Limpar base de homologação',
      dados: 'interno', ambiente: 'homologacao', autonomia: 'critica', justificativa: 'Exemplo de ação crítica irreversível.' }
  ].map(Object.freeze));

  // Heurística simples para recusar texto com aparência de segredo ou dado pessoal.
  // Não é DLP: apenas um lembrete técnico da política de dados do laboratório.
  const PADROES_PROIBIDOS = [
    [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, 'parece conter CPF'],
    [/[^\s@]+@[^\s@]+\.[^\s@]+/, 'parece conter e-mail'],
    [/\b(senhas?|password|passwd|tokens?|api[-_ ]?key|secret|segredo)\b/i, 'menciona senha, token ou segredo']
  ];

  function politica() {
    if (!global.GovsafePolitica) throw new Error('js/politica.js precisa ser carregado antes de js/cenarios.js');
    return global.GovsafePolitica;
  }

  function normalizar(texto) {
    return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function detectarSegredo(texto) {
    for (const [regex, motivo] of PADROES_PROIBIDOS) if (regex.test(texto)) return motivo;
    return null;
  }

  // Valida dados vindos do formulário. Devolve {ok, erros: {campo: mensagem}, valor}.
  function validar(entrada) {
    const { TAXONOMIA } = politica();
    const e = entrada || {};
    const erros = {};
    const valor = {};

    for (const campo of CAMPOS_TEXTO) {
      const texto = typeof e[campo] === 'string' ? e[campo].trim() : '';
      valor[campo] = texto;
      if (!texto) erros[campo] = 'Campo obrigatório.';
      else if (texto.length > LIMITES[campo]) erros[campo] = `Máximo de ${LIMITES[campo]} caracteres.`;
      else {
        const segredo = detectarSegredo(texto);
        if (segredo) erros[campo] = `Texto ${segredo}. Use apenas dados fictícios.`;
      }
    }
    for (const campo of CAMPOS_TAXONOMIA) {
      valor[campo] = e[campo];
      if (!TAXONOMIA[campo].includes(e[campo])) erros[campo] = 'Selecione uma opção válida.';
    }
    return { ok: Object.keys(erros).length === 0, erros, valor };
  }

  // Acrescenta decisão, regra e motivo calculados pelo motor (nunca lidos do armazenamento).
  function classificarRegistro(registro) {
    const r = politica().classificar(registro);
    return Object.freeze({ ...registro, decisao: r.decisao, regra: r.regra, motivo: [r.motivo, ...r.alertas].join(' ') });
  }

  function somenteCamposGravados(registro) {
    return Object.fromEntries(CAMPOS_GRAVADOS.map((campo) => [campo, registro[campo]]));
  }

  function proximoId(cenarios) {
    const maior = cenarios.reduce((m, c) => {
      const n = /^C(\d+)$/.exec(c.id);
      return n ? Math.max(m, Number(n[1])) : m;
    }, 0);
    return `C${String(maior + 1).padStart(2, '0')}`;
  }

  function exemplosClassificados() {
    return EXEMPLOS.map(classificarRegistro);
  }

  // Lê do armazenamento. Devolve {cenarios, aviso}. Nunca lança erro.
  function carregar(armazenamento) {
    if (!armazenamento) {
      return { cenarios: exemplosClassificados(), aviso: 'Armazenamento local indisponível: os dados não serão salvos.' };
    }
    let bruto;
    try { bruto = armazenamento.getItem(CHAVE); } catch {
      return { cenarios: exemplosClassificados(), aviso: 'Armazenamento local indisponível: os dados não serão salvos.' };
    }
    if (bruto === null) {
      const gravacao = salvar(armazenamento, EXEMPLOS);
      return { cenarios: exemplosClassificados(), aviso: gravacao.aviso };
    }
    let lista;
    try { lista = JSON.parse(bruto); } catch { lista = null; }
    if (!Array.isArray(lista)) {
      salvar(armazenamento, EXEMPLOS);
      return { cenarios: exemplosClassificados(), aviso: 'Dados locais corrompidos: os cenários de exemplo foram restaurados.' };
    }
    const ids = new Set();
    const validos = lista.filter((item) => {
      if (!item || typeof item.id !== 'string' || !/^C\d+$/.test(item.id) || ids.has(item.id)) return false;
      if (!validar(item).ok) return false;
      ids.add(item.id);
      return true;
    });
    const descartados = lista.length - validos.length;
    return {
      cenarios: validos.map((item) => classificarRegistro(somenteCamposGravados(item))),
      aviso: descartados > 0 ? `${descartados} registro(s) local(is) inválido(s) foram ignorados.` : null
    };
  }

  // Grava apenas os campos de entrada (sem decisão). Devolve {ok, aviso}.
  function salvar(armazenamento, cenarios) {
    if (!armazenamento) return { ok: false, aviso: 'Armazenamento local indisponível: os dados não serão salvos.' };
    try {
      armazenamento.setItem(CHAVE, JSON.stringify(cenarios.map(somenteCamposGravados)));
      return { ok: true, aviso: null };
    } catch {
      return { ok: false, aviso: 'Não foi possível salvar no armazenamento local.' };
    }
  }

  function limpar(armazenamento) {
    try { armazenamento?.removeItem(CHAVE); return true; } catch { return false; }
  }

  // Valida e acrescenta. Devolve {ok, erros, cenarios (nova lista), novo}. Não altera a lista recebida.
  function adicionar(cenarios, entrada) {
    const v = validar(entrada);
    if (!v.ok) return { ok: false, erros: v.erros, cenarios, novo: null };
    const novo = classificarRegistro({ id: proximoId(cenarios), ...v.valor });
    return { ok: true, erros: {}, cenarios: [...cenarios, novo], novo };
  }

  // Busca por texto (ID, título, finalidade; ignora maiúsculas/acentos) e filtro por decisão.
  function filtrar(cenarios, { texto = '', decisao = '' } = {}) {
    const termo = normalizar(texto);
    return cenarios.filter((c) =>
      (!decisao || c.decisao === decisao) &&
      (!termo || [c.id, c.titulo, c.finalidade].some((campo) => normalizar(campo).includes(termo))));
  }

  global.GovsafeCenarios = Object.freeze({
    CHAVE, LIMITES, EXEMPLOS,
    validar, detectarSegredo, normalizar, proximoId,
    carregar, salvar, limpar, adicionar, filtrar, exemplosClassificados
  });
})(globalThis);
