// Interfacce per la struttura dei blocchi Simulink

export interface SimulinkPort {
  id: string;
  type: 'input' | 'output';
  name?: string;
  dataType?: string;
  dimensions?: number[];
}

export interface SimulinkBlock {
  id: string;
  name: string;
  blockType: string;
  position: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  parameters?: Record<string, any>;
  inputs?: SimulinkPort[];
  outputs?: SimulinkPort[];
  parent?: string; // Per i subsystem
  children?: string[]; // Per i subsystem
}

export interface SimulinkConnection {
  id: string;
  source: {
    blockId: string;
    portId: string;
    portIndex?: number;
  };
  target: {
    blockId: string;
    portId: string;
    portIndex?: number;
  };
  signal?: {
    name?: string;
    dataType?: string;
    dimensions?: number[];
  };
  waypoints?: Array<{ x: number; y: number }>;
}

export interface SimulinkModel {
  name: string;
  version?: string;
  blocks: SimulinkBlock[];
  connections: SimulinkConnection[];
  parameters?: Record<string, any>;
  metadata?: {
    created?: string;
    modified?: string;
    author?: string;
    simulinkVersion?: string;
  };
}

// Tipi di blocchi Simulink comuni
export const BLOCK_TYPES = {
  // Sources
  CONSTANT: 'Constant',
  STEP: 'Step',
  RAMP: 'Ramp',
  SINE_WAVE: 'Sine Wave',
  PULSE_GENERATOR: 'Pulse Generator',
  SIGNAL_GENERATOR: 'Signal Generator',
  FROM_WORKSPACE: 'From Workspace',
  
  // Sinks
  SCOPE: 'Scope',
  TO_WORKSPACE: 'To Workspace',
  DISPLAY: 'Display',
  
  // Math Operations
  SUM: 'Sum',
  PRODUCT: 'Product',
  GAIN: 'Gain',
  ABS: 'Abs',
  SQRT: 'Sqrt',
  TRIGONOMETRIC: 'Trigonometric Function',
  MATH_FUNCTION: 'Math Function',
  
  // Continuous
  INTEGRATOR: 'Integrator',
  DERIVATIVE: 'Derivative',
  TRANSFER_FUNCTION: 'Transfer Fcn',
  STATE_SPACE: 'State-Space',
  PID_CONTROLLER: 'PID Controller',
  
  // Discrete
  UNIT_DELAY: 'Unit Delay',
  ZERO_ORDER_HOLD: 'Zero-Order Hold',
  DISCRETE_INTEGRATOR: 'Discrete-Time Integrator',
  
  // Signal Routing
  MUX: 'Mux',
  DEMUX: 'Demux',
  SWITCH: 'Switch',
  SELECTOR: 'Selector',
  BUS_CREATOR: 'Bus Creator',
  BUS_SELECTOR: 'Bus Selector',
  
  // Logical and Bit Operations
  LOGICAL_OPERATOR: 'Logical Operator',
  RELATIONAL_OPERATOR: 'Relational Operator',
  COMPARE_TO_CONSTANT: 'Compare To Constant',
  
  // Terminators and Utilities
  TERMINATOR: 'Terminator',
  
  // Subsystems
  SUBSYSTEM: 'Subsystem',
  INPORT: 'Inport',
  OUTPORT: 'Outport'
} as const;

export type BlockType = typeof BLOCK_TYPES[keyof typeof BLOCK_TYPES];

// Configurazione per il rendering dei blocchi
export interface BlockRenderConfig {
  width: number;
  height: number;
  color: string;
  shape: 'rectangle' | 'circle' | 'diamond' | 'triangle';
  icon?: string;
  showPorts: boolean;
}

export const BLOCK_RENDER_CONFIGS: Record<string, BlockRenderConfig> = {
  // Blocchi Alstom
  'LibFrom': {
    width: 120,
    height: 60,
    color: '#E8F5E8',
    shape: 'rectangle',
    showPorts: true
  },
  'LibGoto': {
    width: 120,
    height: 60,
    color: '#FFE0B2',
    shape: 'rectangle',
    showPorts: true
  },
  'Variable': {
    width: 120,
    height: 60,
    color: '#F3E5F5',
    shape: 'rectangle',
    showPorts: true
  },
  'Logical Operator': {
    width: 80,
    height: 50,
    color: '#E1F5FE',
    shape: 'rectangle',
    showPorts: true
  },
  'OR': {
    width: 80,
    height: 50,
    color: '#E1F5FE',
    shape: 'rectangle',
    showPorts: true
  },
  'AND': {
    width: 80,
    height: 50,
    color: '#E1F5FE',
    shape: 'rectangle',
    showPorts: true
  },
  'NOT': {
    width: 60,
    height: 40,
    color: '#E1F5FE',
    shape: 'rectangle',
    showPorts: true
  },
  'XOR': {
    width: 80,
    height: 50,
    color: '#E1F5FE',
    shape: 'rectangle',
    showPorts: true
  },
  'Terminatore': {
    width: 60,
    height: 30,
    color: '#FFCDD2',
    shape: 'rectangle',
    showPorts: true
  },
  'Terminator': {
    width: 60,
    height: 30,
    color: '#FFCDD2',
    shape: 'rectangle',
    showPorts: true
  },
  'Costante': {
    width: 80,
    height: 40,
    color: '#FFF9C4',
    shape: 'rectangle',
    showPorts: true
  },
  'Constant': {
    width: 80,
    height: 40,
    color: '#FFF9C4',
    shape: 'rectangle',
    showPorts: true
  },
  
  // Blocchi Simulink standard
  [BLOCK_TYPES.SUM]: {
    width: 40,
    height: 40,
    color: '#E1F5FE',
    shape: 'circle',
    showPorts: true
  },
  [BLOCK_TYPES.GAIN]: {
    width: 60,
    height: 30,
    color: '#F3E5F5',
    shape: 'triangle',
    showPorts: true
  },
  [BLOCK_TYPES.INTEGRATOR]: {
    width: 60,
    height: 40,
    color: '#E8F5E8',
    shape: 'rectangle',
    showPorts: true
  },
  [BLOCK_TYPES.SCOPE]: {
    width: 60,
    height: 40,
    color: '#FFF3E0',
    shape: 'rectangle',
    showPorts: true
  },
  [BLOCK_TYPES.SUBSYSTEM]: {
    width: 80,
    height: 60,
    color: '#F5F5F5',
    shape: 'rectangle',
    showPorts: true
  }
};

// Default configuration per blocchi non specificati
export const DEFAULT_BLOCK_CONFIG: BlockRenderConfig = {
  width: 60,
  height: 30,
  color: '#F0F0F0',
  shape: 'rectangle',
  showPorts: true
};
