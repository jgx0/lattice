/// <reference types="vite/client" />
declare module 'virtual:published-site' {
  const site: import('./types').CompiledSite;
  export default site;
}
declare module '*.css?inline' { const text: string; export default text; }
