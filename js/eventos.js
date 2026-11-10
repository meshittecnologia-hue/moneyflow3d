/* MoneyFlow 3D — Eventos sem código no HTML (item 25).
   Antes: o atributo onclick com código escrito no HTML. Isso impede ligar a CSP (política que
   só deixa rodar código dos nossos arquivos).
   Agora: o atributo data-click guarda só o nome da função e os argumentos, e este arquivo chama a função. NÃO usa eval: só aceita
   "nomeDaFuncao(argumentos)" onde a função existe e os argumentos são valores simples:
     'texto', "texto", 123, -1.5, true, false, null, this, this.value, this.checked, event
   Também aceita event.stopPropagation() e event.preventDefault() como chamadas.
   Eventos aceitos: data-click, data-change, data-input, data-keydown, data-enter (Enter),
   data-drop, data-dragover, data-dragleave, data-mouseover, data-mouseout.
   Pode ter mais de uma chamada separada por ";" (ex.: "a();b('x')"). */
(function () {
  var EVENTOS = {
    click: 'click', change: 'change', input: 'input', keydown: 'keydown', enter: 'keydown',
    drop: 'drop', dragover: 'dragover', dragleave: 'dragleave', mouseover: 'mouseover', mouseout: 'mouseout',
  };

  // Separa "a(1,'x');b()" em chamadas, respeitando aspas.
  function partes(texto, separador) {
    var out = [], atual = '', aspas = null, nivel = 0;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (aspas) { atual += c; if (c === '\\') { atual += texto[++i] || ''; } else if (c === aspas) aspas = null; continue; }
      if (c === "'" || c === '"') { aspas = c; atual += c; continue; }
      if (c === '(') nivel++;
      if (c === ')') nivel--;
      if (c === separador && nivel === 0) { out.push(atual); atual = ''; continue; }
      atual += c;
    }
    if (atual.trim()) out.push(atual);
    return out.map(function (p) { return p.trim(); }).filter(Boolean);
  }

  function valor(txt, el, ev) {
    txt = txt.trim();
    if (txt === 'this') return el;
    if (txt === 'this.value') return el.value;
    if (txt === 'this.checked') return el.checked;
    if (txt === 'event') return ev;
    if (txt === 'true') return true;
    if (txt === 'false') return false;
    if (txt === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(txt)) return Number(txt);
    var q = txt[0];
    if ((q === "'" || q === '"') && txt[txt.length - 1] === q) {
      return txt.slice(1, -1).replace(/\\(.)/g, '$1');
    }
    throw new Error('argumento não permitido: ' + txt);
  }

  function executar(texto, el, ev) {
    partes(texto, ';').forEach(function (chamada) {
      if (chamada === 'event.stopPropagation()') { ev.stopPropagation(); return; }
      if (chamada === 'event.preventDefault()') { ev.preventDefault(); return; }
      var m = /^([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)$/.exec(chamada);
      if (!m) throw new Error('ação inválida: ' + chamada);
      var fn = window[m[1]];
      if (typeof fn !== 'function') throw new Error('função não encontrada: ' + m[1]);
      var args = partes(m[2], ',').map(function (a) { return valor(a, el, ev); });
      fn.apply(el, args);
    });
  }

  Object.keys(EVENTOS).forEach(function (nome) {
    var tipo = EVENTOS[nome], attr = 'data-' + nome;
    document.addEventListener(tipo, function (ev) {
      if (nome === 'enter' && ev.key !== 'Enter') return;
      // Igual ao onclick antigo: roda do elemento clicado para fora (bolha), em todos que
      // tiverem o atributo, e para se alguma ação chamar event.stopPropagation().
      var el = ev.target && ev.target.nodeType === 1 ? ev.target : ev.target && ev.target.parentElement;
      for (; el && el !== document; el = el.parentElement) {
        if (!el.hasAttribute || !el.hasAttribute(attr)) continue;
        if (nome === 'dragover' || nome === 'drop') ev.preventDefault();
        try { executar(el.getAttribute(attr), el, ev); }
        catch (e) { console.error('[eventos]', attr + '="' + el.getAttribute(attr) + '"', e); if (window.Sentry) Sentry.captureException(e); }
        if (ev.cancelBubble) break;
      }
    });
  });

  // ---- Ajudantes para ações que antes eram código solto no HTML ----
  window.clicarEm = function (id) { var el = document.getElementById(id); if (el) el.click(); };
  window.copiarValor = function (id, valor) { var el = document.getElementById(id); if (el) el.value = valor; };
  window.removerMaisProximo = function (el, seletor) { var alvo = el.closest(seletor); if (alvo) alvo.remove(); };
  window.destacarBorda = function (el, cor) { el.style.borderColor = cor; };
  window.destacarPerigo = function (el, ligado) {
    el.style.borderColor = ligado ? 'var(--red)' : 'var(--border)';
    el.style.color = ligado ? 'var(--red)' : 'var(--text2)';
  };
  window.alternarClasseBody = function (classe) { document.body.classList.toggle(classe); };
  window.removerClasseBody = function (classe) { document.body.classList.remove(classe); };

  window.__eventosProntos = true;
})();
