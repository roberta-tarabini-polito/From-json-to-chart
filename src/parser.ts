import { SimulinkModel, SimulinkBlock, SimulinkConnection, SimulinkPort } from './types.js';

export class SimulinkJSONParser {
  
  /**
   * Parsa un JSON che può avere diversi formati:
   * - Formato MDL convertito
   * - Formato Simulink Coder
   * - Formato custom
   */
  static parseJSON(jsonData: any): SimulinkModel {
    // Prova diversi formati di parsing
    if (jsonData.metadata && jsonData.blockCategories) {
      // Formato Alstom MDL Debug Tool
      return this.parseAlstomFormat(jsonData);
    } else if (jsonData.model || jsonData.Model) {
      return this.parseStandardFormat(jsonData);
    } else if (jsonData.blocks || jsonData.Blocks) {
      return this.parseBlocksFormat(jsonData);
    } else if (Array.isArray(jsonData)) {
      return this.parseArrayFormat(jsonData);
    } else if (jsonData.systems || jsonData.Systems) {
      return this.parseSystemsFormat(jsonData);
    } else {
      // Fallback: cerca di inferire la struttura
      return this.parseGenericFormat(jsonData);
    }
  }

  private static parseStandardFormat(data: any): SimulinkModel {
    const modelData = data.model || data.Model;
    
    return {
      name: modelData.name || 'Simulink Model',
      version: modelData.version,
      blocks: this.extractBlocks(modelData.blocks || modelData.Blocks || []),
      connections: this.extractConnections(modelData.connections || modelData.lines || modelData.Lines || []),
      parameters: modelData.parameters || modelData.Parameters,
      metadata: {
        created: modelData.created,
        modified: modelData.modified,
        simulinkVersion: modelData.simulinkVersion
      }
    };
  }

  private static parseBlocksFormat(data: any): SimulinkModel {
    const blocks = data.blocks || data.Blocks;
    const connections = data.connections || data.lines || data.Lines || [];
    
    return {
      name: data.name || 'Simulink Model',
      blocks: this.extractBlocks(blocks),
      connections: this.extractConnections(connections),
      parameters: data.parameters || data.Parameters
    };
  }

  private static parseArrayFormat(data: any[]): SimulinkModel {
    // Assumi che l'array contenga solo blocchi
    return {
      name: 'Simulink Model',
      blocks: this.extractBlocks(data),
      connections: [] // Le connessioni dovranno essere inferite
    };
  }

  private static parseSystemsFormat(data: any): SimulinkModel {
    const systems = data.systems || data.Systems;
    const mainSystem = Array.isArray(systems) ? systems[0] : systems;
    
    return {
      name: mainSystem.name || 'Simulink Model',
      blocks: this.extractBlocks(mainSystem.blocks || mainSystem.Blocks || []),
      connections: this.extractConnections(mainSystem.connections || mainSystem.lines || [])
    };
  }

  private static parseGenericFormat(data: any): SimulinkModel {
    // Cerca blocchi e connessioni in qualsiasi parte dell'oggetto
    const blocks = this.findBlocksInObject(data);
    const connections = this.findConnectionsInObject(data);
    
    return {
      name: data.name || data.modelName || 'Simulink Model',
      blocks: this.extractBlocks(blocks),
      connections: this.extractConnections(connections)
    };
  }

  private static parseAlstomFormat(data: any): SimulinkModel {
    const metadata = data.metadata;
    const blockCategories = data.blockCategories;
    
    const allBlocks: SimulinkBlock[] = [];
    const allConnections: SimulinkConnection[] = [];
    
    // Estrai blocchi variabili (LibFrom e LibGoto)
    if (blockCategories.Variable && blockCategories.Variable.blocks) {
      const variableBlocks = this.extractAlstomVariables(blockCategories.Variable.blocks);
      allBlocks.push(...variableBlocks.blocks);
      allConnections.push(...variableBlocks.connections);
    }
    
    // Estrai operatori logici
    if (blockCategories['Logic Rule'] && blockCategories['Logic Rule'].blocks) {
      const logicBlocks = this.extractAlstomLogicRules(blockCategories['Logic Rule'].blocks);
      allBlocks.push(...logicBlocks.blocks);
      allConnections.push(...logicBlocks.connections);
    }
    
    // Estrai terminatori
    if (blockCategories['Terminator'] && blockCategories['Terminator'].blocks) {
      const terminatorBlocks = this.extractAlstomTerminators(blockCategories['Terminator'].blocks);
      allBlocks.push(...terminatorBlocks.blocks);
      allConnections.push(...terminatorBlocks.connections);
    }
    
    // Estrai costanti
    if (blockCategories['Constant'] && blockCategories['Constant'].blocks) {
      const constantBlocks = this.extractAlstomConstants(blockCategories['Constant'].blocks);
      allBlocks.push(...constantBlocks.blocks);
      allConnections.push(...constantBlocks.connections);
    }
    
    // Calcola layout gerarchico che rispetta il flusso
    this.calculateHierarchicalLayout(allBlocks, allConnections);
    
    return {
      name: metadata.subsystemName || metadata.sourceFile || 'Alstom Model',
      version: metadata.version,
      blocks: allBlocks,
      connections: allConnections,
      parameters: {},
      metadata: {
        created: metadata.exportedBy,
        modified: new Date().toISOString(),
        simulinkVersion: metadata.version
      }
    };
  }

  private static extractAlstomVariables(variableBlocks: any[]): { blocks: SimulinkBlock[], connections: SimulinkConnection[] } {
    const blocks: SimulinkBlock[] = [];
    const connections: SimulinkConnection[] = [];
    
    // Prima passata: crea tutti i blocchi senza posizionamento
    variableBlocks.forEach((varBlock) => {
      const varId = varBlock.varId;
      const variableName = varBlock.variableName;
      const description = varBlock.description;
      
      // Determina il tipo di blocco in base al varId
      let blockType = 'Variable';
      if (varId.includes('LibFrom') || varId.includes('Serial From')) {
        blockType = 'LibFrom';
      } else if (varId.includes('LibGoto') || varId.includes('Serial Goto')) {
        blockType = 'LibGoto';
      }
      
      const block: SimulinkBlock = {
        id: varId,
        name: variableName || varId,
        blockType: blockType,
        position: { x: 0, y: 0, width: 120, height: 60 }, // Posizione temporanea
        parameters: {
          variableName: variableName,
          description: description
        }
      };
      
      blocks.push(block);
      
      // Crea connessioni per i destination
      if (varBlock.destination && Array.isArray(varBlock.destination)) {
        varBlock.destination.forEach((dest: any, destIndex: number) => {
          const connection: SimulinkConnection = {
            id: `${varId}_to_${dest.varId}_${destIndex}`,
            source: {
              blockId: varId,
              portId: 'output'
            },
            target: {
              blockId: dest.varId,
              portId: 'input'
            }
          };
          connections.push(connection);
        });
      }
    });
    
    return { blocks, connections };
  }

  private static extractAlstomLogicRules(logicBlocks: any[]): { blocks: SimulinkBlock[], connections: SimulinkConnection[] } {
    const blocks: SimulinkBlock[] = [];
    const connections: SimulinkConnection[] = [];
    
    logicBlocks.forEach((logicBlock) => {
      const varId = logicBlock.varId;
      const opField = logicBlock.opField; // AND, OR, NOT, etc.
      const hasDestination = logicBlock.destination && Array.isArray(logicBlock.destination) && logicBlock.destination.length > 0;
      
      // Determina se è un Terminator: non ha destination o opField valido
      const isTerminator = !hasDestination || !opField || opField === '' || opField === 'TERM';
      
      const block: SimulinkBlock = {
        id: varId,
        name: isTerminator ? (logicBlock.variableName || 'Terminator') : (opField || 'Logic'),
        blockType: isTerminator ? 'Terminator' : 'Logical Operator',
        position: { x: 0, y: 0, width: isTerminator ? 60 : 80, height: isTerminator ? 30 : 50 }, // Posizione temporanea
        parameters: isTerminator ? {} : {
          operator: opField,
          opValue: logicBlock.opValue
        }
      };
      
      blocks.push(block);
      
      // Crea connessioni per i destination (solo se non è un Terminator)
      if (!isTerminator && hasDestination) {
        logicBlock.destination.forEach((dest: any, destIndex: number) => {
          const connection: SimulinkConnection = {
            id: `${varId}_to_${dest.varId}_${destIndex}`,
            source: {
              blockId: varId,
              portId: 'output'
            },
            target: {
              blockId: dest.varId,
              portId: 'input'
            }
          };
          connections.push(connection);
        });
      }
    });
    
    return { blocks, connections };
  }

  private static extractAlstomTerminators(terminatorBlocks: any[]): { blocks: SimulinkBlock[], connections: SimulinkConnection[] } {
    const blocks: SimulinkBlock[] = [];
    const connections: SimulinkConnection[] = [];
    
    terminatorBlocks.forEach((termBlock) => {
      const varId = termBlock.varId;
      const variableName = termBlock.variableName || 'Terminator';
      const description = termBlock.description;
      
      const block: SimulinkBlock = {
        id: varId,
        name: variableName,
        blockType: 'Terminatore',
        position: { x: 0, y: 0, width: 60, height: 30 }, // Posizione temporanea
        parameters: {
          variableName: variableName,
          description: description
        }
      };
      
      blocks.push(block);
      
      // I terminatori tipicamente non hanno destination (sono sink)
      // ma possono averne se specificato nel JSON
      if (termBlock.destination && Array.isArray(termBlock.destination)) {
        termBlock.destination.forEach((dest: any, destIndex: number) => {
          const connection: SimulinkConnection = {
            id: `${varId}_to_${dest.varId}_${destIndex}`,
            source: {
              blockId: varId,
              portId: 'output'
            },
            target: {
              blockId: dest.varId,
              portId: 'input'
            }
          };
          connections.push(connection);
        });
      }
    });
    
    return { blocks, connections };
  }

  private static extractAlstomConstants(constantBlocks: any[]): { blocks: SimulinkBlock[], connections: SimulinkConnection[] } {
    const blocks: SimulinkBlock[] = [];
    const connections: SimulinkConnection[] = [];
    
    constantBlocks.forEach((constBlock) => {
      const varId = constBlock.varId;
      const variableName = constBlock.variableName || 'Costante';
      const description = constBlock.description;
      const value = constBlock.value || constBlock.constantValue || '0';
      
      const block: SimulinkBlock = {
        id: varId,
        name: variableName,
        blockType: 'Costante',
        position: { x: 0, y: 0, width: 80, height: 40 }, // Posizione temporanea
        parameters: {
          variableName: variableName,
          description: description,
          value: value,
          constantValue: value
        }
      };
      
      blocks.push(block);
      
      // Crea connessioni per i destination
      if (constBlock.destination && Array.isArray(constBlock.destination)) {
        constBlock.destination.forEach((dest: any, destIndex: number) => {
          const connection: SimulinkConnection = {
            id: `${varId}_to_${dest.varId}_${destIndex}`,
            source: {
              blockId: varId,
              portId: 'output'
            },
            target: {
              blockId: dest.varId,
              portId: 'input'
            }
          };
          connections.push(connection);
        });
      }
    });
    
    return { blocks, connections };
  }

  private static extractBlocks(blocksData: any[]): SimulinkBlock[] {
    if (!Array.isArray(blocksData)) return [];
    
    return blocksData.map((block, index) => {
      const id = block.id || block.ID || block.handle || block.Handle || `block_${index}`;
      const name = block.name || block.Name || block.blockName || `Block ${index}`;
      const blockType = block.blockType || block.BlockType || block.type || block.Type || 'Unknown';
      
      // Estrai posizione - diversi formati possibili
      let position = { x: 0, y: 0, width: 60, height: 30 };
      
      if (block.position) {
        if (Array.isArray(block.position) && block.position.length >= 4) {
          // Formato [x1, y1, x2, y2]
          position = {
            x: block.position[0],
            y: block.position[1],
            width: block.position[2] - block.position[0],
            height: block.position[3] - block.position[1]
          };
        } else if (typeof block.position === 'object') {
          // Formato oggetto
          position = {
            x: block.position.x || block.position.X || 0,
            y: block.position.y || block.position.Y || 0,
            width: block.position.width || block.position.Width || 60,
            height: block.position.height || block.position.Height || 30
          };
        }
      } else if (block.Position) {
        // Formato Simulink standard
        if (Array.isArray(block.Position) && block.Position.length >= 4) {
          position = {
            x: block.Position[0],
            y: block.Position[1],
            width: block.Position[2] - block.Position[0],
            height: block.Position[3] - block.Position[1]
          };
        }
      }

      // Estrai parametri
      const parameters: Record<string, any> = {};
      
      // Copia tutti i parametri che non sono proprietà di sistema
      const systemProps = ['id', 'ID', 'name', 'Name', 'blockType', 'BlockType', 'position', 'Position', 'inputs', 'outputs', 'parent', 'children'];
      Object.keys(block).forEach(key => {
        if (!systemProps.includes(key)) {
          parameters[key] = block[key];
        }
      });

      // Estrai porte
      const inputs = this.extractPorts(block.inputs || block.Inputs || [], 'input');
      const outputs = this.extractPorts(block.outputs || block.Outputs || [], 'output');

      return {
        id,
        name,
        blockType,
        position,
        parameters,
        inputs: inputs.length > 0 ? inputs : undefined,
        outputs: outputs.length > 0 ? outputs : undefined,
        parent: block.parent || block.Parent,
        children: block.children || block.Children
      };
    });
  }

  private static extractPorts(portsData: any[], type: 'input' | 'output'): SimulinkPort[] {
    if (!Array.isArray(portsData)) return [];
    
    return portsData.map((port, index) => ({
      id: port.id || port.ID || `${type}_${index}`,
      type,
      name: port.name || port.Name,
      dataType: port.dataType || port.DataType,
      dimensions: port.dimensions || port.Dimensions
    }));
  }

  private static extractConnections(connectionsData: any[]): SimulinkConnection[] {
    if (!Array.isArray(connectionsData)) return [];
    
    return connectionsData.map((conn, index) => {
      const id = conn.id || conn.ID || `connection_${index}`;
      
      // Diversi formati per source e target
      let source, target;
      
      if (conn.source && conn.target) {
        source = {
          blockId: conn.source.blockId || conn.source.block || conn.source.Block,
          portId: conn.source.portId || conn.source.port || conn.source.Port || 'output',
          portIndex: conn.source.portIndex || conn.source.portIndex
        };
        target = {
          blockId: conn.target.blockId || conn.target.block || conn.target.Block,
          portId: conn.target.portId || conn.target.port || conn.target.Port || 'input',
          portIndex: conn.target.portIndex || conn.target.portIndex
        };
      } else if (conn.from && conn.to) {
        source = {
          blockId: conn.from.blockId || conn.from.block || conn.from,
          portId: conn.from.portId || conn.from.port || 'output',
          portIndex: conn.from.portIndex
        };
        target = {
          blockId: conn.to.blockId || conn.to.block || conn.to,
          portId: conn.to.portId || conn.to.port || 'input',
          portIndex: conn.to.portIndex
        };
      } else {
        // Fallback: usa le prime due proprietà come source e target
        const keys = Object.keys(conn);
        source = {
          blockId: conn[keys[0]] || `unknown_source_${index}`,
          portId: 'output'
        };
        target = {
          blockId: conn[keys[1]] || `unknown_target_${index}`,
          portId: 'input'
        };
      }

      return {
        id,
        source,
        target,
        signal: conn.signal || conn.Signal,
        waypoints: conn.waypoints || conn.Waypoints
      };
    });
  }

  private static findBlocksInObject(obj: any): any[] {
    const blocks: any[] = [];
    
    const searchKeys = ['blocks', 'Blocks', 'block', 'Block', 'components', 'Components'];
    
    for (const key of searchKeys) {
      if (obj[key] && Array.isArray(obj[key])) {
        blocks.push(...obj[key]);
      }
    }
    
    // Cerca ricorsivamente
    Object.values(obj).forEach(value => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        blocks.push(...this.findBlocksInObject(value));
      }
    });
    
    return blocks;
  }

  private static findConnectionsInObject(obj: any): any[] {
    const connections: any[] = [];
    
    const searchKeys = ['connections', 'Connections', 'lines', 'Lines', 'edges', 'Edges'];
    
    for (const key of searchKeys) {
      if (obj[key] && Array.isArray(obj[key])) {
        connections.push(...obj[key]);
      }
    }
    
    // Cerca ricorsivamente
    Object.values(obj).forEach(value => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        connections.push(...this.findConnectionsInObject(value));
      }
    });
    
    return connections;
  }

  /**
   * Calcola un layout gerarchico che rispetta il flusso logico
   */
  private static calculateHierarchicalLayout(blocks: SimulinkBlock[], connections: SimulinkConnection[]): void {
    // Crea un grafo delle dipendenze
    const graph = new Map<string, { block: SimulinkBlock, inputs: string[], outputs: string[], level: number }>();
    
    // Inizializza il grafo
    blocks.forEach(block => {
      graph.set(block.id, {
        block,
        inputs: [],
        outputs: [],
        level: -1
      });
    });
    
    // Popola le connessioni
    connections.forEach(conn => {
      const sourceNode = graph.get(conn.source.blockId);
      const targetNode = graph.get(conn.target.blockId);
      
      if (sourceNode && targetNode) {
        sourceNode.outputs.push(conn.target.blockId);
        targetNode.inputs.push(conn.source.blockId);
      }
    });
    
    // Calcola i livelli gerarchici usando topological sort
    const levels: string[][] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    // Trova tutti i nodi sorgente (senza input)
    const sourceNodes = Array.from(graph.values())
      .filter(node => node.inputs.length === 0)
      .map(node => node.block.id);
    
    // Assegna livelli partendo dalle sorgenti
    const assignLevel = (nodeId: string, level: number): void => {
      const node = graph.get(nodeId);
      if (!node || visited.has(nodeId)) return;
      
      if (visiting.has(nodeId)) {
        // Ciclo rilevato, interrompi
        return;
      }
      
      visiting.add(nodeId);
      node.level = Math.max(node.level, level);
      
      // Assegna livelli ai nodi di output
      node.outputs.forEach(outputId => {
        assignLevel(outputId, level + 1);
      });
      
      visiting.delete(nodeId);
      visited.add(nodeId);
    };
    
    // Inizia dalle sorgenti
    sourceNodes.forEach(nodeId => {
      assignLevel(nodeId, 0);
    });
    
    // Gestisci nodi orfani (non raggiunti)
    let orphanLevel = 0;
    graph.forEach((node, nodeId) => {
      if (node.level === -1) {
        node.level = orphanLevel;
        orphanLevel++;
      }
    });
    
    // Raggruppa per livello
    const levelGroups = new Map<number, string[]>();
    graph.forEach((node, nodeId) => {
      const level = node.level;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(nodeId);
    });
    
    // Calcola posizioni finali
    const LEVEL_WIDTH = 200;  // Spazio tra livelli
    const BLOCK_SPACING = 80; // Spazio tra blocchi nello stesso livello
    const START_X = 50;
    const START_Y = 50;
    
    Array.from(levelGroups.keys()).sort((a, b) => a - b).forEach(level => {
      const nodesInLevel = levelGroups.get(level)!;
      const x = START_X + (level * LEVEL_WIDTH);
      
      // Separa per tipo di blocco
      const libFromNodes = nodesInLevel.filter(id => {
        const block = blocks.find(b => b.id === id);
        return block?.blockType === 'LibFrom';
      });
      
      const constantNodes = nodesInLevel.filter(id => {
        const block = blocks.find(b => b.id === id);
        return block?.blockType === 'Costante' || block?.blockType === 'Constant';
      });
      
      const logicNodes = nodesInLevel.filter(id => {
        const block = blocks.find(b => b.id === id);
        return block?.blockType === 'Logical Operator';
      });
      
      const libGotoNodes = nodesInLevel.filter(id => {
        const block = blocks.find(b => b.id === id);
        return block?.blockType === 'LibGoto';
      });
      
      const terminatorNodes = nodesInLevel.filter(id => {
        const block = blocks.find(b => b.id === id);
        return block?.blockType === 'Terminatore' || block?.blockType === 'Terminator';
      });
      
      let currentY = START_Y;
      
      // Posiziona LibFrom e Costanti in alto (input sources)
      const inputNodes = [...libFromNodes, ...constantNodes];
      inputNodes.forEach((nodeId, index) => {
        const block = blocks.find(b => b.id === nodeId);
        if (block) {
          block.position.x = x;
          block.position.y = currentY + (index * BLOCK_SPACING);
        }
      });
      
      if (inputNodes.length > 0) {
        currentY += inputNodes.length * BLOCK_SPACING + 50;
      }
      
      // Posiziona operatori logici al centro
      logicNodes.forEach((nodeId, index) => {
        const block = blocks.find(b => b.id === nodeId);
        if (block) {
          block.position.x = x;
          block.position.y = currentY + (index * BLOCK_SPACING);
        }
      });
      
      if (logicNodes.length > 0) {
        currentY += logicNodes.length * BLOCK_SPACING + 50;
      }
      
      // Posiziona LibGoto e Terminatori in basso (output sinks)
      const outputNodes = [...libGotoNodes, ...terminatorNodes];
      outputNodes.forEach((nodeId, index) => {
        const block = blocks.find(b => b.id === nodeId);
        if (block) {
          block.position.x = x;
          block.position.y = currentY + (index * BLOCK_SPACING);
        }
      });
    });
  }

  /**
   * Valida che il modello parsato sia valido
   */
  static validateModel(model: SimulinkModel): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!model.name) {
      errors.push('Il modello deve avere un nome');
    }
    
    if (!model.blocks || model.blocks.length === 0) {
      errors.push('Il modello deve contenere almeno un blocco');
    }
    
    // Verifica che tutti i blocchi abbiano ID unici
    const blockIds = new Set();
    model.blocks.forEach(block => {
      if (blockIds.has(block.id)) {
        errors.push(`ID blocco duplicato: ${block.id}`);
      }
      blockIds.add(block.id);
    });
    
    // Verifica che le connessioni facciano riferimento a blocchi esistenti
    model.connections.forEach(conn => {
      if (!blockIds.has(conn.source.blockId)) {
        errors.push(`Connessione fa riferimento a blocco source inesistente: ${conn.source.blockId}`);
      }
      if (!blockIds.has(conn.target.blockId)) {
        errors.push(`Connessione fa riferimento a blocco target inesistente: ${conn.target.blockId}`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
