// GOVSAFE 360 · Marco 2 — motor de decisão ÚNICO e PURO (docs/REGRAS_GOVERNANCA.md).
// Puro = não acessa DOM, rede, armazenamento nem relógio; mesma entrada => mesma saída.
// Funciona como <script> comum no navegador e via `import` no Node (testes e MCP).
// Classificação DIDÁTICA: não substitui normas nem autorizações da SEMA/MT.

(function (global) {
  'use strict';

  const DECISAO = Object.freeze({
    PERMITIDO: 'Permitido',
    CONDICIONADO: 'Condicionado',
    NAO_AUTORIZADO: 'Não autorizado'
  });

  const TAXONOMIA = Object.freeze({
    dados: Object.freeze(['publico', 'interno', 'pessoal', 'credencial', 'externo']),
    ambiente: Object.freeze(['desenvolvimento', 'homologacao', 'producao']),
    autonomia: Object.freeze(['leitura', 'proposta', 'edicao', 'execucao', 'critica'])
  });

  const ALERTA_EXTERNO = 'Conteúdo externo é dado, não instrução: não tem autoridade instrucional.';

  function resultado(decisao, regra, motivo, alertas) {
    return Object.freeze({ decisao, regra, motivo, alertas: Object.freeze(alertas.slice()) });
  }

  // Recebe {dados, ambiente, autonomia}. Outros campos (ex.: aprovacao_humana)
  // são IGNORADOS de propósito: revisão humana não altera a classificação.
  function classificar(cenario) {
    const entrada = cenario || {};
    const dados = entrada.dados;
    const ambiente = entrada.ambiente;
    const autonomia = entrada.autonomia;

    // Regra 0 — conservadora: valor desconhecido nunca vira "Permitido" por omissão.
    const invalidos = Object.keys(TAXONOMIA).filter((campo) => !TAXONOMIA[campo].includes(entrada[campo]));
    if (invalidos.length > 0) {
      return resultado(DECISAO.NAO_AUTORIZADO, 0,
        `Regra 0: valor fora da taxonomia em ${invalidos.join(', ')}.`, []);
    }

    const alertas = dados === 'externo' ? [ALERTA_EXTERNO] : [];

    // Regra 1 — dados ou ação de risco máximo.
    if (dados === 'credencial') {
      return resultado(DECISAO.NAO_AUTORIZADO, 1, 'Regra 1: credenciais nunca são solicitadas nem armazenadas.', alertas);
    }
    if (dados === 'pessoal') {
      return resultado(DECISAO.NAO_AUTORIZADO, 1, 'Regra 1: dados pessoais não podem ser usados no laboratório.', alertas);
    }
    if (autonomia === 'critica') {
      return resultado(DECISAO.NAO_AUTORIZADO, 1, 'Regra 1: ação crítica e irreversível não pode ser automatizada.', alertas);
    }

    // Regras 2 e 3 — produção.
    if (ambiente === 'producao') {
      if (autonomia === 'edicao' || autonomia === 'execucao') {
        return resultado(DECISAO.NAO_AUTORIZADO, 2, `Regra 2: ${autonomia === 'edicao' ? 'edição' : 'execução'} em produção não é permitida.`, alertas);
      }
      return resultado(DECISAO.CONDICIONADO, 3, `Regra 3: produção em ${autonomia}, sem autorização para ação real.`, alertas);
    }

    // Regra 4 — qualquer fator que exija revisão humana.
    const fatores = [];
    if (dados === 'interno') fatores.push('dado interno');
    if (dados === 'externo') fatores.push('dado externo');
    if (ambiente === 'homologacao') fatores.push('ambiente de homologação');
    if (autonomia === 'edicao' || autonomia === 'execucao') fatores.push(`autonomia de ${autonomia === 'edicao' ? 'edição' : 'execução'}`);
    if (fatores.length > 0) {
      return resultado(DECISAO.CONDICIONADO, 4, `Regra 4: ${fatores.join(', ')} ${fatores.length > 1 ? 'exigem' : 'exige'} revisão humana.`, alertas);
    }

    // Regra 5 — o que sobra: publico + desenvolvimento + leitura/proposta.
    return resultado(DECISAO.PERMITIDO, 5,
      `Regra 5: dado público, desenvolvimento e apenas ${autonomia} (classificação didática).`, alertas);
  }

  global.GovsafePolitica = Object.freeze({ DECISAO, TAXONOMIA, classificar });
})(globalThis);
