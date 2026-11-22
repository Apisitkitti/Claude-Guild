/**
 * Enforces a consistent statement order inside React function components and custom hooks:
 *   1. state      useState / useReducer / useRef / useContext / other custom hooks
 *   2. variables  other const/let (including useMemo)
 *   3. functions  function declarations, arrow/function expressions, useCallback
 *   4. effects    useEffect / useLayoutEffect / useInsertionEffect
 *   5. early returns   if (...) return ...
 *   6. main return
 */

const STATE = 1;
const VARIABLE = 2;
const FUNCTION = 3;
const EFFECT = 4;
const EARLY_RETURN = 5;
const RETURN = 6;

const STAGE_LABEL = {
  [STATE]: "state hooks",
  [VARIABLE]: "variables",
  [FUNCTION]: "functions",
  [EFFECT]: "effects",
  [EARLY_RETURN]: "early returns",
  [RETURN]: "the main return",
};

const EFFECT_HOOKS = new Set(["useEffect", "useLayoutEffect", "useInsertionEffect", "useImperativeHandle"]);
const FUNCTION_HOOKS = new Set(["useCallback"]);
const VARIABLE_HOOKS = new Set(["useMemo"]);

const isHookName = (name) => typeof name === "string" && /^use[A-Z0-9]/.test(name);
const isComponentName = (name) => typeof name === "string" && /^[A-Z]/.test(name);

function calleeName(call) {
  const c = call.callee;
  if (c.type === "Identifier") return c.name;
  if (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier") return c.property.name;
  return null;
}

function unwrapInit(init) {
  let node = init;
  while (
    node &&
    (node.type === "TSAsExpression" || node.type === "TSNonNullExpression" || node.type === "AwaitExpression")
  ) {
    node = node.expression ?? node.argument;
  }
  return node;
}

function classifyInit(init) {
  const node = unwrapInit(init);
  if (!node) return VARIABLE;
  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") return FUNCTION;
  if (node.type === "CallExpression") {
    const name = calleeName(node);
    if (FUNCTION_HOOKS.has(name)) return FUNCTION;
    if (VARIABLE_HOOKS.has(name)) return VARIABLE;
    if (EFFECT_HOOKS.has(name)) return EFFECT;
    if (isHookName(name)) return STATE;
  }
  return VARIABLE;
}

function containsReturn(node) {
  if (!node) return false;
  if (node.type === "ReturnStatement") return true;
  if (node.type === "BlockStatement") return node.body.some(containsReturn);
  if (node.type === "IfStatement") return containsReturn(node.consequent) || containsReturn(node.alternate);
  return false;
}

/** @returns {{ stage: number, label: string } | null} null means "not classified, ignore". */
function classifyStatement(stmt) {
  switch (stmt.type) {
    case "FunctionDeclaration":
      return { stage: FUNCTION, label: `function ${stmt.id ? stmt.id.name : "declaration"}` };
    case "VariableDeclaration": {
      let best = null;
      for (const d of stmt.declarations) {
        const stage = classifyInit(d.init);
        if (!best || stage > best.stage) {
          const id = d.id.type === "Identifier" ? d.id.name : "declaration";
          const call = d.init && unwrapInit(d.init);
          const hook = call && call.type === "CallExpression" ? calleeName(call) : null;
          best = { stage, label: hook && stage !== VARIABLE ? hook : id };
        }
      }
      return best;
    }
    case "ExpressionStatement": {
      const e = stmt.expression;
      if (e.type === "CallExpression") {
        const name = calleeName(e);
        if (EFFECT_HOOKS.has(name)) return { stage: EFFECT, label: name };
        if (isHookName(name) && !FUNCTION_HOOKS.has(name) && !VARIABLE_HOOKS.has(name))
          return { stage: STATE, label: name };
      }
      return null;
    }
    case "IfStatement":
      return containsReturn(stmt) ? { stage: EARLY_RETURN, label: "early return" } : null;
    case "ReturnStatement":
      return { stage: RETURN, label: "return" };
    default:
      return null;
  }
}

function returnsJsx(fn) {
  let found = false;
  const visit = (node) => {
    if (!node || found || typeof node.type !== "string") return;
    if (node.type === "ReturnStatement") {
      const a = node.argument;
      if (a && /^JSX/.test(unwrapJsxHost(a).type)) found = true;
      return;
    }
    if (node.type === "BlockStatement") node.body.forEach(visit);
    else if (node.type === "IfStatement") {
      visit(node.consequent);
      visit(node.alternate);
    }
  };
  visit(fn.body);
  return found;
}

function unwrapJsxHost(node) {
  // `return cond ? <A/> : <B/>` and `return (<A/>)` still count; look one level into conditionals/logical.
  if (node.type === "ConditionalExpression") {
    return /^JSX/.test(node.consequent.type) ? node.consequent : node.alternate;
  }
  if (node.type === "LogicalExpression") return node.right;
  return node;
}

function functionName(node) {
  if (node.type === "FunctionDeclaration") return node.id ? node.id.name : null;
  let parent = node.parent;
  // memo(() => ...) / forwardRef(function ...)
  if (parent && parent.type === "CallExpression") {
    const n = calleeName(parent);
    if (n === "memo" || n === "forwardRef") parent = parent.parent;
  }
  if (parent && parent.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce state → variables → functions → effects → early returns → return order in components and hooks",
    },
    schema: [],
    messages: {
      order:
        "{{current}} ({{currentStage}}) must come before {{previous}} ({{previousStage}}). Order inside components/hooks: state → variables → functions → effects → early returns → return.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const isTsx = /\.(tsx|jsx)$/.test(filename);

    function check(node) {
      if (!node.body || node.body.type !== "BlockStatement") return;
      const name = functionName(node);
      if (!name) return;
      const isHook = isHookName(name);
      const isComponent = isTsx && isComponentName(name) && returnsJsx(node);
      if (!isHook && !isComponent) return;

      let highest = null;
      for (const stmt of node.body.body) {
        const c = classifyStatement(stmt);
        if (!c) continue;
        if (highest && c.stage < highest.stage) {
          context.report({
            node: stmt,
            messageId: "order",
            data: {
              current: c.label,
              currentStage: STAGE_LABEL[c.stage],
              previous: highest.label,
              previousStage: STAGE_LABEL[highest.stage],
            },
          });
        } else if (!highest || c.stage > highest.stage) {
          highest = c;
        }
      }
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
};

const plugin = { rules: { "component-order": rule } };

export default plugin;
