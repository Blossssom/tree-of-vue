export interface ComponentNode {
  id: string;
  label: string;
  filePath: string;
  props: PropInfo[];
  emits: string[];
}

export interface ComponentEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: ComponentNode[];
  edges: ComponentEdge[];
}

export interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  default?: string;
}
