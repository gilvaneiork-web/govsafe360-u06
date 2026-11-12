// Marco 1: painel estático com oito cenários FICTÍCIOS.
// Os campos usam os códigos oficiais de docs/REGRAS_GOVERNANCA.md.
// A decisão está fixa nos dados apenas nesta etapa; no Marco 2 ela passa
// a ser calculada por js/politica.js (os resultados devem ser os mesmos).

const DECISOES = ['Permitido', 'Condicionado', 'Não autorizado'];

// Rótulos legíveis para os códigos da taxonomia.
const ROTULOS = {
  dados: { publico: 'Público', interno: 'Interno', pessoal: 'Pessoal', credencial: 'Credencial', externo: 'Externo' },
  ambiente: { desenvolvimento: 'Desenvolvimento', homologacao: 'Homologação', producao: 'Produção' },
  autonomia: { leitura: 'Leitura', proposta: 'Proposta', edicao: 'Edição', execucao: 'Execução', critica: 'Crítica' }
};

const CENARIOS = [
  { id: 'C01', titulo: 'Resumo de norma pública fictícia', finalidade: 'Apoiar estudo interno da equipe',
    dados: 'publico', ambiente: 'desenvolvimento', autonomia: 'leitura', decisao: 'Permitido',
    motivo: 'Regra 5: dado público, desenvolvimento e apenas leitura.' },
  { id: 'C02', titulo: 'Proposta de texto de FAQ', finalidade: 'Sugerir redação para página de ajuda',
    dados: 'publico', ambiente: 'desenvolvimento', autonomia: 'proposta', decisao: 'Permitido',
    motivo: 'Regra 5: dado público, desenvolvimento e apenas proposta.' },
  { id: 'C03', titulo: 'Análise de planilha interna sintética', finalidade: 'Identificar padrões em dados de teste',
    dados: 'interno', ambiente: 'desenvolvimento', autonomia: 'leitura', decisao: 'Condicionado',
    motivo: 'Regra 4: dado interno exige revisão humana.' },
  { id: 'C04', titulo: 'Leitura de página web externa', finalidade: 'Coletar referências para relatório',
    dados: 'externo', ambiente: 'homologacao', autonomia: 'leitura', decisao: 'Condicionado',
    motivo: 'Regra 4: conteúdo externo é dado, não instrução; sem autoridade instrucional.' },
  { id: 'C05', titulo: 'Consulta a painel em produção', finalidade: 'Conferir indicador público',
    dados: 'publico', ambiente: 'producao', autonomia: 'leitura', decisao: 'Condicionado',
    motivo: 'Regra 3: produção em leitura, sem autorização para ação real.' },
  { id: 'C06', titulo: 'Edição de cadastro em produção', finalidade: 'Corrigir campo de registro',
    dados: 'interno', ambiente: 'producao', autonomia: 'edicao', decisao: 'Não autorizado',
    motivo: 'Regra 2: edição em produção não é permitida.' },
  { id: 'C07', titulo: 'Uso de credencial fictícia', finalidade: 'Acessar sistema para automação',
    dados: 'credencial', ambiente: 'desenvolvimento', autonomia: 'execucao', decisao: 'Não autorizado',
    motivo: 'Regra 1: credenciais nunca são solicitadas nem armazenadas.' },
  { id: 'C08', titulo: 'Exclusão em massa de registros', finalidade: 'Limpar base de homologação',
    dados: 'interno', ambiente: 'homologacao', autonomia: 'critica', decisao: 'Não autorizado',
    motivo: 'Regra 1: ação crítica e irreversível não pode ser automatizada.' }
];

// Classe CSS de cada decisão (a cor sempre acompanha o texto, nunca o substitui).
function classeDecisao(decisao) {
  return {
    'Permitido': 'decisao-permitido',
    'Condicionado': 'decisao-condicionado',
    'Não autorizado': 'decisao-nao-autorizado'
  }[decisao];
}

function contarPorDecisao(cenarios) {
  const totais = Object.fromEntries(DECISOES.map((d) => [d, 0]));
  for (const c of cenarios) totais[c.decisao] += 1;
  return totais;
}

function criarCelula(texto) {
  const td = document.createElement('td');
  td.textContent = texto; // textContent evita interpretar dados como HTML
  return td;
}

function renderizarTotais(cenarios) {
  const lista = document.getElementById('totais');
  const totais = contarPorDecisao(cenarios);
  lista.replaceChildren();

  const itens = [['Total de cenários', cenarios.length, 'total-geral'],
    ...DECISOES.map((d) => [d, totais[d], classeDecisao(d)])];

  for (const [rotulo, valor, classe] of itens) {
    const li = document.createElement('li');
    li.className = `card ${classe}`;
    const numero = document.createElement('span');
    numero.className = 'card-numero';
    numero.textContent = String(valor);
    const nome = document.createElement('span');
    nome.className = 'card-rotulo';
    nome.textContent = rotulo;
    li.append(numero, nome);
    lista.append(li);
  }
}

function renderizarTabela(cenarios) {
  const corpo = document.getElementById('linhas');
  corpo.replaceChildren();
  for (const c of cenarios) {
    const tr = document.createElement('tr');
    const tdDecisao = document.createElement('td');
    const selo = document.createElement('span');
    selo.className = `selo ${classeDecisao(c.decisao)}`;
    selo.textContent = c.decisao;
    tdDecisao.append(selo);
    tr.append(
      criarCelula(c.id), criarCelula(c.titulo), criarCelula(c.finalidade),
      criarCelula(ROTULOS.dados[c.dados]), criarCelula(ROTULOS.ambiente[c.ambiente]),
      criarCelula(ROTULOS.autonomia[c.autonomia]), tdDecisao, criarCelula(c.motivo)
    );
    corpo.append(tr);
  }
}

renderizarTotais(CENARIOS);
renderizarTabela(CENARIOS);
console.info(`GOVSAFE360 M1: ${CENARIOS.length} cenários fictícios carregados.`);
