// Testes do motor de decisão (Marco 2). Executar: npm run test:policy
// Usa apenas módulos nativos do Node (node:test, node:assert) — nada a instalar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/politica.js';

const { classificar, DECISAO, TAXONOMIA } = globalThis.GovsafePolitica;
const { PERMITIDO, CONDICIONADO, NAO_AUTORIZADO } = DECISAO;

test('dados públicos: só desenvolvimento + leitura/proposta é Permitido', () => {
  assert.equal(classificar({ dados: 'publico', ambiente: 'desenvolvimento', autonomia: 'leitura' }).decisao, PERMITIDO);
  assert.equal(classificar({ dados: 'publico', ambiente: 'desenvolvimento', autonomia: 'proposta' }).decisao, PERMITIDO);
  assert.equal(classificar({ dados: 'publico', ambiente: 'desenvolvimento', autonomia: 'edicao' }).decisao, CONDICIONADO);
  assert.equal(classificar({ dados: 'publico', ambiente: 'homologacao', autonomia: 'leitura' }).decisao, CONDICIONADO);
  assert.equal(classificar({ dados: 'publico', ambiente: 'desenvolvimento', autonomia: 'critica' }).decisao, NAO_AUTORIZADO);
});

test('credenciais e dados pessoais: sempre Não autorizado (CA02)', () => {
  for (const ambiente of TAXONOMIA.ambiente) {
    for (const autonomia of TAXONOMIA.autonomia) {
      for (const dados of ['credencial', 'pessoal']) {
        const r = classificar({ dados, ambiente, autonomia });
        assert.equal(r.decisao, NAO_AUTORIZADO, `${dados}/${ambiente}/${autonomia}`);
        assert.equal(r.regra, 1);
      }
    }
  }
});

test('aprovacao_humana NÃO altera a classificação (CA07)', () => {
  const base = { dados: 'credencial', ambiente: 'desenvolvimento', autonomia: 'leitura' };
  assert.deepEqual(classificar({ ...base, aprovacao_humana: true }), classificar(base));
  assert.equal(classificar({ ...base, aprovacao_humana: true }).decisao, NAO_AUTORIZADO);
});

test('produção: leitura/proposta Condicionado; edição/execução/crítica Não autorizado (CA03, CA04)', () => {
  const esperado = { leitura: CONDICIONADO, proposta: CONDICIONADO, edicao: NAO_AUTORIZADO, execucao: NAO_AUTORIZADO, critica: NAO_AUTORIZADO };
  for (const [autonomia, decisao] of Object.entries(esperado)) {
    assert.equal(classificar({ dados: 'publico', ambiente: 'producao', autonomia }).decisao, decisao, autonomia);
  }
  // Nenhuma combinação em produção resulta em Permitido.
  for (const dados of TAXONOMIA.dados) {
    for (const autonomia of TAXONOMIA.autonomia) {
      assert.notEqual(classificar({ dados, ambiente: 'producao', autonomia }).decisao, PERMITIDO);
    }
  }
});

test('conteúdo externo: Condicionado e alerta de ausência de autoridade instrucional (CA05)', () => {
  const r = classificar({ dados: 'externo', ambiente: 'desenvolvimento', autonomia: 'leitura' });
  assert.equal(r.decisao, CONDICIONADO);
  assert.equal(r.regra, 4);
  assert.match(r.alertas[0], /não instrução/);
  // O alerta acompanha o dado externo mesmo quando a regra é mais estrita.
  const r2 = classificar({ dados: 'externo', ambiente: 'producao', autonomia: 'execucao' });
  assert.equal(r2.decisao, NAO_AUTORIZADO);
  assert.equal(r2.alertas.length, 1);
});

test('entrada inválida ou ausente: Não autorizado (conservador)', () => {
  assert.equal(classificar({ dados: 'secreto', ambiente: 'desenvolvimento', autonomia: 'leitura' }).decisao, NAO_AUTORIZADO);
  assert.equal(classificar({}).regra, 0);
  assert.equal(classificar(undefined).decisao, NAO_AUTORIZADO);
  assert.equal(classificar({ dados: 'PUBLICO', ambiente: 'desenvolvimento', autonomia: 'leitura' }).decisao, NAO_AUTORIZADO);
});

test('cobertura total: toda combinação válida tem decisão, regra e motivo', () => {
  let n = 0;
  for (const dados of TAXONOMIA.dados) for (const ambiente of TAXONOMIA.ambiente) for (const autonomia of TAXONOMIA.autonomia) {
    const r = classificar({ dados, ambiente, autonomia });
    assert.ok(Object.values(DECISAO).includes(r.decisao));
    assert.ok(r.regra >= 1 && r.regra <= 5);
    assert.ok(r.motivo.startsWith(`Regra ${r.regra}:`));
    n += 1;
  }
  assert.equal(n, 75);
});

test('pureza: não altera a entrada, repete o resultado e devolve objeto congelado', () => {
  const entrada = { dados: 'interno', ambiente: 'homologacao', autonomia: 'proposta' };
  const copia = structuredClone(entrada);
  const a = classificar(entrada);
  const b = classificar(entrada);
  assert.deepEqual(entrada, copia);
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.alertas));
});

test('paridade com o M1: os 8 cenários mantêm as mesmas decisões', () => {
  const casos = [
    ['C01', 'publico', 'desenvolvimento', 'leitura', PERMITIDO, 5],
    ['C02', 'publico', 'desenvolvimento', 'proposta', PERMITIDO, 5],
    ['C03', 'interno', 'desenvolvimento', 'leitura', CONDICIONADO, 4],
    ['C04', 'externo', 'homologacao', 'leitura', CONDICIONADO, 4],
    ['C05', 'publico', 'producao', 'leitura', CONDICIONADO, 3],
    ['C06', 'interno', 'producao', 'edicao', NAO_AUTORIZADO, 2],
    ['C07', 'credencial', 'desenvolvimento', 'execucao', NAO_AUTORIZADO, 1],
    ['C08', 'interno', 'homologacao', 'critica', NAO_AUTORIZADO, 1]
  ];
  for (const [id, dados, ambiente, autonomia, decisao, regra] of casos) {
    const r = classificar({ dados, ambiente, autonomia });
    assert.equal(r.decisao, decisao, id);
    assert.equal(r.regra, regra, id);
  }
});
