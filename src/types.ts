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
