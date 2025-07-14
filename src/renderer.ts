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
    
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#333');

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
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(400, 300))
      .force('collision', d3.forceCollide().radius(50));
    
    // Esegui la simulazione per un numero fisso di iterazioni
    for (let i = 0; i < 300; i++) {
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
      .on('click', (event, d) => this.selectBlock(d))
      .on('mouseover', (event, d) => this.showBlockTooltip(event, d))
      .on('mouseout', () => this.hideBlockTooltip());

    // Renderizza la forma del blocco
    blockSelection.each((d, i, nodes) => {
      const element = d3.select(nodes[i]);
      this.renderBlockShape(element, d);
    });

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
    
    // Renderizza porte di output (destra)
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
      // Porta di output di default
      element.append('circle')
        .attr('class', 'port output')
        .attr('cx', width + 3)
        .attr('cy', height / 2)
        .attr('r', 3);
    }
  }

  private renderConnections(): void {
    if (!this.model) return;
    
    const connectionsGroup = this.svg.append('g').attr('class', 'connections');
    
    connectionsGroup
      .selectAll('.connection')
      .data(this.model.connections)
      .enter()
      .append('path')
      .attr('class', 'connection connection-line')
      .attr('d', d => this.calculateConnectionPath(d))
      .on('mouseover', (event, d) => this.showConnectionTooltip(event, d))
      .on('mouseout', () => this.hideConnectionTooltip());
  }

  private calculateConnectionPath(connection: SimulinkConnection): string {
    if (!this.model) return '';
    
    const sourceBlock = this.model.blocks.find(b => b.id === connection.source.blockId);
    const targetBlock = this.model.blocks.find(b => b.id === connection.target.blockId);
    
    if (!sourceBlock || !targetBlock) return '';
    
    // Calcola i punti di connessione
    const sourceX = sourceBlock.position.x + (sourceBlock.position.width || 60);
    const sourceY = sourceBlock.position.y + (sourceBlock.position.height || 30) / 2;
    
    const targetX = targetBlock.position.x;
    const targetY = targetBlock.position.y + (targetBlock.position.height || 30) / 2;
    
    // Se ci sono waypoints, usali
    if (connection.waypoints && connection.waypoints.length > 0) {
      let path = `M ${sourceX} ${sourceY}`;
      connection.waypoints.forEach(point => {
        path += ` L ${point.x} ${point.y}`;
      });
      path += ` L ${targetX} ${targetY}`;
      return path;
    }
    
    // Altrimenti, crea una curva semplice
    const midX = (sourceX + targetX) / 2;
    return `M ${sourceX} ${sourceY} Q ${midX} ${sourceY} ${midX} ${(sourceY + targetY) / 2} Q ${midX} ${targetY} ${targetX} ${targetY}`;
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
}
