export interface VaultFile {
  path: string;
  content: string;
  kind: "note" | "base" | "asset";
  mime?: string;
  data?: string;
}
export interface Heading {
  level: number;
  text: string;
  id: string;
}
export interface Note {
  path: string;
  title: string;
  slug: string;
  folder: string;
  content: string;
  body: string;
  properties: Record<string, any>;
  headings: Heading[];
  links: string[];
  tags: string[];
  words: number;
}
export interface Vault {
  name: string;
  files: VaultFile[];
}
export interface PublishedNote extends Note {
  url: string;
  html: string;
  previewHtml: string;
  outgoing: string[];
  backlinks: string[];
}
export interface CompiledSite {
  version: 1;
  name: string;
  settings: SiteSettings;
  notes: PublishedNote[];
  themeCss: string;
  bodyClasses: string[];
}
export interface SiteSettings {
  title: string;
  description: string;
  home: string;
  accent: string;
  theme: "light" | "dark" | "system";
  communityTheme: string;
  customCss: string;
  readable: boolean;
  showProperties: boolean;
  showToc: boolean;
  showBacklinks: boolean;
  showGraph: boolean;
  stacked: boolean;
  navigation: string[];
  hiddenPaths: string[];
  navigationFolders?: Record<string, string>;
}
