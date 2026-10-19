/* ═══════════════════════════════════════════════════════════════════════════
   gmt-cat.js — شجرة التصنيفات (تصنيفٌ داخل تصنيف) · 19 ت1 · TASK-0110
   ───────────────────────────────────────────────────────────────────────────
   طلب المالك: «أضف تصنيفات داخل التصنيف — يكون عندي تصنيف إضاءة فيه خمس
   مجموعات، وكل مجموعتين في تصنيفٍ داخلي».

   بلا تعديلٍ في القاعدة: العمود products.category يحمل **المسار** كاملاً:
       «إضاءة»              ⇐ تصنيفٌ رئيسي (كما كان — لا شيء قديمٌ ينكسر)
       «إضاءة › ستوديو»     ⇐ تصنيفٌ فرعي داخل «إضاءة»
   فالمنتج في «إضاءة › ستوديو» يظهر عند اختيار «إضاءة» وعند اختيار «ستوديو»،
   والبحث النصّي يجد الاسمين معاً. الفاصل « › » ممنوعٌ داخل الاسم نفسه.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var SEP = ' › ';

  function clean(c) {
    return String(c == null ? '' : c).split('›').map(function (s) { return s.trim().replace(/\s+/g, ' '); })
      .filter(Boolean).join(SEP);
  }
  function parts(c) { var x = clean(c); return x ? x.split(SEP) : []; }
  function join(parent, name) { var p = clean(parent), n = clean(name); return p ? (n ? p + SEP + n : p) : n; }
  function leaf(c) { var a = parts(c); return a.length ? a[a.length - 1] : ''; }
  function parent(c) { var a = parts(c); return a.slice(0, -1).join(SEP); }
  function depth(c) { return parts(c).length; }
  /* هل المسار c داخل path (أو هو نفسه)؟ — «إضاءة» تشمل «إضاءة › ستوديو» لا «إضاءات» */
  function under(c, path) {
    var x = clean(c), p = clean(path);
    if (!p) return true;
    return x === p || x.indexOf(p + SEP) === 0;
  }
  function validName(n) { return !/›/.test(String(n || '')); }

  /* شجرةٌ من المنتجات: كل عقدةٍ {name, path, n (كل ما تحتها), direct (مباشرةً فيها), groups{}, children{}} */
  function tree(products) {
    var root = { name: '', path: '', n: 0, direct: 0, groups: {}, children: {} };
    (products || []).forEach(function (p) {
      var a = parts(p && p.category); if (!a.length) return;
      var node = root, path = '';
      for (var i = 0; i < a.length; i++) {
        path = path ? path + SEP + a[i] : a[i];
        node = node.children[a[i]] || (node.children[a[i]] = { name: a[i], path: path, n: 0, direct: 0, groups: {}, children: {} });
        node.n++;
      }
      node.direct++;
      var g = String((p && p.group_name) || '').trim(); if (g) node.groups[g] = (node.groups[g] || 0) + 1;
    });
    return root;
  }
  function sortedChildren(node) {
    return Object.keys((node && node.children) || {}).sort(function (a, b) { return a.localeCompare(b, 'ar'); })
      .map(function (k) { return node.children[k]; });
  }
  function find(root, path) {
    var node = root, a = parts(path);
    for (var i = 0; i < a.length; i++) { node = node && node.children[a[i]]; if (!node) return null; }
    return node;
  }
  /* كل المسارات (للقوائم المنسدلة) مرتّبةً شجرياً */
  function allPaths(root) {
    var out = [];
    (function walk(n) { sortedChildren(n).forEach(function (c) { out.push(c.path); walk(c); }); })(root);
    return out;
  }
  /* المسار المعروض: «ستوديو» مع مسافةٍ بقدر العمق — للقوائم */
  function indentLabel(path) { var d = depth(path); return (d > 1 ? new Array(d).join('— ') : '') + leaf(path); }

  global.GMTCat = {
    SEP: SEP, clean: clean, parts: parts, join: join, leaf: leaf, parent: parent, depth: depth,
    under: under, validName: validName, tree: tree, children: sortedChildren, find: find,
    allPaths: allPaths, indentLabel: indentLabel
  };
})(window);
