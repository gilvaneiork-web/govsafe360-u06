// Marco 4: interface — cadastro, busca, filtro, revisão humana simulada, auditoria local
// e exportações (somente dados FICTÍCIOS).
// Regras: js/politica.js · Cenários: js/cenarios.js · Revisão/auditoria/exportação: js/auditoria.js.
// Este arquivo só cuida da tela.

const { classificar, DECISAO, TAXONOMIA } = globalThis.GovsafePolitica;
const Cenarios = globalThis.GovsafeCenarios;
const Auditoria = globalThis.GovsafeAuditoria;
const DECISOES = [DECISAO.PERMITIDO, DECISAO.CONDICIONADO, DECISAO.NAO_AUTORIZADO];
const CAMPOS_FORM = ['titulo', 'finalidade', 'dados', 'ambiente', 'autonomia', 'justificativa'];
const EVENTOS_VISIVEIS = 20;

// Rótulos legíveis para os códigos da taxonomia.
const ROTULOS = {
  dados: { publico: 'Público', interno: 'Interno', pessoal: 'Pessoal', credencial: 'Credencial', externo: 'Externo' },
  ambiente: { desenvolvimento: 'Desenvolvimento', homologacao: 'Homologação', producao: 'Produção' },
  autonomia: { leitura: 'Leitura', proposta: 'Proposta', edicao: 'Edição', execucao: 'Execução', critica: 'Crítica' },
  tipoEvento: { cadastro: 'Cadastro', revisao: 'Revisão', restauracao: 'Restauração', exportacao: 'Exportação' }
};

const $ = (id) => document.getElementById(id);

// localStorage pode lançar erro (modo privado, bloqueio); nesse caso seguimos sem persistir.
function obterArmazenamento() {
  try { return window.localStorage; } catch { return null; }
}
const armazenamento = obterArmazenamento();

const estado = { cenarios: [], eventos: [], texto: '', decisao: '' };

function mostrarAviso(...textos) {
  const unicos = [...new Set(textos.filter(Boolean))];
  const p = $('aviso-armazenamento');
  p.textContent = unicos.join(' ');
  p.hidden = unicos.length === 0;
}

// ---------- Persistência e auditoria ----------

function registrar(tipo, cenarioId, resumo) {
  estado.eventos = Auditoria.registrarEvento(estado.eventos, { tipo, cenarioId, resumo });
}

function persistir() {
  mostrarAviso(
    Cenarios.salvar(armazenamento, estado.cenarios).aviso,
    Auditoria.salvarAuditoria(armazenamento, estado.eventos).aviso
  );
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

function criarSelo(texto, classe) {
  const selo = document.createElement('span');
  selo.className = `selo ${classe}`;
  selo.textContent = texto;
  return selo;
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
    tdDecisao.append(criarSelo(c.decisao, classeDecisao(c.decisao)));
    const acao = c.revisao ? c.revisao.acao : 'pendente';
    const tdRevisao = document.createElement('td');
    tdRevisao.append(criarSelo(Auditoria.ROTULO_REVISAO[acao], `revisao-${acao}`));
    tr.append(
      criarCelula(c.id), criarCelula(c.titulo), criarCelula(c.finalidade),
      criarCelula(ROTULOS.dados[c.dados]), criarCelula(ROTULOS.ambiente[c.ambiente]),
      criarCelula(ROTULOS.autonomia[c.autonomia]), tdDecisao, tdRevisao, criarCelula(c.motivo)
    );
    corpo.append(tr);
  }
}

function formatarDataHora(isoTexto) {
  return new Date(isoTexto).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

function renderizarAuditoria() {
  const lista = $('lista-auditoria');
  lista.replaceChildren();
  const recentes = estado.eventos.slice(-EVENTOS_VISIVEIS).reverse();
  for (const e of recentes) {
    const li = document.createElement('li');
    const cabecalho = document.createElement('p');
    cabecalho.className = 'evento-cabecalho';
    const tempo = document.createElement('time');
    tempo.dateTime = e.dataHora;
    tempo.textContent = formatarDataHora(e.dataHora);
    cabecalho.append(`${e.id} · ${ROTULOS.tipoEvento[e.tipo]}${e.cenarioId ? ` · ${e.cenarioId}` : ''} · `, tempo);
    const resumo = document.createElement('p');
    resumo.className = 'evento-resumo';
    resumo.textContent = e.resumo;
    li.append(cabecalho, resumo);
    lista.append(li);
  }
  const total = estado.eventos.length;
  $('contagem-auditoria').textContent = total > EVENTOS_VISIVEIS
    ? `${total} evento(s); mostrando os ${EVENTOS_VISIVEIS} mais recentes.`
    : `${total} evento(s).`;
  $('auditoria-vazia').hidden = total > 0;
  lista.hidden = total === 0;
}

function atualizarOpcoesRevisao() {
  const select = $('r-cenario');
  const atual = select.value;
  select.replaceChildren(new Option('Selecione…', ''),
    ...estado.cenarios.map((c) => new Option(`${c.id} — ${c.titulo} (${c.decisao})`, c.id)));
  if (estado.cenarios.some((c) => c.id === atual)) select.value = atual;
  aoMudarCenarioRevisao();
}

// Totais refletem a base inteira; a tabela reflete busca + filtro.
function renderizar() {
  const visiveis = Cenarios.filtrar(estado.cenarios, { texto: estado.texto, decisao: estado.decisao });
  renderizarTotais(estado.cenarios);
  renderizarTabela(visiveis);
  $('contagem').textContent = `Mostrando ${visiveis.length} de ${estado.cenarios.length} cenário(s).`;
  $('vazio').hidden = visiveis.length > 0;
  document.querySelector('#matriz .table-wrap').hidden = visiveis.length === 0;
  atualizarOpcoesRevisao();
  renderizarAuditoria();
}

// ---------- Erros de formulário (genérico) ----------

// mapa: { campo: [elementoEntrada, elementoErro] }. Devolve o primeiro elemento com erro.
function mostrarErros(mapa, erros) {
  let primeiro = null;
  for (const [campo, [entrada, p]] of Object.entries(mapa)) {
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

// ---------- Cadastro ----------

const mapaCadastro = () => Object.fromEntries(CAMPOS_FORM.map((c) => [c, [$(`f-${c}`), $(`erro-${c}`)]]));

function preencherOpcoes(select, valores, rotulos, primeira) {
  select.replaceChildren(new Option(primeira, ''), ...valores.map((v) => new Option(rotulos[v], v)));
}

function lerFormulario() {
  return Object.fromEntries(CAMPOS_FORM.map((campo) => [campo, $(`f-${campo}`).value]));
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

function aoEnviarCadastro(evento) {
  evento.preventDefault();
  const resultado = Cenarios.adicionar(estado.cenarios, lerFormulario());
  const primeiroErro = mostrarErros(mapaCadastro(), resultado.erros);
  if (!resultado.ok) {
    $('mensagem-cadastro').textContent = 'Corrija os campos indicados antes de cadastrar.';
    primeiroErro.focus();
    return;
  }
  estado.cenarios = resultado.cenarios;
  registrar('cadastro', resultado.novo.id, `${resultado.novo.id} cadastrado. Decisão do motor: ${resultado.novo.decisao}.`);
  persistir();
  renderizar();
  $('form-cenario').reset();
  atualizarPrevia();
  $('mensagem-cadastro').textContent =
    `Cenário ${resultado.novo.id} cadastrado. Decisão calculada: ${resultado.novo.decisao}.`;
}

// ---------- Revisão humana simulada ----------

const mapaRevisao = () => ({
  cenarioId: [$('r-cenario'), $('erro-r-cenarioId')],
  acao: [$('r-aprovar'), $('erro-r-acao')],
  justificativa: [$('r-justificativa'), $('erro-r-justificativa')]
});

// Camada de tela: desabilita "Aprovar" para Não autorizado. A lógica (Auditoria.revisar)
// também recusa — desabilitar o botão sozinho não seria um controle.
function aoMudarCenarioRevisao() {
  const cenario = estado.cenarios.find((c) => c.id === $('r-cenario').value);
  const bloqueado = cenario?.decisao === DECISAO.NAO_AUTORIZADO;
  const aprovar = $('r-aprovar');
  aprovar.disabled = bloqueado;
  if (bloqueado) aprovar.checked = false;
  const nota = $('nota-revisao');
  if (!cenario) {
    nota.hidden = true;
    nota.textContent = '';
  } else {
    nota.hidden = false;
    nota.textContent = bloqueado
      ? `${cenario.id} é Não autorizado pelo motor: só pode ser rejeitado.`
      : `Decisão do motor para ${cenario.id}: ${cenario.decisao}. A revisão não altera essa decisão.` +
        (cenario.revisao ? ` Revisão atual: ${Auditoria.ROTULO_REVISAO[cenario.revisao.acao]}.` : '');
  }
}

function aoEnviarRevisao(evento) {
  evento.preventDefault();
  const form = $('form-revisao');
  const dados = {
    cenarioId: $('r-cenario').value,
    acao: form.querySelector('input[name="acao"]:checked')?.value,
    justificativa: $('r-justificativa').value
  };
  const resultado = Auditoria.revisar(estado.cenarios, dados);
  const primeiroErro = mostrarErros(mapaRevisao(), resultado.erros);
  if (!resultado.ok) {
    $('mensagem-revisao').textContent = 'Revisão não registrada. Corrija os campos indicados.';
    (primeiroErro === $('r-aprovar') && $('r-aprovar').disabled ? $('r-rejeitar') : primeiroErro).focus();
    return;
  }
  estado.cenarios = resultado.cenarios;
  registrar('revisao', resultado.cenario.id, resultado.resumo);
  persistir();
  renderizar();
  $('r-justificativa').value = '';
  form.querySelectorAll('input[name="acao"]').forEach((r) => { r.checked = false; });
  $('mensagem-revisao').textContent =
    `Revisão de ${resultado.cenario.id} registrada: ${Auditoria.ROTULO_REVISAO[resultado.cenario.revisao.acao]}. ` +
    `Decisão do motor mantida: ${resultado.cenario.decisao}.`;
}

// ---------- Exportações ----------

function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarCSV() {
  const nome = Auditoria.nomeArquivo('matriz', 'csv');
  registrar('exportacao', null, `Matriz exportada em CSV (${estado.cenarios.length} cenário(s)).`);
  persistir();
  baixar(nome, Auditoria.gerarCSV(estado.cenarios), 'text/csv;charset=utf-8');
  renderizarAuditoria();
}

function exportarJSON() {
  const nome = Auditoria.nomeArquivo('auditoria', 'json');
  // Registrado ANTES de gerar, para o arquivo incluir o próprio evento de exportação.
  registrar('exportacao', null, `Auditoria exportada em JSON (${estado.eventos.length + 1} evento(s)).`);
  persistir();
  baixar(nome, Auditoria.gerarJSON(estado.eventos), 'application/json;charset=utf-8');
  renderizarAuditoria();
}

// ---------- Dados locais ----------

function restaurarExemplos() {
  if (!window.confirm('Substituir todos os cenários deste navegador pelos 8 exemplos?')) return;
  estado.cenarios = Cenarios.exemplosClassificados();
  registrar('restauracao', null, `Cenários de exemplo restaurados (${estado.cenarios.length}).`);
  persistir();
  renderizar();
  $('mensagem-cadastro').textContent = 'Cenários de exemplo restaurados.';
}

function limparDadosLocais() {
  if (!window.confirm('Apagar todos os cenários e a auditoria deste navegador? Ao recarregar, os exemplos voltam.')) return;
  Cenarios.limpar(armazenamento);
  Auditoria.limparAuditoria(armazenamento);
  estado.cenarios = [];
  estado.eventos = [];
  mostrarAviso('Cenários e auditoria locais apagados. Ao recarregar a página, os exemplos serão recriados.');
  renderizar();
}

// ---------- Inicialização ----------

function iniciar() {
  preencherOpcoes($('f-dados'), TAXONOMIA.dados, ROTULOS.dados, 'Selecione…');
  preencherOpcoes($('f-ambiente'), TAXONOMIA.ambiente, ROTULOS.ambiente, 'Selecione…');
  preencherOpcoes($('f-autonomia'), TAXONOMIA.autonomia, ROTULOS.autonomia, 'Selecione…');
  $('filtro-decisao').append(...DECISOES.map((d) => new Option(d, d)));

  const carga = Cenarios.carregar(armazenamento);
  const cargaAuditoria = Auditoria.carregarAuditoria(armazenamento);
  estado.cenarios = carga.cenarios;
  estado.eventos = cargaAuditoria.eventos;
  mostrarAviso(carga.aviso, cargaAuditoria.aviso);
  if (carga.semeado) {
    registrar('restauracao', null, `Carga inicial: ${estado.cenarios.length} cenários de exemplo.`);
    mostrarAviso(carga.aviso, cargaAuditoria.aviso, Auditoria.salvarAuditoria(armazenamento, estado.eventos).aviso);
  }

  const form = $('form-cenario');
  form.addEventListener('submit', aoEnviarCadastro);
  form.addEventListener('change', atualizarPrevia);
  form.addEventListener('reset', () => setTimeout(() => {
    mostrarErros(mapaCadastro(), {});
    atualizarPrevia();
  }));
  $('form-revisao').addEventListener('submit', aoEnviarRevisao);
  $('r-cenario').addEventListener('change', aoMudarCenarioRevisao);
  $('busca').addEventListener('input', (e) => { estado.texto = e.target.value; renderizar(); });
  $('filtro-decisao').addEventListener('change', (e) => { estado.decisao = e.target.value; renderizar(); });
  $('exportar-csv').addEventListener('click', exportarCSV);
  $('exportar-json').addEventListener('click', exportarJSON);
  $('restaurar').addEventListener('click', restaurarExemplos);
  $('limpar').addEventListener('click', limparDadosLocais);

  renderizar();
  console.info(`GOVSAFE360 M4: ${estado.cenarios.length} cenário(s), ${estado.eventos.length} evento(s) de auditoria.`);
}

iniciar();
