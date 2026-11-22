import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { afterAll, describe, it } from "vitest";

import plugin from "../../eslint-rules/component-order.mjs";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
// RuleTester.afterAll is only used by newer ESLint builds; keep vitest happy when present.
(RuleTester as unknown as { afterAll: unknown }).afterAll = afterAll;

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const rule = plugin.rules["component-order"];
const tsx = "Comp.tsx";
const ts = "useThing.ts";

tester.run("component-order", rule, {
  valid: [
    {
      filename: tsx,
      code: `
function Comp() {
  const [a, setA] = useState(0);
  const ref = useRef(null);
  const ctx = useContext(C);
  const custom = useCustom(a);
  const doubled = useMemo(() => a * 2, [a]);
  const label = "x" + doubled;
  const onClick = () => setA(1);
  function helper() {}
  const cb = useCallback(() => {}, []);
  useEffect(() => {}, []);
  useLayoutEffect(() => {}, []);
  if (!a) return null;
  return <div onClick={onClick}>{label}</div>;
}`,
    },
    {
      filename: tsx,
      name: "arrow component",
      code: `const Comp = () => { const [a] = useState(0); const f = () => a; useEffect(() => {}); return <i onClick={f} />; };`,
    },
    {
      filename: ts,
      name: "custom hook",
      code: `export function useThing() { const [a] = useState(0); const f = () => a; useEffect(() => {}, []); return { a, f }; }`,
    },
    {
      filename: ts,
      name: "non-hook lowercase function is ignored",
      code: `function plain() { useEffect(() => {}); const x = 1; return x; }`,
    },
    {
      filename: tsx,
      name: "PascalCase function that does not return JSX is ignored",
      code: `function Factory() { useEffect(() => {}); const x = 1; return x; }`,
    },
    {
      filename: tsx,
      name: "nested handler bodies are not checked",
      code: `function Comp() { const [a] = useState(0); const f = () => { const x = 1; useThing(); return x; }; return <i onClick={f} />; }`,
    },
  ],
  invalid: [
    {
      filename: tsx,
      name: "effect before function",
      code: `function Comp() { useEffect(() => {}, []); const f = () => 1; return <i onClick={f} />; }`,
      errors: [
        {
          messageId: "order",
          data: { current: "f", currentStage: "functions", previous: "useEffect", previousStage: "effects" },
        },
      ],
    },
    {
      filename: tsx,
      name: "state after variable",
      code: `function Comp() { const x = compute(); const [a] = useState(0); return <i>{x}{a}</i>; }`,
      errors: [{ messageId: "order" }],
    },
    {
      filename: tsx,
      name: "variable after early return",
      code: `function Comp({ p }) { if (!p) return null; const x = p.x; return <i>{x}</i>; }`,
      errors: [{ messageId: "order" }],
    },
    {
      filename: tsx,
      name: "useCallback after effect",
      code: `function Comp() { useEffect(() => {}); const cb = useCallback(() => {}, []); return <i onClick={cb} />; }`,
      errors: [{ messageId: "order" }],
    },
    {
      filename: ts,
      name: "custom hook: useMemo variable before state hook",
      code: `export function useThing(p) { const v = useMemo(() => p, [p]); const [a] = useState(0); return [v, a]; }`,
      errors: [{ messageId: "order" }],
    },
    {
      filename: ts,
      name: "custom hook: return before effect",
      code: `export function useThing() { const [a] = useState(0); if (!a) return 0; useEffect(() => {}); return a; }`,
      errors: [{ messageId: "order" }],
    },
    {
      filename: tsx,
      name: "memo-wrapped component",
      code: `const Comp = memo(() => { useEffect(() => {}); const [a] = useState(0); return <i>{a}</i>; });`,
      errors: [{ messageId: "order" }],
    },
  ],
});
