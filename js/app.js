// Marco 3: interface — cadastro, busca, filtro e persistência local (somente dados FICTÍCIOS).
// Regras de decisão: js/politica.js. Dados, validação e armazenamento: js/cenarios.js.
// Este arquivo só cuida da tela.

const { classificar, DECISAO, TAXONOMIA } = globalThis.GovsafePolitica;
const Cenarios = globalThis.GovsafeCenarios;
const DECISOES = [DECISAO.PERMITIDO, DECISAO.CONDICIONADO, DECISAO.NAO_AUTORIZADO];
const CAMPOS_FORM = ['titulo', 'finalidade', 'dados', 'ambiente', 'autonomia', 'justificativa'];

// Rótulos legíveis para os códigos da taxonomia.
const ROTULOS = {
  dados: { publico: 'Público', interno: 'Interno', pessoal: 'Pessoal', credencial: 'Credencial', externo: 'Externo' },
  ambiente: { desenvolvimento: 'Desenvolvimento', homologacao: 'Homologação', producao: 'Produção' },
  autonomia: { leitura: 'Leitura', proposta: 'Proposta', edicao: 'Edição', execucao: 'Execução', critica: 'Crítica' }
};

const $ = (id) => document.getElementById(id);

// localStorage pode lançar erro (modo privado, bloqueio); nesse caso seguimos sem persistir.
function obterArmazenamento() {
  try { return window.localStorage; } catch { return null; }
}
const armazenamento = obterArmazenamento();

const estado = { cenarios: [], texto: '', decisao: '' };

function mostrarAviso(texto) {
  const p = $('aviso-armazenamento');
  p.textContent = texto || '';
  p.hidden = !texto;
}

// ---------- Renderização ----------

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
  const lista = $('totais');
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
  const corpo = $('linhas');
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

// Totais refletem a base inteira; a tabela reflete busca + filtro.
function renderizar() {
  const visiveis = Cenarios.filtrar(estado.cenarios, { texto: estado.texto, decisao: estado.decisao });
  renderizarTotais(estado.cenarios);
  renderizarTabela(visiveis);
  $('contagem').textContent = `Mostrando ${visiveis.length} de ${estado.cenarios.length} cenário(s).`;
  $('vazio').hidden = visiveis.length > 0;
  document.querySelector('#matriz .table-wrap').hidden = visiveis.length === 0;
}

// ---------- Formulário ----------

function preencherOpcoes(select, valores, rotulos, primeira) {
  const vazio = new Option(primeira, '');
  select.replaceChildren(vazio, ...valores.map((v) => new Option(rotulos[v], v)));
}

function lerFormulario() {
  return Object.fromEntries(CAMPOS_FORM.map((campo) => [campo, $(`f-${campo}`).value]));
}

function mostrarErros(erros) {
  let primeiro = null;
  for (const campo of CAMPOS_FORM) {
    const entrada = $(`f-${campo}`);
    const p = $(`erro-${campo}`);
    const erro = erros[campo];
    p.textContent = erro || '';
    p.hidden = !erro;
    if (erro) {
      entrada.setAttribute('aria-invalid', 'true');
      primeiro ??= entrada;
    } else {
      entrada.removeAttribute('aria-invalid');
    }
  }
  return primeiro;
}

function atualizarPrevia() {
  const { dados, ambiente, autonomia } = lerFormulario();
  const previa = $('previa');
  if (!dados || !ambiente || !autonomia) {
    previa.textContent = 'Prévia da decisão: preencha tipo de dado, ambiente e autonomia.';
    previa.className = 'previa';
    return;
  }
  const r = classificar({ dados, ambiente, autonomia });
  previa.textContent = `Prévia da decisão: ${r.decisao}. ${[r.motivo, ...r.alertas].join(' ')}`;
  previa.className = `previa ${classeDecisao(r.decisao)}`;
}

function aoEnviar(evento) {
  evento.preventDefault();
  const resultado = Cenarios.adicionar(estado.cenarios, lerFormulario());
  const primeiroErro = mostrarErros(resultado.erros);
  if (!resultado.ok) {
    $('mensagem-cadastro').textContent = 'Corrija os campos indicados antes de cadastrar.';
    primeiroErro.focus();
    return;
  }
  estado.cenarios = resultado.cenarios;
  const gravacao = Cenarios.salvar(armazenamento, estado.cenarios);
  mostrarAviso(gravacao.aviso);
  renderizar();
  $('form-cenario').reset();
  atualizarPrevia();
  $('mensagem-cadastro').textContent =
    `Cenário ${resultado.novo.id} cadastrado. Decisão calculada: ${resultado.novo.decisao}.`;
}

// ---------- Dados locais ----------

function restaurarExemplos() {
  if (!window.confirm('Substituir todos os cenários deste navegador pelos 8 exemplos?')) return;
  estado.cenarios = Cenarios.exemplosClassificados();
  mostrarAviso(Cenarios.salvar(armazenamento, estado.cenarios).aviso);
  renderizar();
  $('mensagem-cadastro').textContent = 'Cenários de exemplo restaurados.';
}

function limparDadosLocais() {
  if (!window.confirm('Apagar todos os cenários salvos neste navegador? Ao recarregar, os exemplos voltam.')) return;
  Cenarios.limpar(armazenamento);
  estado.cenarios = [];
  mostrarAviso('Dados locais apagados. Ao recarregar a página, os exemplos serão recriados.');
  renderizar();
}

// ---------- Inicialização ----------

function iniciar() {
  preencherOpcoes($('f-dados'), TAXONOMIA.dados, ROTULOS.dados, 'Selecione…');
  preencherOpcoes($('f-ambiente'), TAXONOMIA.ambiente, ROTULOS.ambiente, 'Selecione…');
  preencherOpcoes($('f-autonomia'), TAXONOMIA.autonomia, ROTULOS.autonomia, 'Selecione…');
  $('filtro-decisao').append(...DECISOES.map((d) => new Option(d, d)));

  const carga = Cenarios.carregar(armazenamento);
  estado.cenarios = carga.cenarios;
  mostrarAviso(carga.aviso);

  const form = $('form-cenario');
  form.addEventListener('submit', aoEnviar);
  form.addEventListener('change', atualizarPrevia);
  form.addEventListener('reset', () => setTimeout(() => {
    mostrarErros({});
    atualizarPrevia();
  }));
  $('busca').addEventListener('input', (e) => { estado.texto = e.target.value; renderizar(); });
  $('filtro-decisao').addEventListener('change', (e) => { estado.decisao = e.target.value; renderizar(); });
  $('restaurar').addEventListener('click', restaurarExemplos);
  $('limpar').addEventListener('click', limparDadosLocais);

  renderizar();
  console.info(`GOVSAFE360 M3: ${estado.cenarios.length} cenário(s) carregado(s).`);
}

iniciar();
