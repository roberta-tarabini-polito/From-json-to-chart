# Convertitore JSON Simulink a Diagramma

Un'applicazione web per convertire file JSON (generati da modelli Simulink .mdl) in diagrammi di flusso interattivi e visualizzazioni grafiche.

## 🚀 Caratteristiche

- **Parser Intelligente**: Supporta diversi formati JSON di Simulink
- **Visualizzazione Interattiva**: Rendering in tempo reale con D3.js
- **Layout Automatico**: Algoritmi di forza per posizionamento ottimale dei blocchi
- **Tipi di Blocchi Supportati**: Tutti i blocchi Simulink comuni (Gain, Integrator, Sum, etc.)
- **Esportazione**: SVG e PNG per documentazione
- **Interfaccia Intuitiva**: Drag & drop, zoom, pan, selezione blocchi

## 🛠️ Installazione

```bash
# Clona il repository
git clone [url-repository]
cd from-json-to-chart

# Installa le dipendenze (richiede Node.js)
npm install

# Avvia il server di sviluppo
npm run dev

# Build per produzione
npm run build
```

## 📖 Utilizzo

1. **Carica JSON**: Usa il pulsante "Carica file" o incolla il JSON nell'area di testo
2. **Visualizza**: Il diagramma viene generato automaticamente
3. **Interagisci**: 
   - Clicca sui blocchi per vedere i dettagli
   - Usa la rotella del mouse per zoom
   - Trascina per pan
4. **Esporta**: Ctrl+S per salvare come SVG

## 📝 Formato JSON Supportato

L'applicazione supporta diversi formati JSON generati da Simulink:

### Formato Standard
```json
{
  "name": "Nome Modello",
  "blocks": [
    {
      "id": "block_1",
      "name": "Gain Block",
      "blockType": "Gain",
      "position": { "x": 100, "y": 50, "width": 60, "height": 30 },
      "parameters": { "Gain": "2" }
    }
  ],
  "connections": [
    {
      "source": { "blockId": "block_1", "portId": "output" },
      "target": { "blockId": "block_2", "portId": "input" }
    }
  ]
}
```

### Formato MDL Convertito
```json
{
  "model": {
    "blocks": [...],
    "lines": [...]
  }
}
```

Il parser è abbastanza flessibile da gestire variazioni nei nomi dei campi e nella struttura.

## 🔧 Tipi di Blocchi Supportati

### Sources
- Constant, Step, Ramp, Sine Wave
- Pulse Generator, Signal Generator
- From Workspace

### Math Operations  
- Sum, Product, Gain
- Abs, Sqrt, Trigonometric Function

### Continuous
- Integrator, Derivative
- Transfer Function, State-Space
- PID Controller

### Discrete
- Unit Delay, Zero-Order Hold
- Discrete-Time Integrator

### Signal Routing
- Mux, Demux, Switch, Selector
- Bus Creator, Bus Selector

### Sinks
- Scope, To Workspace, Display

### Subsystems
- Subsystem, Inport, Outport

## 🎨 Personalizzazione

### Aggiungere Nuovi Tipi di Blocco

Modifica `src/types.ts`:

```typescript
export const BLOCK_RENDER_CONFIGS: Record<string, BlockRenderConfig> = {
  'Custom Block': {
    width: 80,
    height: 40,
    color: '#FFB74D',
    shape: 'rectangle',
    showPorts: true
  }
};
```

### Modificare il Parser

Estendi `src/parser.ts` per supportare nuovi formati JSON.

## 🏗️ Architettura

```
src/
├── types.ts      # Definizioni TypeScript
├── parser.ts     # Parser JSON flessibile  
├── renderer.ts   # Renderer D3.js
├── main.ts       # App principale
└── style.css     # Stili CSS
```

## 🤝 Contribuire

1. Fork del progetto
2. Crea un branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit delle modifiche (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📄 Licenza

Distribuito sotto licenza MIT. Vedi `LICENSE` per maggiori informazioni.

## 🐛 Bug e Richieste

Per bug report e richieste di feature, apri un [issue](issues) su GitHub.

## 📬 Contatti

Per domande o supporto: [inserire contatti]

---

⭐ Se questo progetto ti è utile, considera di mettere una stella!
