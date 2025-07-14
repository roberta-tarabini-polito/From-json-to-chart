import './style.css';
import { SimulinkJSONParser } from './parser.js';
import { SimulinkRenderer } from './renderer.js';
import { SimulinkModel } from './types.js';
import { ipcRenderer } from 'electron';

class SimulinkJSONToChartApp {
  private renderer: SimulinkRenderer;
  private currentModel: SimulinkModel | null = null;

  constructor() {
    this.renderer = new SimulinkRenderer('chart');
    this.initializeEventListeners();
    this.showSampleData();
  }

  private initializeEventListeners(): void {
    // File input
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.addEventListener('change', (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        this.loadFromFile(file);
      }
    });

    // Load button
    const loadBtn = document.getElementById('loadBtn') as HTMLButtonElement;
    loadBtn?.addEventListener('click', () => {
      const jsonInput = document.getElementById('jsonInput') as HTMLTextAreaElement;
      const jsonText = jsonInput.value.trim();
      if (jsonText) {
        this.loadFromJSON(jsonText);
      }
    });

    // Options
    const showParams = document.getElementById('showParams') as HTMLInputElement;
    showParams?.addEventListener('change', () => {
      this.renderer.setOptions({ showParameters: showParams.checked });
    });

    const showPorts = document.getElementById('showPorts') as HTMLInputElement;
    showPorts?.addEventListener('change', () => {
      this.renderer.setOptions({ showPorts: showPorts.checked });
    });

    const zoomSlider = document.getElementById('zoomSlider') as HTMLInputElement;
    zoomSlider?.addEventListener('input', () => {
      const zoomValue = parseFloat(zoomSlider.value);
      this.renderer.setZoom(zoomValue);
    });

    // Relayout button
    const relayoutBtn = document.getElementById('relayoutBtn') as HTMLButtonElement;
    relayoutBtn?.addEventListener('click', () => {
      this.relayoutChart();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'o':
            event.preventDefault();
            fileInput?.click();
            break;
          case 's':
            event.preventDefault();
            this.exportChart();
            break;
        }
      }
    });
  }

  private async loadFromFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      this.loadFromJSON(text);
    } catch (error) {
      this.showError(`Errore nel caricamento del file: ${error}`);
    }
  }

  private loadFromJSON(jsonText: string): void {
    try {
      const jsonData = JSON.parse(jsonText);
      const model = SimulinkJSONParser.parseJSON(jsonData);
      
      // Valida il modello
      const validation = SimulinkJSONParser.validateModel(model);
      if (!validation.isValid) {
        console.warn('Problemi rilevati nel modello:', validation.errors);
        this.showWarning(`Modello caricato con avvertimenti:\n${validation.errors.join('\n')}`);
      }
      
      this.currentModel = model;
      this.renderer.render(model);
      this.showSuccess(`Modello "${model.name}" caricato con successo! ${model.blocks.length} blocchi, ${model.connections.length} connessioni.`);
      
    } catch (error) {
      this.showError(`Errore nel parsing del JSON: ${error}`);
    }
  }

  private exportChart(): void {
    if (!this.currentModel) {
      this.showError('Nessun modello caricato da esportare');
      return;
    }

    const svgData = this.renderer.exportAsSVG();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.currentModel.name}_diagram.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    this.showSuccess('Diagramma esportato come SVG');
  }

  private showSampleData(): void {
    const sampleJSON = {
      name: "Esempio Modello Simulink",
      blocks: [
        {
          id: "step_input",
          name: "Step Input",
          blockType: "Step",
          position: { x: 50, y: 100, width: 60, height: 30 },
          parameters: {
            "StepTime": "1",
            "InitialValue": "0",
            "FinalValue": "1"
          }
        },
        {
          id: "gain_block",
          name: "Gain",
          blockType: "Gain",
          position: { x: 200, y: 100, width: 60, height: 30 },
          parameters: {
            "Gain": "2"
          }
        },
        {
          id: "integrator",
          name: "Integrator1",
          blockType: "Integrator",
          position: { x: 350, y: 100, width: 60, height: 40 },
          parameters: {
            "InitialCondition": "0"
          }
        },
        {
          id: "scope",
          name: "Scope",
          blockType: "Scope",
          position: { x: 500, y: 100, width: 60, height: 40 }
        }
      ],
      connections: [
        {
          id: "conn1",
          source: { blockId: "step_input", portId: "output" },
          target: { blockId: "gain_block", portId: "input" }
        },
        {
          id: "conn2",
          source: { blockId: "gain_block", portId: "output" },
          target: { blockId: "integrator", portId: "input" }
        },
        {
          id: "conn3",
          source: { blockId: "integrator", portId: "output" },
          target: { blockId: "scope", portId: "input" }
        }
      ]
    };

    const jsonInput = document.getElementById('jsonInput') as HTMLTextAreaElement;
    if (jsonInput) {
      jsonInput.value = JSON.stringify(sampleJSON, null, 2);
    }
  }

  private relayoutChart(): void {
    if (this.currentModel) {
      // Usa il metodo relayout del renderer
      this.renderer.relayout();
      this.showSuccess('Layout riorganizzato con algoritmo gerarchico!');
    } else {
      this.showWarning('Nessun modello caricato da riorganizzare.');
    }
  }

  private showSuccess(message: string): void {
    this.showNotification(message, 'success');
  }

  private showError(message: string): void {
    this.showNotification(message, 'error');
    console.error(message);
  }

  private showWarning(message: string): void {
    this.showNotification(message, 'warning');
    console.warn(message);
  }

  private showNotification(message: string, type: 'success' | 'error' | 'warning'): void {
    // Crea una notifica
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Stili per la notifica
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '500',
      maxWidth: '400px',
      zIndex: '1000',
      opacity: '0',
      transform: 'translateY(-20px)',
      transition: 'all 0.3s ease',
      backgroundColor: type === 'success' ? '#4CAF50' : 
                       type === 'error' ? '#f44336' : '#ff9800'
    });
    
    document.body.appendChild(notification);
    
    // Anima l'entrata
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    }, 10);
    
    // Rimuovi dopo 5 secondi
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 5000);
  }
}

// If in Electron dev mode, reload on changes
if (window.process && window.process.type) {
  window.require('electron').ipcRenderer.on('reload', () => {
    window.location.reload();
  });
}

// Inizializza l'applicazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  new SimulinkJSONToChartApp();
});
