/* @ds-bundle: {"format":4,"namespace":"Filon","components":[{"name":"Button"},{"name":"ScoreDial"},{"name":"SignalChip"},{"name":"ProcedureTag"},{"name":"Radar"}]} */
(function () {
  var h = window.React.createElement;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(" ");
  }

  /* Button — action principale en or, secondaire en filet. */
  function Button(props) {
    var variant = props.variant || "primary";
    return h("button", {
      type: props.type || "button",
      className: cx("fl-btn", "fl-btn--" + variant, props.className),
      onClick: props.onClick,
      disabled: props.disabled
    }, props.children);
  }

  /* ScoreDial — le Score Pépite (0-100) dans un anneau. L'arc est or à partir de 60. */
  function ScoreDial(props) {
    var v = Math.max(0, Math.min(100, Math.round(props.value || 0)));
    var size = props.size || 96;
    var r = 42, c = 2 * Math.PI * r;
    var hot = v >= (props.threshold == null ? 60 : props.threshold);
    var ticks = [];
    for (var i = 0; i < 40; i++) {
      var a = (i / 40) * 2 * Math.PI - Math.PI / 2;
      var r1 = 47, r2 = i % 10 === 0 ? 50 : 48.5;
      ticks.push(h("line", {
        key: i, className: "fl-dial__tick",
        x1: 50 + r1 * Math.cos(a), y1: 50 + r1 * Math.sin(a),
        x2: 50 + r2 * Math.cos(a), y2: 50 + r2 * Math.sin(a)
      }));
    }
    return h("div", { className: cx("fl-dial", hot && "is-hot", props.className), style: { width: size, height: size }, role: "img", "aria-label": "Score Pépite " + v + " sur 100" },
      h("svg", { viewBox: "0 0 100 100", width: size, height: size, "aria-hidden": "true" },
        ticks,
        h("circle", { className: "fl-dial__track", cx: 50, cy: 50, r: r }),
        h("circle", { className: "fl-dial__arc", cx: 50, cy: 50, r: r,
          strokeDasharray: c, strokeDashoffset: c * (1 - v / 100), transform: "rotate(-90 50 50)" })
      ),
      h("span", { className: "fl-dial__value", style: { fontSize: Math.round(size * 0.34) } }, v),
      props.label ? h("span", { className: "fl-dial__label" }, props.label) : null
    );
  }

  /* SignalChip — un signal détecté, catégorie par la couleur ET par le mot. */
  var KIND_LABEL = { cession: "Cession", decote: "Décote", valeur: "Valeur" };
  function SignalChip(props) {
    var kind = props.kind || "valeur";
    return h("span", { className: cx("fl-chip", "fl-chip--" + kind, props.className), title: KIND_LABEL[kind] },
      h("i", { className: "fl-chip__dot", "aria-hidden": "true" }),
      props.children
    );
  }

  /* ProcedureTag — situation juridique de la cible. */
  var PROC = {
    liquidation: "Liquidation", redressement: "Redressement", sauvegarde: "Sauvegarde",
    plan_cession: "Plan de cession", vente: "Cession publiée", cedant: "Cédant potentiel", veille: "Veille"
  };
  function ProcedureTag(props) {
    var t = PROC[props.type] ? props.type : "veille";
    return h("span", { className: cx("fl-tag", "fl-tag--" + t, props.className) }, props.children || PROC[t]);
  }

  /* Radar — la signature Filon. Anneaux, réticule, balayage unique à l'ouverture,
     une pépite par cible (x, y entre 0 et 1 ; score 0-100). Or à partir de 70. */
  function Radar(props) {
    var size = props.size || 320;
    var pts = props.points || [];
    var hotAt = props.hotThreshold == null ? 70 : props.hotThreshold;
    var rings = [0.25, 0.5, 0.75, 1].map(function (k, i) {
      return h("circle", { key: "r" + i, className: "fl-radar__ring", cx: 50, cy: 50, r: 48 * k });
    });
    var dots = pts.map(function (p, i) {
      var x = 2 + p.x * 96, y = 2 + p.y * 96;
      var hot = p.score >= hotAt;
      var delay = (Math.atan2(y - 50, x - 50) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI);
      return h("circle", {
        key: "p" + i, className: cx("fl-radar__dot", hot && "is-hot", props.selected === i && "is-selected"),
        cx: x, cy: y, r: hot ? 1.6 : 1,
        style: { animationDelay: (delay * 1.4).toFixed(2) + "s" },
        onClick: props.onSelect ? function () { props.onSelect(i, p); } : undefined
      }, p.label ? h("title", null, p.label + " · " + p.score) : null);
    });
    return h("div", { className: cx("fl-radar", props.className), style: { width: size, height: size } },
      h("svg", { viewBox: "0 0 100 100", width: size, height: size, role: "img", "aria-label": props.ariaLabel || (pts.length + " cibles sur le radar") },
        rings,
        h("line", { className: "fl-radar__axis", x1: 50, y1: 2, x2: 50, y2: 98 }),
        h("line", { className: "fl-radar__axis", x1: 2, y1: 50, x2: 98, y2: 50 }),
        h("g", { className: "fl-radar__sweep" },
          h("path", { className: "fl-radar__beam", d: "M50 50 L50 2 A48 48 0 0 1 83.9 16.1 Z" }),
          h("line", { className: "fl-radar__edge", x1: 50, y1: 50, x2: 50, y2: 2 })
        ),
        dots,
        h("circle", { className: "fl-radar__core", cx: 50, cy: 50, r: 1.2 })
      )
    );
  }

  window.Filon = { Button: Button, ScoreDial: ScoreDial, SignalChip: SignalChip, ProcedureTag: ProcedureTag, Radar: Radar };
})();
