import * as d3 from 'd3';
import { SimulinkModel, SimulinkBlock, SimulinkConnection, BLOCK_RENDER_CONFIGS, DEFAULT_BLOCK_CONFIG, BlockRenderConfig } from './types.js';

export class SimulinkRenderer {
  private svg: d3.Selection<SVGGElement, unknown, null, undefined>;
  private container: d3.Selection<HTMLElement, unknown, null, undefined>;
  private model: SimulinkModel | null = null;
  private zoom: d3.ZoomBehavior<Element, unknown>;
  private selectedBlock: SimulinkBlock | null = null;
  
  // Opzioni di rendering
  private options = {
    showParameters: true,
    showPorts: true,
    zoomLevel: 1
  };

  constructor(containerId: string) {
    this.container = d3.select(`#${containerId}`);
    this.initializeSVG();
    this.setupZoom();
  }

  private initializeSVG(): void {
    // Rimuovi SVG esistente se presente
    this.container.select('svg').remove();
    
    const svg = this.container
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%');

    // Definisci i marker per le frecce
    const defs = svg.append('defs');
    
    // Marker normale
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -6 12 12')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .attr('markerUnits', 'strokeWidth')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5L2,0Z')
      .attr('fill', '#555')
      .attr('stroke', 'none');

    // Marker per hover/highlight
    defs.append('marker')
      .attr('id', 'arrowhead-highlight')
      .attr('viewBox', '0 -6 12 12')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .attr('markerUnits', 'strokeWidth')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5L2,0Z')
      .attr('fill', '#4CAF50')
      .attr('stroke', 'none');

    this.svg = svg.append('g')
      .attr('class', 'main-group');
  }

  private setupZoom(): void {
    this.zoom = d3.zoom<Element, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        this.svg.attr('transform', event.transform);
      });

    this.container.select('svg').call(this.zoom);
  }

  public setOptions(options: Partial<typeof this.options>): void {
    this.options = { ...this.options, ...options };
    if (this.model) {
      this.render(this.model);
    }
  }

  public render(model: SimulinkModel): void {
    this.model = model;
    this.clearCanvas();
    
    // Calcola layout automatico se le posizioni non sono specificate
    this.calculateLayout();
    
    // Renderizza connessioni prima dei blocchi (così stanno dietro)
    this.renderConnections();
    
    // Renderizza blocchi
    this.renderBlocks();
    
    // Centra la vista
    this.centerView();
  }

  private clearCanvas(): void {
    this.svg.selectAll('*').remove();
  }

  private calculateLayout(): void {
    if (!this.model) return;
    
    // Se alcuni blocchi non hanno posizione, calcola un layout automatico
    const blocksWithoutPosition = this.model.blocks.filter(block => 
      !block.position || (block.position.x === 0 && block.position.y === 0)
    );
    
    if (blocksWithoutPosition.length > 0) {
      this.applyForceLayout();
    }
  }

  private applyForceLayout(): void {
    if (!this.model) return;
    
    // Prima prova con il layout gerarchico
    if (this.applyHierarchicalLayout()) {
      return;
    }
    
    // Se fallisce, usa il layout di forze come fallback
    this.applyRandomForceLayout();
  }

  private applyHierarchicalLayout(): boolean {
    if (!this.model) return false;
    
    const blocks = this.model.blocks;
    const connections = this.model.connections;
    
    // Costruisci grafo delle dipendenze
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    
    // Inizializza
    blocks.forEach(block => {
      graph.set(block.id, new Set());
      inDegree.set(block.id, 0);
    });
    
    // Costruisci il grafo
    connections.forEach(conn => {
      const sourceId = conn.source.blockId;
      const targetId = conn.target.blockId;
      
      if (!graph.get(sourceId)?.has(targetId)) {
        graph.get(sourceId)?.add(targetId);
        inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);
      }
    });
    
    // Topological sort per determinare i livelli
    const levels = this.calculateLevels(graph, inDegree);
    if (levels.length === 0) return false;
    
    // Posiziona i blocchi in base ai livelli
    this.positionBlocksByLevels(levels);
    
    return true;
  }

  private calculateLevels(graph: Map<string, Set<string>>, inDegree: Map<string, number>): string[][] {
    const levels: string[][] = [];
    const queue: string[] = [];
    const visited = new Set<string>();
    
    // Trova i nodi senza dipendenze (input blocks)
    for (const [blockId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(blockId);
      }
    }
    
    while (queue.length > 0) {
      const currentLevel: string[] = [];
      const levelSize = queue.length;
      
      for (let i = 0; i < levelSize; i++) {
        const blockId = queue.shift()!;
        currentLevel.push(blockId);
        visited.add(blockId);
        
        // Aggiorna i successori
        graph.get(blockId)?.forEach(successor => {
          const newDegree = (inDegree.get(successor) || 0) - 1;
          inDegree.set(successor, newDegree);
          
          if (newDegree === 0 && !visited.has(successor)) {
            queue.push(successor);
          }
        });
      }
      
      if (currentLevel.length > 0) {
        levels.push(currentLevel);
      }
    }
    
    return levels;
  }

  private positionBlocksByLevels(levels: string[][]): void {
    if (!this.model) return;
    
    const levelSpacing = 200; // Spaziatura orizzontale tra livelli
    const blockSpacing = 100; // Spaziatura verticale tra blocchi
    const startX = 100;
    
    levels.forEach((level, levelIndex) => {
      const x = startX + levelIndex * levelSpacing;
      const totalHeight = (level.length - 1) * blockSpacing;
      const startY = 300 - totalHeight / 2; // Centra verticalmente
      
      level.forEach((blockId, blockIndex) => {
        const block = this.model!.blocks.find(b => b.id === blockId);
        if (block) {
          block.position.x = x;
          block.position.y = startY + blockIndex * blockSpacing;
        }
      });
    });
  }

  private applyRandomForceLayout(): void {
    if (!this.model) return;
    
    const blocks = this.model.blocks;
    const connections = this.model.connections;
    
    // Crea nodi per la simulazione
    const nodes = blocks.map(block => ({
      id: block.id,
      block,
      x: block.position.x || Math.random() * 800,
      y: block.position.y || Math.random() * 600
    }));
    
    // Crea link per la simulazione
    const links = connections.map(conn => ({
      source: conn.source.blockId,
      target: conn.target.blockId
    }));
    
    // Simulazione di forze
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(400, 300))
      .force('collision', d3.forceCollide().radius(60));
    
    // Esegui la simulazione per un numero fisso di iterazioni
    for (let i = 0; i < 400; i++) {
      simulation.tick();
    }
    
    // Aggiorna le posizioni dei blocchi
    nodes.forEach(node => {
      const block = blocks.find(b => b.id === node.id);
      if (block) {
        block.position.x = node.x!;
        block.position.y = node.y!;
      }
    });
  }

  private renderBlocks(): void {
    if (!this.model) return;
    
    const blocksGroup = this.svg.append('g').attr('class', 'blocks');
    
    const blockSelection = blocksGroup
      .selectAll('.block')
      .data(this.model.blocks)
      .enter()
      .append('g')
      .attr('class', 'block simulink-block')
      .attr('transform', d => `translate(${d.position.x}, ${d.position.y})`)
      .style('cursor', 'move')
      .on('click', (event, d) => this.selectBlock(d))
      .on('mouseover', (event, d) => this.showBlockTooltip(event, d))
      .on('mouseout', () => this.hideBlockTooltip());

    // Applica il drag behavior
    this.setupBlockDrag(blockSelection);

    // Renderizza la forma del blocco
    blockSelection.each((d, i, nodes) => {
      const element = d3.select(nodes[i]);
      this.renderBlockShape(element, d);
    });

    // Aggiungi classe per identificare gli elementi shape
    blockSelection.selectAll('rect, circle, polygon')
      .attr('class', 'block-shape');

    // Renderizza il testo del blocco
    blockSelection.append('text')
      .attr('class', 'block-text')
      .attr('x', d => (d.position.width || 60) / 2)
      .attr('y', d => (d.position.height || 30) / 2)
      .text(d => this.getBlockDisplayText(d))
      .style('font-size', '10px')
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'central');

    // Renderizza le porte se richiesto
    if (this.options.showPorts) {
      blockSelection.each((d, i, nodes) => {
        const element = d3.select(nodes[i]);
        this.renderBlockPorts(element, d);
      });
    }
  }

  private renderBlockShape(element: d3.Selection<d3.BaseType, SimulinkBlock, d3.BaseType, unknown>, block: SimulinkBlock): void {
    const config = this.getBlockConfig(block.blockType);
    const width = block.position.width || config.width;
    const height = block.position.height || config.height;
    
    switch (config.shape) {
      case 'circle':
        element.append('circle')
          .attr('cx', width / 2)
          .attr('cy', height / 2)
          .attr('r', Math.min(width, height) / 2)
          .attr('fill', config.color)
          .attr('stroke', '#333')
          .attr('stroke-width', 1);
        break;
        
      case 'diamond':
        const points = [
          [width / 2, 0],
          [width, height / 2],
          [width / 2, height],
          [0, height / 2]
        ].map(p => p.join(',')).join(' ');
        
        element.append('polygon')
          .attr('points', points)
          .attr('fill', config.color)
          .attr('stroke', '#333')
          .attr('stroke-width', 1);
        break;
        
      case 'triangle':
        const trianglePoints = [
          [0, height],
          [width / 2, 0],
          [width, height]
        ].map(p => p.join(',')).join(' ');
        
        element.append('polygon')
          .attr('points', trianglePoints)
          .attr('fill', config.color)
          .attr('stroke', '#333')
          .attr('stroke-width', 1);
        break;
        
      default: // rectangle
        element.append('rect')
          .attr('width', width)
          .attr('height', height)
          .attr('fill', config.color)
          .attr('stroke', '#333')
          .attr('stroke-width', 1)
          .attr('rx', 4);
        break;
    }
  }

  private renderBlockPorts(element: d3.Selection<d3.BaseType, SimulinkBlock, d3.BaseType, unknown>, block: SimulinkBlock): void {
    const width = block.position.width || 60;
    const height = block.position.height || 30;
    
    // Renderizza porte di input (sinistra)
    if (block.inputs && block.inputs.length > 0) {
      block.inputs.forEach((port, index) => {
        const y = height * (index + 1) / (block.inputs!.length + 1);
        element.append('circle')
          .attr('class', 'port input')
          .attr('cx', -3)
          .attr('cy', y)
          .attr('r', 3);
      });
    } else {
      // Porta di input di default
      element.append('circle')
        .attr('class', 'port input')
        .attr('cx', -3)
        .attr('cy', height / 2)
        .attr('r', 3);
    }
    
    // I Terminator non hanno porte di output (sono sink)
    const isTerminator = block.blockType === 'Terminator' || block.blockType === 'Terminatore';
    
    if (!isTerminator) {
      // Renderizza porte di output (destra) solo per blocchi non-terminator
      if (block.outputs && block.outputs.length > 0) {
        block.outputs.forEach((port, index) => {
          const y = height * (index + 1) / (block.outputs!.length + 1);
          element.append('circle')
            .attr('class', 'port output')
            .attr('cx', width + 3)
            .attr('cy', y)
            .attr('r', 3);
        });
      } else {
        // Porta di output di default (solo per blocchi non-terminator)
        element.append('circle')
          .attr('class', 'port output')
          .attr('cx', width + 3)
          .attr('cy', height / 2)
          .attr('r', 3);
      }
    }
  }

  private renderConnections(): void {
    if (!this.model) return;
    
    const connectionsGroup = this.svg.append('g').attr('class', 'connections');
    
    // Renderizza le linee delle connessioni
    const connectionPaths = connectionsGroup
      .selectAll('.connection')
      .data(this.model.connections)
      .enter()
      .append('path')
      .attr('class', 'connection connection-line')
      .attr('d', d => this.calculateConnectionPath(d))
      .on('mouseover', (event, d) => {
        this.showConnectionTooltip(event, d);
        d3.select(event.target)
          .attr('marker-end', 'url(#arrowhead-highlight)')
          .classed('highlighted', true);
      })
      .on('mouseout', () => {
        this.hideConnectionTooltip();
        d3.selectAll('.connection-line')
          .attr('marker-end', 'url(#arrowhead)')
          .classed('highlighted', false);
      })
      .on('click', (event, d) => this.selectConnection(event, d));

    // Aggiungi punti di controllo sulle connessioni per permettere di spostarle
    this.addConnectionControlPoints(connectionsGroup);
  }

  private addConnectionControlPoints(connectionsGroup: d3.Selection<SVGGElement, unknown, null, undefined>): void {
    if (!this.model) return;

    this.model.connections.forEach(connection => {
      const sourceBlock = this.model!.blocks.find(b => b.id === connection.source.blockId);
      const targetBlock = this.model!.blocks.find(b => b.id === connection.target.blockId);
      
      if (!sourceBlock || !targetBlock) return;

      // Calcola il punto medio della connessione
      const sourceX = sourceBlock.position.x + (sourceBlock.position.width || 60);
      const sourceY = sourceBlock.position.y + (sourceBlock.position.height || 30) / 2;
      const targetX = targetBlock.position.x;
      const targetY = targetBlock.position.y + (targetBlock.position.height || 30) / 2;
      
      const midX = (sourceX + targetX) / 2;
      const midY = (sourceY + targetY) / 2;

      // Crea un punto di controllo invisibile al centro della connessione
      const controlPoint = connectionsGroup
        .append('circle')
        .attr('class', 'connection-control-point')
        .attr('cx', midX)
        .attr('cy', midY)
        .attr('r', 8)
        .style('fill', 'transparent')
        .style('stroke', '#4CAF50')
        .style('stroke-width', '2px')
        .style('cursor', 'move')
        .style('opacity', 0);

      // Mostra il punto di controllo al passaggio del mouse sulla connessione
      const connectionPath = connectionsGroup.select(`path[data-connection-id="${connection.source.blockId}-${connection.target.blockId}"]`);
      
      connectionPath
        .on('mouseenter', () => {
          controlPoint.style('opacity', 1);
        })
        .on('mouseleave', () => {
          controlPoint.style('opacity', 0);
        });

      // Applica drag behavior al punto di controllo
      this.setupConnectionControlDrag(controlPoint, connection);
    });
  }

  private setupConnectionControlDrag(controlPoint: d3.Selection<SVGCircleElement, unknown, null, undefined>, connection: SimulinkConnection): void {
    const dragBehavior = d3.drag<SVGCircleElement, unknown>()
      .on('start', () => {
        controlPoint.style('fill', '#4CAF50').style('opacity', 1);
      })
      .on('drag', (event) => {
        // Aggiorna la posizione del punto di controllo
        controlPoint.attr('cx', event.x).attr('cy', event.y);
        
        // Aggiungi o aggiorna il waypoint nella connessione
        if (!connection.waypoints) {
          connection.waypoints = [];
        }
        
        // Sostituisci il primo waypoint o aggiungilo
        connection.waypoints[0] = { x: event.x, y: event.y };
        
        // Ridisegna la connessione
        this.updateSingleConnection(connection);
      })
      .on('end', () => {
        controlPoint.style('fill', 'transparent').style('opacity', 0);
      });

    controlPoint.call(dragBehavior);
  }

  private updateSingleConnection(connection: SimulinkConnection): void {
    if (!this.model) return;
    
    // Trova e aggiorna la linea specifica
    this.svg.select('.connections')
      .selectAll('path')
      .filter((d: any) => d && d.source.blockId === connection.source.blockId && d.target.blockId === connection.target.blockId)
      .attr('d', this.calculateConnectionPath(connection));
  }

  private selectConnection(event: MouseEvent, connection: SimulinkConnection): void {
    // Aggiungi waypoint nel punto cliccato
    const [x, y] = d3.pointer(event);
    
    if (!connection.waypoints) {
      connection.waypoints = [];
    }
    
    connection.waypoints.push({ x, y });
    this.updateConnections();
  }

  private calculateConnectionPath(connection: SimulinkConnection): string {
    if (!this.model) return '';
    
    const sourceBlock = this.model.blocks.find(b => b.id === connection.source.blockId);
    const targetBlock = this.model.blocks.find(b => b.id === connection.target.blockId);
    
    if (!sourceBlock || !targetBlock) return '';
    
    // Calcola i punti di connessione
    const sourceWidth = sourceBlock.position.width || 60;
    const sourceHeight = sourceBlock.position.height || 30;
    const targetWidth = targetBlock.position.width || 60;
    const targetHeight = targetBlock.position.height || 30;
    
    // Punto di uscita (lato destro del blocco sorgente)
    const sourceX = sourceBlock.position.x + sourceWidth;
    const sourceY = sourceBlock.position.y + sourceHeight / 2;
    
    // Punto di ingresso (lato sinistro del blocco target)
    const targetX = targetBlock.position.x;
    const targetY = targetBlock.position.y + targetHeight / 2;
    
    // Se ci sono waypoints definiti, crea un percorso con angoli retti
    if (connection.waypoints && connection.waypoints.length > 0) {
      let path = `M ${sourceX} ${sourceY}`;
      
      // Primo waypoint: movimento orizzontale poi verticale
      const firstWaypoint = connection.waypoints[0];
      path += ` L ${firstWaypoint.x} ${sourceY} L ${firstWaypoint.x} ${firstWaypoint.y}`;
      
      // Waypoints intermedi: solo movimenti ortogonali
      for (let i = 1; i < connection.waypoints.length; i++) {
        const prevPoint = connection.waypoints[i - 1];
        const currPoint = connection.waypoints[i];
        
        // Movimento orizzontale prima, poi verticale
        path += ` L ${currPoint.x} ${prevPoint.y} L ${currPoint.x} ${currPoint.y}`;
      }
      
      // Ultimo segmento verso il target
      const lastWaypoint = connection.waypoints[connection.waypoints.length - 1];
      path += ` L ${targetX} ${lastWaypoint.y} L ${targetX} ${targetY}`;
      
      return path;
    }
    
    // Crea SOLO connessioni con angoli retti (orizzontali e verticali)
    const deltaX = targetX - sourceX;
    const deltaY = targetY - sourceY;
    
    // Se sono perfettamente allineati orizzontalmente, linea diretta
    if (Math.abs(deltaY) < 2) {
      return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    }
    
    // Se sono perfettamente allineati verticalmente (caso raro)
    if (Math.abs(deltaX) < 2) {
      const midY = sourceY + deltaY / 2;
      return `M ${sourceX} ${sourceY} L ${sourceX + 20} ${sourceY} L ${sourceX + 20} ${midY} L ${targetX - 20} ${midY} L ${targetX - 20} ${targetY} L ${targetX} ${targetY}`;
    }
    
    // Algoritmo migliorato per il routing ortogonale
    let midX: number;
    const minGap = 20; // Spazio minimo tra i segmenti
    
    if (deltaX > minGap * 2) {
      // Caso normale: c'è spazio sufficiente
      midX = sourceX + deltaX / 2;
    } else if (deltaX > 0) {
      // Blocchi vicini ma target è a destra
      midX = sourceX + Math.max(minGap, deltaX / 2);
    } else {
      // Target è a sinistra del source (feedback loop)
      // Crea un percorso che evita sovrapposizioni
      const maxY = Math.max(sourceBlock.position.y, targetBlock.position.y);
      const minY = Math.min(sourceBlock.position.y, targetBlock.position.y);
      const routeY = minY - 30; // Passa sopra entrambi i blocchi
      
      return `M ${sourceX} ${sourceY} L ${sourceX + minGap} ${sourceY} L ${sourceX + minGap} ${routeY} L ${targetX - minGap} ${routeY} L ${targetX - minGap} ${targetY} L ${targetX} ${targetY}`;
    }
    
    // Costruisci il percorso standard con solo linee orizzontali e verticali
    // Sequenza: orizzontale → verticale → orizzontale
    return `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
  }

  private getBlockConfig(blockType: string): BlockRenderConfig {
    return BLOCK_RENDER_CONFIGS[blockType] || DEFAULT_BLOCK_CONFIG;
  }

  private getBlockDisplayText(block: SimulinkBlock): string {
    if (block.name !== block.blockType) {
      return block.name;
    }
    return block.blockType;
  }

  private selectBlock(block: SimulinkBlock): void {
    // Rimuovi selezione precedente
    this.svg.selectAll('.simulink-block').classed('selected', false);
    
    // Seleziona il nuovo blocco
    this.svg.selectAll('.simulink-block')
      .filter((d: any) => d.id === block.id)
      .classed('selected', true);
    
    this.selectedBlock = block;
    this.showBlockDetails(block);
  }

  private showBlockDetails(block: SimulinkBlock): void {
    const detailsDiv = d3.select('#blockDetails');
    detailsDiv.style('display', 'block');
    
    let html = `<h4>${block.name}</h4>`;
    html += `<div class="param"><strong>Tipo:</strong> ${block.blockType}</div>`;
    html += `<div class="param"><strong>ID:</strong> ${block.id}</div>`;
    
    if (block.parameters && Object.keys(block.parameters).length > 0) {
      html += '<hr><strong>Parametri:</strong>';
      Object.entries(block.parameters).forEach(([key, value]) => {
        html += `<div class="param"><strong>${key}:</strong> ${JSON.stringify(value)}</div>`;
      });
    }
    
    if (block.inputs && block.inputs.length > 0) {
      html += '<hr><strong>Input:</strong>';
      block.inputs.forEach(input => {
        html += `<div class="param">• ${input.name || input.id} (${input.dataType || 'auto'})</div>`;
      });
    }
    
    if (block.outputs && block.outputs.length > 0) {
      html += '<hr><strong>Output:</strong>';
      block.outputs.forEach(output => {
        html += `<div class="param">• ${output.name || output.id} (${output.dataType || 'auto'})</div>`;
      });
    }
    
    detailsDiv.html(html);
  }

  private showBlockTooltip(event: MouseEvent, block: SimulinkBlock): void {
    // Implementa tooltip se necessario
  }

  private hideBlockTooltip(): void {
    // Implementa nascondere tooltip se necessario
  }

  private showConnectionTooltip(event: MouseEvent, connection: SimulinkConnection): void {
    // Implementa tooltip per connessioni se necessario
  }

  private hideConnectionTooltip(): void {
    // Implementa nascondere tooltip per connessioni se necessario
  }

  private centerView(): void {
    if (!this.model || this.model.blocks.length === 0) return;
    
    // Calcola il bounding box di tutti i blocchi
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    this.model.blocks.forEach(block => {
      const x = block.position.x;
      const y = block.position.y;
      const width = block.position.width || 60;
      const height = block.position.height || 30;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });
    
    // Aggiungi padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Ottieni le dimensioni del container
    const containerNode = this.container.node() as HTMLElement;
    const containerWidth = containerNode.clientWidth;
    const containerHeight = containerNode.clientHeight;
    
    // Calcola il fattore di zoom per far entrare tutto
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Non zoomare più del 100%
    
    // Calcola la traslazione per centrare
    const translateX = (containerWidth - contentWidth * scale) / 2 - minX * scale;
    const translateY = (containerHeight - contentHeight * scale) / 2 - minY * scale;
    
    // Applica la trasformazione
    const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    this.container.select('svg').call(this.zoom.transform, transform);
  }

  public setZoom(scale: number): void {
    const currentTransform = d3.zoomTransform(this.container.select('svg').node()!);
    const newTransform = currentTransform.scale(scale / currentTransform.k);
    this.container.select('svg').call(this.zoom.transform, newTransform);
  }

  public exportAsSVG(): string {
    return this.container.select('svg').node()?.outerHTML || '';
  }

  public exportAsPNG(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const svgElement = this.container.select('svg').node() as SVGSVGElement;
      const svgData = new XMLSerializer().serializeToString(svgElement);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to export PNG'));
        });
      };
      
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    });
  }

  public relayout(): void {
    if (this.model) {
      // Reset posizioni e ricalcola layout
      this.model.blocks.forEach(block => {
        block.position.x = 0;
        block.position.y = 0;
      });
      this.calculateLayout();
      this.clearCanvas();
      this.renderConnections();
      this.renderBlocks();
      this.centerView();
    }
  }

  // Gestione del drag & drop dei blocchi
  private onDragStart(event: d3.D3DragEvent<SVGGElement, SimulinkBlock, SimulinkBlock>, block: SimulinkBlock): void {
    // Porta il blocco in primo piano durante il drag
    const element = d3.select(event.sourceEvent.target as SVGElement).node()?.parentNode as SVGGElement;
    if (element) {
      d3.select(element)
        .raise()
        .classed('dragging', true);
    }
    
    // Disabilita lo zoom durante il drag
    this.container.select('svg').on('.zoom', null);
  }

  private onDrag(event: d3.D3DragEvent<SVGGElement, SimulinkBlock, SimulinkBlock>, block: SimulinkBlock): void {
    // Aggiorna la posizione del blocco
    block.position.x = event.x;
    block.position.y = event.y;
    
    // Aggiorna visualmente la posizione
    const parentNode = d3.select(event.sourceEvent.target as SVGElement).node()?.parentNode as SVGGElement;
    if (parentNode) {
      d3.select(parentNode).attr('transform', `translate(${event.x}, ${event.y})`);
    }
    
    // Ridisegna le connessioni in tempo reale
    this.updateConnections();
  }

  private onDragEnd(event: d3.D3DragEvent<SVGGElement, SimulinkBlock, SimulinkBlock>, block: SimulinkBlock): void {
    // Rimuovi la classe dragging
    const element = d3.select(event.sourceEvent.target as SVGElement).node()?.parentNode as SVGGElement;
    if (element) {
      d3.select(element).classed('dragging', false);
    }
    
    // Riabilita lo zoom
    this.setupZoom();
    
    // Aggiorna le posizioni finali
    block.position.x = event.x;
    block.position.y = event.y;
    
    // Ridisegna completamente le connessioni per assicurarsi che siano corrette
    this.updateConnections();
  }

  private updateConnections(): void {
    if (!this.model) return;
    
    // Rimuovi tutte le connessioni esistenti
    this.svg.select('.connections').remove();
    
    // Ridisegna le connessioni
    this.renderConnections();
  }

  private setupBlockDrag(blockSelection: d3.Selection<SVGGElement, SimulinkBlock, SVGGElement, unknown>): void {
    const dragBehavior = d3.drag<SVGGElement, SimulinkBlock>()
      .on('start', function(event, d) {
        // Porta in primo piano il blocco
        d3.select(this).raise().classed('dragging', true);
      })
      .on('drag', function(event, d) {
        // Aggiorna posizione del blocco
        d.position.x = event.x;
        d.position.y = event.y;
        
        // Aggiorna visivamente
        d3.select(this).attr('transform', `translate(${event.x}, ${event.y})`);
      })
      .on('end', function(event, d) {
        // Rimuovi classe dragging
        d3.select(this).classed('dragging', false);
        
        // Aggiorna le connessioni alla fine
        if (self.model) {
          self.updateConnections();
        }
      });
    
    const self = this;
    blockSelection.call(dragBehavior);
  }

  private updateConnectionsForBlock(blockId: string): void {
    if (!this.model) return;
    
    // Trova tutte le connessioni che coinvolgono questo blocco
    const relevantConnections = this.model.connections.filter(
      conn => conn.source.blockId === blockId || conn.target.blockId === blockId
    );
    
    // Aggiorna solo quelle connessioni
    const connectionsGroup = this.svg.select('.connections');
    relevantConnections.forEach(connection => {
      connectionsGroup
        .selectAll('path')
        .filter((d: any) => {
          return d && 
                 d.source.blockId === connection.source.blockId && 
                 d.target.blockId === connection.target.blockId;
        })
        .attr('d', this.calculateConnectionPath(connection));
    });
  }
}
